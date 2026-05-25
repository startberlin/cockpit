import db from "@/db";
import MandateSetupNeededEmail from "@/emails/membership/payment/mandate-setup-needed";
import { env } from "@/env";
import { sendEmail } from "@/lib/email";
import { events, inngest } from "@/lib/inngest";
import { track } from "@/lib/posthog-server";
import {
  notifyUntil,
  REMINDER_INTERVAL_DAYS,
  REMINDER_TOTAL_DAYS,
} from "./lib/step-loops";

// Sends the initial "set up your direct debit" email immediately, then nudges
// every 3 days until mandate.activated fires or 90 days elapse. Idempotent on
// `userId` so back-to-back activations (e.g. reconfirmation after admission)
// collapse to a single outstanding loop.
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

    return notifyUntil(step, {
      id: "mandate-setup",
      terminateOn: {
        eventName: events.mandateActivated.name,
        match: "userId",
      },
      timeoutDays: REMINDER_TOTAL_DAYS,
      remindEveryDays: REMINDER_INTERVAL_DAYS,
      send: async (index) => {
        const u = await db.query.user.findFirst({
          where: (uu, { eq }) => eq(uu.id, userId),
          columns: { email: true, firstName: true, gocardlessMandateId: true },
        });
        if (!u?.email || u.gocardlessMandateId) return;
        await sendEmail({
          from: "START Berlin <no-reply@notification.cockpit.start-berlin.com>",
          to: u.email,
          subject:
            index === 0
              ? "Set up your direct debit for START Berlin membership"
              : "Reminder: set up your START Berlin direct debit",
          react: MandateSetupNeededEmail({
            firstName: u.firstName ?? "",
            membershipUrl: `${env.NEXT_PUBLIC_COCKPIT_URL}/membership`,
            isReminder: index > 0,
          }),
        });

        track({
          distinctId: userId,
          event: "workflow_email_sent",
          properties: {
            email_type: "mandate_setup_reminder",
            subject_id: userId,
          },
        });
      },
    });
  },
);
