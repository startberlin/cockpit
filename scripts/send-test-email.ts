import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import nodemailer from "nodemailer";

const TO = "it@start-berlin.com";
const FROM = "START Berlin <no-reply@notification.cockpit.start-berlin.com>";

const { AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = process.env;
if (!AWS_REGION || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
  console.error(
    "Missing AWS_REGION, AWS_ACCESS_KEY_ID, or AWS_SECRET_ACCESS_KEY",
  );
  process.exit(1);
}

const ses = new SESv2Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

const mimeBuilder = nodemailer.createTransport({ streamTransport: true });

const html = `
<!DOCTYPE html>
<html>
  <body style="font-family: sans-serif; padding: 32px;">
    <h1>SES test email</h1>
    <p>This is a test email sent from the START Cockpit send-test-email script.</p>
    <p>If you are reading this, email delivery via AWS SES is working correctly.</p>
    <p style="color:#888;font-size:12px;">Sent at ${new Date().toISOString()}</p>
  </body>
</html>`;

const attachmentContent = Buffer.from(
  `START Cockpit — SES test attachment\nSent at: ${new Date().toISOString()}\n`,
);

async function main() {
  const info = await mimeBuilder.sendMail({
    from: FROM,
    to: TO,
    subject: "START Cockpit — SES test email",
    html,
    text: "This is a test email sent from the START Cockpit send-test-email script.",
    attachments: [
      {
        filename: "test-attachment.txt",
        content: attachmentContent,
        contentType: "text/plain",
      },
    ],
  });

  const chunks: Buffer[] = [];
  for await (const chunk of info.message) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const rawEmail = Buffer.concat(chunks);

  console.log(`Sending to ${TO} via SES (${AWS_REGION})...`);

  await ses.send(
    new SendEmailCommand({ Content: { Raw: { Data: rawEmail } } }),
  );

  console.log("Done. Check your inbox at", TO);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
