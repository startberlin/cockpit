import db from "@/db";
import MandateCancelledEmail from "@/emails/membership/payment/mandate-cancelled";
import { env } from "@/env";
import { sendEmail } from "@/lib/email";
import { events, inngest } from "@/lib/inngest";
import {
  notifyUntil,
  REMINDER_INTERVAL_DAYS,
  REMINDER_TOTAL_DAYS,
} from "./lib/step-loops";

// Sends the initial "your direct debit was cancelled" email when GoCardless
// invalidates a mandate, then nudges every 3 days until mandate.activated fires
// or 90 days elapse.
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

    return notifyUntil(step, {
      id: "mandate-fix",
      terminateOn: {
        eventName: events.mandateActivated.name,
        match: "userId",
      },
      timeoutDays: REMINDER_TOTAL_DAYS,
      remindEveryDays: REMINDER_INTERVAL_DAYS,
      send: async (index) => {
        const u = await db.query.user.findFirst({
          where: (uu, { eq }) => eq(uu.id, userId),
          columns: { email: true, firstName: true },
        });
        if (!u?.email) return;
        await sendEmail({
          from: "START Berlin <no-reply@notification.cockpit.start-berlin.com>",
          to: u.email,
          subject:
            index === 0
              ? "Action needed: set up your direct debit for START Berlin membership"
              : "Reminder: set up your START Berlin direct debit again",
          react: MandateCancelledEmail({
            firstName: u.firstName ?? "",
            membershipUrl: `${env.NEXT_PUBLIC_COCKPIT_URL}/membership`,
            isReminder: index > 0,
          }),
        });
      },
    });
  },
);
