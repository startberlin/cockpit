import "server-only";

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import nodemailer from "nodemailer";
import type { ReactElement } from "react";
import { render } from "react-email";
import db from "@/db";
import { env } from "@/env";

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
};

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const recipients = Array.isArray(options.to) ? options.to : [options.to];

  if (env.DISABLE_EMAIL) {
    console.warn(
      `[email disabled] would have sent "${options.subject}" from ${options.from} to ${recipients.join(", ")}`,
    );
    return;
  }

  const suppressed = await db.query.emailSuppression.findMany({
    where: (t, { inArray }) => inArray(t.email, recipients),
    columns: { email: true },
  });

  const suppressedEmails = new Set(suppressed.map((s) => s.email));
  const activeRecipients = recipients.filter((r) => !suppressedEmails.has(r));

  if (activeRecipients.length === 0) return;

  const [html, text] = await Promise.all([
    render(options.react),
    render(options.react, { plainText: true }),
  ]);

  if (options.attachments && options.attachments.length > 0) {
    const info = await mimeBuilder.sendMail({
      from: options.from,
      to: activeRecipients,
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
      }),
    );
  } else {
    await ses.send(
      new SendEmailCommand({
        FromEmailAddress: options.from,
        Destination: { ToAddresses: activeRecipients },
        Content: {
          Simple: {
            Subject: { Data: options.subject, Charset: "UTF-8" },
            Body: {
              Html: { Data: html, Charset: "UTF-8" },
              Text: { Data: text, Charset: "UTF-8" },
            },
          },
        },
      }),
    );
  }
}
