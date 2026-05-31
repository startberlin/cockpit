import db from "@/db";
import StartCockpitEnabledEmail from "@/emails/auth/start-cockpit-enabled";
import MembershipApplicationReadyEmail from "@/emails/membership/admission/membership-application-ready";
import { env } from "@/env";
import { sendEmail } from "@/lib/email";
import { events, inngest } from "@/lib/inngest";
import { track } from "@/lib/posthog-server";
import { getOnboardingProgress } from "@/schema/onboarding-progress";
import { notifyUntil, REMINDER_TOTAL_DAYS } from "./lib/step-loops";

// supporting_alumni intentionally excluded: they also need to reconfirm their
// membership, so they should keep receiving reminders.
const INACTIVE_STATUSES: readonly string[] = ["cancelled", "alumni"];

// Every 3 days until reconfirmation.submitted: if the user hasn't logged in yet
// send a "sign in" nudge, otherwise send a reconfirmation reminder.
const REMINDER_INTERVAL_DAYS = 7;

// Fires immediately (index 0), then nudges every 3 days on the same branch
// logic until reconfirmation.submitted fires or 90 days elapse.
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

    return notifyUntil(step, {
      id: "reconfirmation",
      terminateOn: {
        eventName: events.reconfirmationSubmitted.name,
        match: "legalMembershipId",
      },
      timeoutDays: REMINDER_TOTAL_DAYS,
      remindEveryDays: REMINDER_INTERVAL_DAYS,
      send: async (index) => {
        const lm = await db.query.legalMembership.findFirst({
          where: (l, { eq }) => eq(l.id, legalMembershipId),
          columns: { status: true },
        });

        if (!lm || lm.status !== "membership_reconfirmation_pending") return;

        const u = await db.query.user.findFirst({
          where: (uu, { eq }) => eq(uu.id, userId),
          columns: {
            email: true,
            firstName: true,
            status: true,
            personalEmail: true,
            phone: true,
            birthDate: true,
            eventEmailPreference: true,
          },
        });

        if (!u?.email) return;
        if (u.status && INACTIVE_STATUSES.includes(u.status)) return;

        const onboarded = getOnboardingProgress(u) === "completed";

        if (onboarded) {
          await sendEmail({
            from: "START Berlin <no-reply@notification.cockpit.start-berlin.com>",
            to: u.email,
            subject:
              index === 0
                ? "Complete your START Berlin membership application"
                : "Reminder: confirm your START Berlin membership",
            react: MembershipApplicationReadyEmail({
              firstName: u.firstName ?? "",
              applicationUrl: `${env.NEXT_PUBLIC_COCKPIT_URL}/membership`,
              isReminder: index > 0,
            }),
          });
        } else {
          await sendEmail({
            from: "START Berlin <no-reply@notification.cockpit.start-berlin.com>",
            to: u.email,
            subject:
              index === 0
                ? "Your START Cockpit access is ready"
                : "Reminder: sign in to START Cockpit",
            react: StartCockpitEnabledEmail({
              firstName: u.firstName ?? "",
              isReminder: index > 0,
            }),
          });
        }

        track({
          distinctId: userId,
          event: "workflow_email_sent",
          properties: {
            email_type: "reconfirmation_reminder",
            subject_id: userId,
          },
        });
      },
    });
  },
);
