import { createVerify } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { env } from "@/env";
import { resolveUserIdsByEmail } from "@/lib/email";
import { getPostHogClient } from "@/lib/posthog-server";

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

// SES event-publishing payload (Configuration Set → SNS). We only care about
// Open and Click; everything else (Send, Delivery, Bounce, Complaint, …) is
// ignored — SES manages its own suppression list.
const SesMailSchema = z.object({
  timestamp: z.string(),
  messageId: z.string(),
  source: z.string().optional(),
  destination: z.array(z.string()),
  commonHeaders: z.object({ subject: z.string().optional() }).optional(),
  tags: z.record(z.string(), z.array(z.string())).optional(),
});

const SesEngagementSchema = z.discriminatedUnion("eventType", [
  z.object({
    eventType: z.literal("Open"),
    mail: SesMailSchema,
    open: z.object({
      timestamp: z.string().optional(),
      userAgent: z.string().optional(),
      ipAddress: z.string().optional(),
    }),
  }),
  z.object({
    eventType: z.literal("Click"),
    mail: SesMailSchema,
    click: z.object({
      timestamp: z.string().optional(),
      userAgent: z.string().optional(),
      ipAddress: z.string().optional(),
      link: z.string(),
      linkTags: z.record(z.string(), z.array(z.string())).optional(),
    }),
  }),
]);

type SesEngagement = z.infer<typeof SesEngagementSchema>;

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
): Promise<boolean> {
  if (!SNS_URL_PATTERN.test(envelope.SigningCertURL)) return false;

  const cert = await fetchCert(envelope.SigningCertURL);
  const canonical = buildCanonicalString(envelope);
  const algorithm =
    envelope.SignatureVersion === "2" ? "RSA-SHA256" : "RSA-SHA1";

  const verifier = createVerify(algorithm);
  verifier.update(canonical);
  return verifier.verify(cert, envelope.Signature, "base64");
}

async function captureEngagement(event: SesEngagement): Promise<void> {
  const posthog = getPostHogClient();
  if (!posthog) return;

  const { eventType, mail } = event;
  const taggedUserId = mail.tags?.userId?.[0];
  const emailType = mail.tags?.emailType?.[0];
  const recipient = mail.destination[0];

  // Fallback for legacy messages sent before sendEmail auto-tagged userId, or
  // recipients added as users after the email went out. If we still can't find
  // a user, drop the event rather than create a person keyed by raw email.
  let distinctId = taggedUserId;
  if (!distinctId && recipient) {
    const subjects = await resolveUserIdsByEmail([recipient]);
    distinctId = subjects.get(recipient.toLowerCase())?.id;
  }
  if (!distinctId) return;

  posthog.capture({
    distinctId,
    event: eventType === "Open" ? "email_opened" : "email_link_clicked",
    properties: {
      // SES occasionally emits duplicate events. Dedupe on messageId +
      // event type (+ link, for clicks) keeps PostHog clean if so.
      $insert_id:
        event.eventType === "Click"
          ? `${mail.messageId}:Click:${event.click.link}`
          : `${mail.messageId}:Open`,
      $email: recipient,
      email_subject: mail.commonHeaders?.subject,
      email_type: emailType,
      message_id: mail.messageId,
      timestamp: mail.timestamp,
      ...(event.eventType === "Click" && {
        clicked_url: event.click.link,
        clicked_url_tags: event.click.linkTags,
        user_agent: event.click.userAgent,
      }),
      ...(event.eventType === "Open" && {
        user_agent: event.open.userAgent,
      }),
    },
  });
}

export async function POST(req: Request): Promise<Response> {
  let envelope: z.infer<typeof SnsEnvelopeSchema>;
  try {
    envelope = SnsEnvelopeSchema.parse(JSON.parse(await req.text()));
  } catch (err) {
    console.error("[ses-webhook] failed to parse SNS envelope:", err);
    return new Response("Bad Request", { status: 400 });
  }

  if (envelope.TopicArn !== env.AWS_SES_SNS_TOPIC_ARN) {
    console.error(`[ses-webhook] unexpected TopicArn: ${envelope.TopicArn}`);
    return new Response("Forbidden", { status: 403 });
  }

  const signatureValid = await verifySnsSignature(envelope);
  if (!signatureValid) {
    console.error("[ses-webhook] invalid SNS signature");
    return new Response("Forbidden", { status: 403 });
  }

  if (envelope.Type === "SubscriptionConfirmation") {
    if (!SNS_URL_PATTERN.test(envelope.SubscribeURL)) {
      return new Response("Bad Request", { status: 400 });
    }
    // Confirm synchronously: if we 200 before the SubscribeURL fetch
    // succeeds the subscription stays in PendingConfirmation, and SNS
    // never retries because the delivery already succeeded. Returning
    // 502 on failure tells SNS to redeliver this SubscriptionConfirmation.
    try {
      const res = await fetch(envelope.SubscribeURL);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(
          `[ses-webhook] subscription confirmation failed: ${res.status} ${body}`,
        );
        return new Response("Bad Gateway", { status: 502 });
      }
    } catch (err) {
      console.error("[ses-webhook] subscription confirmation failed:", err);
      return new Response("Bad Gateway", { status: 502 });
    }
    return new Response("OK");
  }

  if (envelope.Type !== "Notification") {
    return new Response("OK");
  }

  // Only Open / Click reach PostHog. Bounce / Complaint / Delivery / etc. are
  // ignored because SES manages its own suppression list.
  //
  // Defence in depth: staging / preview deployments share the SES identity,
  // so events from non-prod environments would otherwise leak into PostHog
  // if the SNS subscription filter policy is missing or misconfigured.
  let engagement: SesEngagement;
  try {
    const json = JSON.parse(envelope.Message);
    if (json?.eventType !== "Open" && json?.eventType !== "Click") {
      return new Response("OK");
    }
    const environment = json?.mail?.tags?.environment?.[0];
    if (environment && environment !== "production") {
      return new Response("OK");
    }
    engagement = SesEngagementSchema.parse(json);
  } catch (err) {
    console.error("[ses-webhook] failed to parse SES engagement event:", err);
    // Don't make SNS retry on malformed payloads.
    return new Response("OK");
  }

  // Fire-and-forget the PostHog capture after returning 200 to SNS. PostHog's
  // node client retries internally; if the function shuts down mid-flush the
  // event is lost, which is acceptable for engagement analytics.
  after(async () => {
    try {
      await captureEngagement(engagement);
      await getPostHogClient()?.flush();
    } catch (err) {
      console.error("[ses-webhook] PostHog capture failed:", err);
    }
  });

  return new Response("OK");
}
