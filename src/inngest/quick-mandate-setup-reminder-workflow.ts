import db from "@/db";
import MandateSetupAbandonmentReminderEmail from "@/emails/membership/payment/mandate-setup-abandonment-reminder";
import { env } from "@/env";
import { sendEmail } from "@/lib/email";
import { events, inngest } from "@/lib/inngest";
import { track } from "@/lib/posthog-server";

// One-shot 30min nudge for users whose membership just activated but who
// haven't authorized the direct debit. Runs alongside the longer-tail
// mandateSetupReminderWorkflow, which keeps sending reminders on a 3-day
// cadence. Idempotent per userId.
export const quickMandateSetupReminderWorkflow = inngest.createFunction(
  {
    id: "quick-mandate-setup-reminder-workflow",
    name: "Quick Mandate Setup Reminder Workflow",
    triggers: [{ event: events.mandateSetupNeeded }],
    idempotency: "event.data.userId",
    cancelOn: [
      {
        event: events.mandateActivated.name,
        if: "async.data.userId == event.data.userId",
      },
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

    await step.sleep("wait-30m", "30m");

    await step.run("send-mandate-setup-reminder", async () => {
      const u = await db.query.user.findFirst({
        where: (uu, { eq }) => eq(uu.id, userId),
        columns: {
          email: true,
          firstName: true,
          gocardlessMandateId: true,
        },
      });
      if (!u?.email || u.gocardlessMandateId) return;

      await sendEmail({
        from: "START Berlin <no-reply@notification.cockpit.start-berlin.com>",
        to: u.email,
        subject: "One last step to activate your START Berlin membership",
        react: MandateSetupAbandonmentReminderEmail({
          firstName: u.firstName ?? "",
          membershipUrl: `${env.NEXT_PUBLIC_COCKPIT_URL}/membership`,
        }),
      });

      track({
        distinctId: userId,
        event: "workflow_email_sent",
        properties: {
          email_type: "mandate_setup_abandonment_reminder",
          subject_id: userId,
        },
      });
    });
  },
);
