import "server-only";
import db from "@/db";
import {
  JOBBOARD_SUBMISSION_EMAIL_SUBJECT,
  JobboardSubmissionReceivedEmail,
} from "@/emails/jobboard/submission-received";
import { env } from "@/env";
import { sendEmailOnce } from "@/lib/email";
import { JOBBOARD_SUBMISSION_EMAIL_TYPE } from "@/lib/email-engagement";
import { events, inngest } from "@/lib/inngest";
import { createJobboardEmailQueue } from "../db/email-queue";
import { drainSubmissionEmailQueue } from "../lib/submission-email-delivery";

export const jobboardSubmissionEmails = inngest.createFunction(
  {
    id: "jobboard-submission-emails",
    name: "Jobboard submission emails",
    triggers: [
      { event: events.jobboardSubmissionReceived.name },
      { cron: "*/15 * * * *" },
    ],
    concurrency: { limit: 1 },
  },
  async ({ step }) =>
    step.run("deliver-committed-submissions", () =>
      drainSubmissionEmailQueue(createJobboardEmailQueue(db), async (claim) => {
        if (env.DISABLE_EMAIL) return "disabled";
        const prefix = process.env.VERCEL_ENV === "preview" ? "[Staging] " : "";
        return sendEmailOnce({
          from: "START Berlin <no-reply@notification.cockpit.start-berlin.com>",
          to: claim.email,
          subject: prefix + JOBBOARD_SUBMISSION_EMAIL_SUBJECT,
          react: JobboardSubmissionReceivedEmail({
            submissionId: claim.submissionId,
            jobTitle: claim.jobTitle,
            companyName: claim.companyName,
          }),
          userId: claim.userId,
          emailType: JOBBOARD_SUBMISSION_EMAIL_TYPE,
        });
      }),
    ),
);
