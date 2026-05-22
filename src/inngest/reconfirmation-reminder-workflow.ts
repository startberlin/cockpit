import db from "@/db";
import MembershipApplicationReadyEmail from "@/emails/membership/admission/membership-application-ready";
import { env } from "@/env";
import { sendEmail } from "@/lib/email";
import { events, inngest } from "@/lib/inngest";

const TOTAL_DAYS = 90;
const INTERVAL_DAYS = 3;

// Sends the initial "complete your reconfirmation" email immediately, then
// nudges every 3 days while a legal membership remains in
// `membership_reconfirmation_pending`.
export const reconfirmationReminderWorkflow = inngest.createFunction(
  {
    id: "reconfirmation-reminder-workflow",
    name: "Reconfirmation Reminder Workflow",
    triggers: [{ event: events.reconfirmationPending }],
    idempotency: "event.data.legalMembershipId",
    cancelOn: [
      {
        event: events.cancellationRequested.name,
        if: "async.data.userId == event.data.userId",
      },
      {
        event: events.reconfirmationSubmitted.name,
        if: "async.data.legalMembershipId == event.data.legalMembershipId",
      },
    ],
  },
  async ({ event, step }) => {
    const { userId, legalMembershipId } = event.data;

    const initial = await step.run("send-initial-email", async () => {
      const lm = await db.query.legalMembership.findFirst({
        where: (l, { eq }) => eq(l.id, legalMembershipId),
        columns: { status: true },
      });
      if (!lm || lm.status !== "membership_reconfirmation_pending") {
        return { sent: false };
      }

      const u = await db.query.user.findFirst({
        where: (uu, { eq }) => eq(uu.id, userId),
        columns: { email: true, firstName: true, status: true },
      });
      if (!u?.email) return { sent: false };
      if (u.status === "cancelled" || u.status === "alumni") {
        return { sent: false };
      }

      await sendEmail({
        from: "START Berlin <notifications@cockpit.start-berlin.com>",
        to: u.email,
        subject: "Complete your START Berlin membership application",
        react: MembershipApplicationReadyEmail({
          firstName: u.firstName ?? "",
          applicationUrl: `${env.NEXT_PUBLIC_COCKPIT_URL}/membership`,
        }),
      });
      return { sent: true };
    });

    if (!initial.sent) return { outcome: "skipped" as const };

    let elapsed = 0;
    while (elapsed < TOTAL_DAYS) {
      const wait = Math.min(INTERVAL_DAYS, TOTAL_DAYS - elapsed);
      await step.sleep(`sleep-${elapsed}d`, `${wait}d`);
      elapsed += wait;

      const checkpoint = await step.run(`check-${elapsed}d`, async () => {
        const lm = await db.query.legalMembership.findFirst({
          where: (l, { eq }) => eq(l.id, legalMembershipId),
          columns: { status: true },
        });

        if (!lm) return { outcome: "lm_missing" as const };

        if (lm.status !== "membership_reconfirmation_pending") {
          return { outcome: "resolved" as const };
        }

        const u = await db.query.user.findFirst({
          where: (uu, { eq }) => eq(uu.id, userId),
          columns: { email: true, firstName: true, status: true },
        });

        if (!u) return { outcome: "user_missing" as const };

        if (u.status === "cancelled" || u.status === "alumni") {
          return { outcome: "no_longer_eligible" as const };
        }

        return {
          outcome: "still_pending" as const,
          email: u.email,
          firstName: u.firstName,
        };
      });

      if (checkpoint.outcome !== "still_pending") {
        return { outcome: checkpoint.outcome, elapsed };
      }

      const email = checkpoint.email;

      if (email === null) {
        continue;
      }

      await step.run(`send-reminder-${elapsed}d`, async () => {
        await sendEmail({
          from: "START Berlin <notifications@cockpit.start-berlin.com>",
          to: email,
          subject: "Reminder: confirm your START Berlin membership",
          react: MembershipApplicationReadyEmail({
            firstName: checkpoint.firstName ?? "",
            applicationUrl: `${env.NEXT_PUBLIC_COCKPIT_URL}/membership`,
            isReminder: true,
          }),
        });
      });
    }

    return { outcome: "timeout" as const, elapsed };
  },
);
