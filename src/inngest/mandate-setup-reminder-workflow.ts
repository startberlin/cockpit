import db from "@/db";
import MandateSetupNeededEmail from "@/emails/membership/payment/mandate-setup-needed";
import { env } from "@/env";
import { sendEmail } from "@/lib/email";
import { events, inngest } from "@/lib/inngest";

const TOTAL_DAYS = 90;
const INTERVAL_DAYS = 3;

// Sends a "set up your direct debit" reminder every 3 days while a newly-active
// member still lacks a mandate. Idempotent on `userId` so back-to-back
// activations (e.g. reconfirmation after admission) collapse to a single
// outstanding loop.
export const mandateSetupReminderWorkflow = inngest.createFunction(
  {
    id: "mandate-setup-reminder-workflow",
    name: "Mandate Setup Reminder Workflow",
    triggers: [{ event: events.mandateSetupNeeded }],
    idempotency: "event.data.userId",
    cancelOn: [
      {
        event: events.cancellationRequested.name,
        if: "async.data.userId == event.data.userId",
      },
      {
        event: events.transitionRequested.name,
        if: "async.data.userId == event.data.userId",
      },
    ],
  },
  async ({ event, step }) => {
    const { userId } = event.data;

    let elapsed = 0;
    while (elapsed < TOTAL_DAYS) {
      const wait = Math.min(INTERVAL_DAYS, TOTAL_DAYS - elapsed);
      await step.sleep(`sleep-${elapsed}d`, `${wait}d`);
      elapsed += wait;

      const checkpoint = await step.run(`check-${elapsed}d`, async () => {
        const u = await db.query.user.findFirst({
          where: (uu, { eq }) => eq(uu.id, userId),
          columns: {
            email: true,
            firstName: true,
            gocardlessMandateId: true,
            status: true,
          },
        });
        if (!u) return { outcome: "user_missing" as const };
        if (u.gocardlessMandateId) return { outcome: "resolved" as const };
        if (
          u.status === "alumni" ||
          u.status === "supporting_alumni" ||
          u.status === "cancelled"
        ) {
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

      if (!checkpoint.email) continue;
      const daysOpen = elapsed;
      await step.run(`send-reminder-${elapsed}d`, async () => {
        await sendEmail({
          from: "START Berlin <notifications@cockpit.start-berlin.com>",
          to: checkpoint.email!,
          subject: "Reminder: set up your START Berlin direct debit",
          react: MandateSetupNeededEmail({
            firstName: checkpoint.firstName ?? "",
            membershipUrl: `${env.NEXT_PUBLIC_COCKPIT_URL}/membership`,
            isReminder: true,
            daysOpen,
          }),
        });
      });
    }

    return { outcome: "timeout" as const, elapsed };
  },
);
