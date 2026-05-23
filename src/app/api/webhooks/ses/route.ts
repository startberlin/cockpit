import { createVerify } from "node:crypto";
import { NonRetriableError, step } from "inngest";
import { z } from "zod";
import db from "@/db";
import { emailSuppression } from "@/db/schema";
import { env } from "@/env";
import { inngest } from "@/lib/inngest";

// SNS always sends Content-Type: text/plain even though the body is JSON.
// The outer envelope is the SNS message; the inner Message field (when
// Type === "Notification") is a JSON-encoded string containing the SES event.

const SnsEnvelopeSchema = z.discriminatedUnion("Type", [
  z.object({
    Type: z.literal("SubscriptionConfirmation"),
    SubscribeURL: z.string().url(),
    SigningCertURL: z.string(),
    Signature: z.string(),
    SignatureVersion: z.string(),
    MessageId: z.string(),
    Message: z.string(),
    Timestamp: z.string(),
    Token: z.string(),
    TopicArn: z.string(),
  }),
  z.object({
    Type: z.literal("Notification"),
    Message: z.string(),
    SigningCertURL: z.string(),
    Signature: z.string(),
    SignatureVersion: z.string(),
    MessageId: z.string(),
    Timestamp: z.string(),
    TopicArn: z.string(),
    Subject: z.string().optional(),
  }),
  z.object({
    Type: z.literal("UnsubscribeConfirmation"),
    SigningCertURL: z.string(),
    Signature: z.string(),
    SignatureVersion: z.string(),
    MessageId: z.string(),
    Message: z.string(),
    Timestamp: z.string(),
    Token: z.string(),
    TopicArn: z.string(),
    SubscribeURL: z.string().url(),
  }),
]);

const SesNotificationSchema = z.discriminatedUnion("notificationType", [
  z.object({
    notificationType: z.literal("Bounce"),
    bounce: z.object({
      bounceType: z.string(),
      bouncedRecipients: z.array(z.object({ emailAddress: z.string() })),
    }),
  }),
  z.object({
    notificationType: z.literal("Complaint"),
    complaint: z.object({
      complainedRecipients: z.array(z.object({ emailAddress: z.string() })),
    }),
  }),
  z.object({
    notificationType: z.literal("Delivery"),
  }),
]);

// Only trust URLs served from SNS's own domain.
const SNS_URL_PATTERN = /^https:\/\/sns\.[a-z0-9-]+\.amazonaws\.com\//;

// Module-level cache — avoids a cert fetch on every request within the same
// function instance. Cold starts re-fetch, which is fine.
const certCache = new Map<string, string>();

async function fetchCert(url: string): Promise<string> {
  const cached = certCache.get(url);
  if (cached) return cached;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch SNS cert: ${res.status}`);
  const cert = await res.text();
  certCache.set(url, cert);
  return cert;
}

// Build the canonical string SNS signs. Field order and presence differ by
// message type — see AWS SNS docs for the exact specification.
function buildCanonicalString(
  envelope: z.infer<typeof SnsEnvelopeSchema>,
): string {
  const fields: Array<[string, string | undefined]> =
    envelope.Type === "Notification"
      ? [
          ["Message", envelope.Message],
          ["MessageId", envelope.MessageId],
          ["Subject", envelope.Subject],
          ["Timestamp", envelope.Timestamp],
          ["TopicArn", envelope.TopicArn],
          ["Type", envelope.Type],
        ]
      : [
          ["Message", envelope.Message],
          ["MessageId", envelope.MessageId],
          ["SubscribeURL", envelope.SubscribeURL],
          ["Timestamp", envelope.Timestamp],
          ["Token", envelope.Token],
          ["TopicArn", envelope.TopicArn],
          ["Type", envelope.Type],
        ];

  return fields
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}\n${value}\n`)
    .join("");
}

async function verifySnsSignature(
  envelope: z.infer<typeof SnsEnvelopeSchema>,
): Promise<void> {
  if (!SNS_URL_PATTERN.test(envelope.SigningCertURL)) {
    throw new NonRetriableError(
      `Untrusted SigningCertURL: ${envelope.SigningCertURL}`,
    );
  }

  const cert = await fetchCert(envelope.SigningCertURL);
  const canonical = buildCanonicalString(envelope);
  const algorithm =
    envelope.SignatureVersion === "2" ? "RSA-SHA256" : "RSA-SHA1";

  const verifier = createVerify(algorithm);
  verifier.update(canonical);

  if (!verifier.verify(cert, envelope.Signature, "base64")) {
    throw new NonRetriableError("Invalid SNS signature");
  }
}

export const POST = inngest.endpoint(async (req: Request) => {
  // Read the raw body before any steps. On Inngest replays the body will be
  // empty, but the first step is memoized so its closure never re-runs.
  const rawBody = await req.text();

  // Step 1: Parse and cryptographically verify the SNS envelope.
  // Transient cert-fetch failures are retried by Inngest; invalid signatures
  // throw NonRetriableError so they are never retried.
  const envelope = await step.run("verify-and-parse-sns", async () => {
    const parsed = SnsEnvelopeSchema.parse(JSON.parse(rawBody));
    await verifySnsSignature(parsed);
    if (parsed.TopicArn !== env.AWS_SES_SNS_TOPIC_ARN) {
      throw new NonRetriableError(`Unexpected TopicArn: ${parsed.TopicArn}`);
    }
    return parsed;
  });

  if (envelope.Type === "SubscriptionConfirmation") {
    if (!SNS_URL_PATTERN.test(envelope.SubscribeURL)) {
      throw new NonRetriableError(
        `Untrusted SubscribeURL: ${envelope.SubscribeURL}`,
      );
    }
    await step.run("confirm-subscription", () => fetch(envelope.SubscribeURL));
    return new Response("OK");
  }

  if (envelope.Type !== "Notification") {
    return new Response("OK");
  }

  const sesEvent = await step.run("parse-ses-notification", () => {
    return SesNotificationSchema.parse(JSON.parse(envelope.Message));
  });

  if (sesEvent.notificationType === "Bounce") {
    // Only suppress hard (Permanent) bounces; transient bounces are temporary.
    if (sesEvent.bounce.bounceType !== "Permanent") {
      return new Response("OK");
    }

    for (const recipient of sesEvent.bounce.bouncedRecipients) {
      const email = recipient.emailAddress;
      await step.run(`suppress-bounce-${email}`, () =>
        db
          .insert(emailSuppression)
          .values({
            email,
            reason: "bounce",
            detail: "Permanent bounce",
          })
          .onConflictDoUpdate({
            target: emailSuppression.email,
            set: {
              reason: "bounce",
              detail: "Permanent bounce",
              suppressedAt: new Date(),
            },
          }),
      );
    }
  }

  if (sesEvent.notificationType === "Complaint") {
    for (const recipient of sesEvent.complaint.complainedRecipients) {
      const email = recipient.emailAddress;
      await step.run(`suppress-complaint-${email}`, () =>
        db
          .insert(emailSuppression)
          .values({
            email,
            reason: "complaint",
            detail: "Spam complaint",
          })
          .onConflictDoUpdate({
            target: emailSuppression.email,
            set: {
              reason: "complaint",
              detail: "Spam complaint",
              suppressedAt: new Date(),
            },
          }),
      );
    }
  }

  return new Response("OK");
});
