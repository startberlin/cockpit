import "server-only";

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { after } from "next/server";
import nodemailer from "nodemailer";
import type { ReactElement } from "react";
import { render } from "react-email";
import db from "@/db";
import { env } from "@/env";
import { type AuditSubject, writeAuditLog } from "@/lib/audit-log";

const ses = new SESv2Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

// Nodemailer stream transport: used only to build the raw MIME message.
// No actual sending happens through nodemailer.
const mimeBuilder = nodemailer.createTransport({ streamTransport: true });

type Attachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

type SendEmailOptions = {
  from: string;
  to: string | string[];
  subject: string;
  react: ReactElement;
  attachments?: Attachment[];
  /**
   * PostHog distinct id of the recipient. Forwarded to SES as a message tag
   * so engagement events (open / click) can be attributed to a known user.
   */
  userId?: string;
  /**
   * Optional category for segmenting engagement events in PostHog
   * (e.g. "welcome", "invoice", "reminder").
   */
  emailType?: string;
};

// SES message tag values must match [A-Za-z0-9_-]{1,256}. Sanitise to avoid
// InvalidParameterValue from SendEmail when callers pass arbitrary ids.
const TAG_VALUE_PATTERN = /[^A-Za-z0-9_-]/g;
function sanitizeTagValue(value: string): string {
  return value.replace(TAG_VALUE_PATTERN, "_").slice(0, 256);
}

// Matches the convention used elsewhere in the codebase (see system-groups.ts):
// production  → "production"
// preview     → "staging"
// anything else / unset → "development"
// Used to tag every outbound email so SNS can filter out engagement events
// from non-production environments at the topic level.
function getEnvironmentTag(): string {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === "production") return "production";
  if (vercelEnv === "preview") return "staging";
  return "development";
}

function buildEmailTags(opts: {
  userId?: string;
  emailType?: string;
}): { Name: string; Value: string }[] {
  const tags: { Name: string; Value: string }[] = [
    { Name: "environment", Value: getEnvironmentTag() },
  ];
  if (opts.userId)
    tags.push({ Name: "userId", Value: sanitizeTagValue(opts.userId) });
  if (opts.emailType)
    tags.push({ Name: "emailType", Value: sanitizeTagValue(opts.emailType) });
  return tags;
}

async function resolveRecipientSubjects(
  recipients: string[],
): Promise<Map<string, NonNullable<AuditSubject>>> {
  const lowered = recipients.map((r) => r.toLowerCase());
  const users = await db.query.user.findMany({
    where: (u, { or, inArray, sql }) =>
      or(
        inArray(sql<string>`lower(${u.email})`, lowered),
        inArray(sql<string>`lower(${u.personalEmail})`, lowered),
        inArray(sql<string>`lower(${u.eventInviteEmail})`, lowered),
      ),
    columns: {
      id: true,
      name: true,
      email: true,
      personalEmail: true,
      eventInviteEmail: true,
    },
  });

  const byEmail = new Map<string, NonNullable<AuditSubject>>();
  for (const u of users) {
    const subject = { id: u.id, name: u.name };
    for (const addr of [u.email, u.personalEmail, u.eventInviteEmail]) {
      if (!addr) continue;
      const key = addr.toLowerCase();
      // First match wins; user.email is unique, others may collide across users.
      if (!byEmail.has(key)) byEmail.set(key, subject);
    }
  }
  return byEmail;
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const recipients = Array.isArray(options.to) ? options.to : [options.to];

  if (env.DISABLE_EMAIL) {
    console.warn(
      `[email disabled] would have sent "${options.subject}" from ${options.from} to ${recipients.join(", ")}`,
    );
    return;
  }

  // SES manages its own account-level / configuration-set suppression list,
  // so we don't filter recipients locally — SES will reject the SendEmail
  // call if a recipient is suppressed.

  const logEmail = () => {
    after(async () => {
      try {
        const subjectByRecipient = await resolveRecipientSubjects(recipients);
        await Promise.all(
          recipients.map((recipient) =>
            writeAuditLog({
              category: "email",
              eventType: "email.sent",
              subject: subjectByRecipient.get(recipient.toLowerCase()) ?? null,
              metadata: { to: recipient, subject: options.subject },
              description: options.subject,
            }),
          ),
        );
      } catch (err) {
        console.error("[email] audit log write failed", err);
      }
    });
  };

  const [html, text] = await Promise.all([
    render(options.react),
    render(options.react, { plainText: true }),
  ]);

  // The Configuration Set is attached as the default on the verified sending
  // identity (see SES console / put-email-identity-configuration-set-attributes),
  // so we only need to pass per-message EmailTags here.
  const EmailTags = buildEmailTags({
    userId: options.userId,
    emailType: options.emailType,
  });

  if (options.attachments && options.attachments.length > 0) {
    const info = await mimeBuilder.sendMail({
      from: options.from,
      to: recipients,
      subject: options.subject,
      html,
      text,
      attachments: options.attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });

    const chunks: Buffer[] = [];
    for await (const chunk of info.message) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const rawEmail = Buffer.concat(chunks);

    await ses.send(
      new SendEmailCommand({
        Content: { Raw: { Data: rawEmail } },
        EmailTags,
      }),
    );
    logEmail();
  } else {
    await ses.send(
      new SendEmailCommand({
        FromEmailAddress: options.from,
        Destination: { ToAddresses: recipients },
        Content: {
          Simple: {
            Subject: { Data: options.subject, Charset: "UTF-8" },
            Body: {
              Html: { Data: html, Charset: "UTF-8" },
              Text: { Data: text, Charset: "UTF-8" },
            },
          },
        },
        EmailTags,
      }),
    );
    logEmail();
  }
}
