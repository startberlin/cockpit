import "server-only";

import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import db from "@/db";
import { user } from "@/db/schema/auth";
import DataConfirmationReminderEmail from "@/emails/membership/data-confirmation-reminder";
import { env } from "@/env";
import { sendEmail } from "@/lib/email";
import { inngest } from "@/lib/inngest";
import { track } from "@/lib/posthog-server";

const DATA_CONFIRMATION_INTERVAL_DAYS = 100;

// Runs daily and emails each active member who hasn't reviewed their contact
// details in the past 100 days. Fires at 4am Berlin to avoid clashing with
// the anniversary cron at 3am. When the email is sent the timestamp resets,
// so the next reminder won't arrive for another 100 days regardless of whether
// the member clicks through.
export const dataConfirmationReminderCron = inngest.createFunction(
  {
    id: "data-confirmation-reminder-cron",
    name: "Member Data Confirmation Reminders (daily)",
    triggers: [{ cron: "TZ=Europe/Berlin 0 4 * * *" }],
  },
  async ({ step }) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - DATA_CONFIRMATION_INTERVAL_DAYS);

    const dueUsers = await step.run("load-due-users", () =>
      db
        .select({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
        })
        .from(user)
        .where(
          and(
            inArray(user.status, ["member", "supporting_alumni"]),
            inArray(user.legalMembershipState, ["active_member"]),
            or(
              isNull(user.dataLastConfirmedAt),
              lt(user.dataLastConfirmedAt, cutoff),
            ),
          ),
        ),
    );

    if (dueUsers.length === 0) {
      return { sent: 0 };
    }

    const confirmUrl = `${env.NEXT_PUBLIC_COCKPIT_URL}/membership/settings?confirm=1`;

    let sent = 0;

    for (const member of dueUsers) {
      if (!member.email) continue;

      await step.run(`send-reminder-${member.id}`, async () => {
        await sendEmail({
          from: "START Berlin <no-reply@notification.cockpit.start-berlin.com>",
          to: member.email as string,
          subject: "Please confirm your START Berlin member data",
          react: DataConfirmationReminderEmail({
            firstName: member.firstName ?? "",
            confirmUrl,
          }),
        });

        await db
          .update(user)
          .set({ dataLastConfirmedAt: sql`NOW()` })
          .where(eq(user.id, member.id));

        track({
          distinctId: member.id,
          event: "workflow_email_sent",
          properties: {
            email_type: "data_confirmation_reminder",
            subject_id: member.id,
          },
        });
      });

      sent += 1;
    }

    return { sent };
  },
);
