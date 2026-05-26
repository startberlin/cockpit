import db from "@/db";
import ReconfirmationAbandonmentReminderEmail from "@/emails/membership/admission/reconfirmation-abandonment-reminder";
import { env } from "@/env";
import { sendEmail } from "@/lib/email";
import { events, inngest } from "@/lib/inngest";
import { track } from "@/lib/posthog-server";

const INACTIVE_STATUSES: readonly string[] = ["cancelled", "alumni"];

// One-shot 1h nudge after a user finishes profile onboarding. If they still
// have a reconfirmation pending after 1h, send a single reminder email.
//
// Idempotent per userId so duplicate completion events (e.g. the user
// re-completes profile onboarding because we added a new required field)
// collapse to one outstanding loop. Even if a second event slips past
// idempotency, the send-time guard below re-validates that the user actually
// has something to reconfirm before emailing — an already-active member with
// nothing pending gets nothing.
export const quickReconfirmationReminderWorkflow = inngest.createFunction(
  {
    id: "quick-reconfirmation-reminder-workflow",
    name: "Quick Reconfirmation Reminder Workflow",
    triggers: [{ event: events.profileOnboardingCompleted }],
    idempotency: "event.data.userId",
    cancelOn: [
      {
        event: events.reconfirmationSubmitted.name,
        if: "async.data.userId == event.data.userId",
      },
      {
        event: events.cancellationRequested.name,
        if: "async.data.userId == event.data.userId",
      },
    ],
  },
  async ({ event, step }) => {
    const { userId } = event.data;

    await step.sleep("wait-1h", "1h");

    await step.run("send-reconfirmation-reminder", async () => {
      const u = await db.query.user.findFirst({
        where: (uu, { eq }) => eq(uu.id, userId),
        columns: {
          email: true,
          firstName: true,
          status: true,
          legalMembershipState: true,
        },
      });
      if (!u?.email) return;
      if (u.status && INACTIVE_STATUSES.includes(u.status)) return;
      // If the user is already an active legal member there is nothing to
      // reconfirm — even if a stale `membership_reconfirmation_pending` row
      // somehow exists alongside the active tenure, do not nudge them.
      if (u.legalMembershipState === "active_member") return;

      const lm = await db.query.legalMembership.findFirst({
        where: (l, { and, eq }) =>
          and(
            eq(l.userId, userId),
            eq(l.status, "membership_reconfirmation_pending"),
          ),
        columns: { id: true },
      });
      if (!lm) return;

      await sendEmail({
        from: "START Berlin <no-reply@notification.cockpit.start-berlin.com>",
        to: u.email,
        subject: "Confirm your START Berlin membership",
        react: ReconfirmationAbandonmentReminderEmail({
          firstName: u.firstName ?? "",
          reconfirmationUrl: `${env.NEXT_PUBLIC_COCKPIT_URL}/membership`,
        }),
      });

      track({
        distinctId: userId,
        event: "workflow_email_sent",
        properties: {
          email_type: "reconfirmation_abandonment_reminder",
          subject_id: userId,
        },
      });
    });
  },
);
