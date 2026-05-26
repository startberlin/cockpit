import db from "@/db";
import ApplicationResumeReminderEmail from "@/emails/membership/admission/application-resume-reminder";
import { env } from "@/env";
import { sendEmail } from "@/lib/email";
import { events, inngest } from "@/lib/inngest";
import { track } from "@/lib/posthog-server";

const INACTIVE_STATUSES: readonly string[] = ["cancelled", "alumni"];

// One-shot 30min nudge for users who started filling in their membership
// application or reconfirmation but didn't submit. Fires from the first
// draft save; idempotent per legalMembershipId so subsequent step saves
// don't enqueue extra reminders.
export const applicationResumeReminderWorkflow = inngest.createFunction(
  {
    id: "application-resume-reminder-workflow",
    name: "Application Resume Reminder Workflow",
    triggers: [{ event: events.applicationDraftStarted }],
    idempotency: "event.data.legalMembershipId",
    cancelOn: [
      {
        event: events.applicationSubmitted.name,
        if: "async.data.legalMembershipId == event.data.legalMembershipId",
      },
      {
        event: events.reconfirmationSubmitted.name,
        if: "async.data.legalMembershipId == event.data.legalMembershipId",
      },
      {
        event: events.cancellationRequested.name,
        if: "async.data.userId == event.data.userId",
      },
    ],
  },
  async ({ event, step }) => {
    const { userId, legalMembershipId } = event.data;

    await step.sleep("wait-30m", "30m");

    await step.run("send-application-resume-reminder", async () => {
      const u = await db.query.user.findFirst({
        where: (uu, { eq }) => eq(uu.id, userId),
        columns: { email: true, firstName: true, status: true },
      });
      if (!u?.email) return;
      if (u.status && INACTIVE_STATUSES.includes(u.status)) return;

      const lm = await db.query.legalMembership.findFirst({
        where: (l, { eq }) => eq(l.id, legalMembershipId),
        columns: { status: true },
      });
      if (
        !lm ||
        (lm.status !== "application_pending" &&
          lm.status !== "membership_reconfirmation_pending")
      ) {
        return;
      }

      const draft = await db.query.membershipApplication.findFirst({
        where: (ma, { eq }) => eq(ma.legalMembershipId, legalMembershipId),
        columns: { status: true },
      });
      if (!draft || draft.status !== "draft") return;

      const isReconfirmation =
        lm.status === "membership_reconfirmation_pending";

      await sendEmail({
        from: "START Berlin <no-reply@notification.cockpit.start-berlin.com>",
        to: u.email,
        subject: isReconfirmation
          ? "Finish reconfirming your START Berlin membership"
          : "Finish your START Berlin membership application",
        react: ApplicationResumeReminderEmail({
          firstName: u.firstName ?? "",
          applicationUrl: `${env.NEXT_PUBLIC_COCKPIT_URL}/membership`,
          isReconfirmation,
        }),
      });

      track({
        distinctId: userId,
        event: "workflow_email_sent",
        properties: {
          email_type: "application_resume_reminder",
          subject_id: userId,
        },
      });
    });
  },
);
