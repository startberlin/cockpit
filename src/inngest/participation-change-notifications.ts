import "server-only";

import { SESv2ServiceException } from "@aws-sdk/client-sesv2";
import { and, eq, sql } from "drizzle-orm";
import db from "@/db";
import {
  getCurrentParticipationChange,
  getParticipationRecipients,
} from "@/db/participation";
import { auditLog } from "@/db/schema";
import { ParticipationChangeEmail } from "@/emails/admin/participation-change";
import { env } from "@/env";
import { writeAuditLog } from "@/lib/audit-log";
import { sendEmail } from "@/lib/email";
import { events, inngest } from "@/lib/inngest";
import { formatParticipationDate } from "@/lib/user-status";

const deliveryEvent = "email.participation_notification_processed";

export const participationChangeNotifications = inngest.createFunction(
  {
    id: "participation-change-notifications",
    name: "Participation Change Emails",
    triggers: [{ event: events.participationChanged.name }],
    idempotency: "event.data.auditId",
    concurrency: { limit: 1, key: "event.data.auditId" },
  },
  async ({ event, step }) => {
    const { auditId } = event.data;
    const recipients = await step.run("load-recipients", async () => {
      const change = await getCurrentParticipationChange(auditId);
      return change ? getParticipationRecipients(change.member) : [];
    });

    const outcomes = await Promise.all(
      recipients
        .filter((recipient) => recipient !== null)
        .map(async (recipient) => {
          const outcome = await step.run(`send-${recipient.id}`, async () => {
            const change = await getCurrentParticipationChange(auditId);
            if (!change) return "superseded";

            const previous = await db.query.auditLog.findFirst({
              where: and(
                eq(auditLog.eventType, deliveryEvent),
                eq(auditLog.subjectId, recipient.id),
                sql`${auditLog.metadata}->>'changeId' = ${auditId}`,
              ),
              columns: { id: true },
            });
            if (previous) return "already_processed";
            if (!recipient.email) return "missing_address";
            if (env.DISABLE_EMAIL) return "email_disabled";

            const isMember = recipient.role === "member";
            const subjectName = isMember ? "Your" : `${change.member.name}'s`;
            const state = change.paused ? "paused" : "resumed";
            const prefix =
              process.env.VERCEL_ENV === "preview" ? "[Staging] " : "";

            try {
              await sendEmail({
                from: "START Berlin <no-reply@notification.cockpit.start-berlin.com>",
                to: recipient.email,
                subject: `${prefix}${subjectName} START Berlin participation is ${state}`,
                react: ParticipationChangeEmail({
                  recipientName: recipient.firstName,
                  memberName: isMember ? undefined : change.member.name,
                  paused: change.paused,
                  effectiveDate: formatParticipationDate(change.changedAt),
                  cockpitUrl: `${env.NEXT_PUBLIC_COCKPIT_URL}/${isMember ? "membership" : "people"}`,
                }),
                emailType: `participation_${state}_${recipient.role}`,
                userId: recipient.id,
              });
              return "accepted";
            } catch (error) {
              const code =
                error instanceof SESv2ServiceException
                  ? error.$metadata.httpStatusCode
                  : undefined;
              if (code === 429) throw error;
              // A timeout can occur after SES accepted a message. Record the
              // uncertainty before an operator considers another send.
              console.error(
                "Participation email failed",
                auditId,
                recipient.id,
              );
              return code && code < 500 ? "rejected" : "uncertain";
            }
          });

          if (outcome !== "already_processed") {
            await step.run(`log-${recipient.id}`, () =>
              writeAuditLog({
                category: "email",
                eventType: deliveryEvent,
                subject: { id: recipient.id, name: recipient.name },
                metadata: { changeId: auditId, role: recipient.role, outcome },
                description: `Participation email: ${outcome.replaceAll("_", " ")}`,
              }),
            );
          }

          return { role: recipient.role, outcome };
        }),
    );

    return outcomes;
  },
);
