import db from "@/db";
import MandateCancelledEmail from "@/emails/membership/payment/mandate-cancelled";
import { env } from "@/env";
import { sendEmail } from "@/lib/email";
import { events, inngest } from "@/lib/inngest";

const TOTAL_DAYS = 90;
const INTERVAL_DAYS = 3;

// Sends the initial "your direct debit was cancelled" email when GoCardless
// invalidates a mandate, then nudges every 3 days while the user remains
// active without a replacement mandate.
export const mandateFixReminderWorkflow = inngest.createFunction(
  {
    id: "mandate-fix-reminder-workflow",
    name: "Mandate Fix Reminder Workflow",
    triggers: [{ event: events.mandateInvalidated }],
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

    const initial = await step.run("send-initial-email", async () => {
      const u = await db.query.user.findFirst({
        where: (uu, { eq }) => eq(uu.id, userId),
        columns: { email: true, firstName: true, status: true },
      });

      if (!u?.email) return { sent: false };

      if (
        u.status === "alumni" ||
        u.status === "supporting_alumni" ||
        u.status === "cancelled"
      ) {
        return { sent: false };
      }

      await sendEmail({
        from: "START Berlin <notifications@cockpit.start-berlin.com>",
        to: u.email,
        subject:
          "Action needed: set up your direct debit for START Berlin membership",
        react: MandateCancelledEmail({
          firstName: u.firstName ?? "",
          membershipUrl: `${env.NEXT_PUBLIC_COCKPIT_URL}/membership`,
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
      await step.run(`send-reminder-${elapsed}d`, async () => {
        await sendEmail({
          from: "START Berlin <notifications@cockpit.start-berlin.com>",
          to: checkpoint.email!,
          subject: "Reminder: set up your START Berlin direct debit again",
          react: MandateCancelledEmail({
            firstName: checkpoint.firstName ?? "",
            membershipUrl: `${env.NEXT_PUBLIC_COCKPIT_URL}/membership`,
            isReminder: true,
          }),
        });
      });
    }

    return { outcome: "timeout" as const, elapsed };
  },
);
