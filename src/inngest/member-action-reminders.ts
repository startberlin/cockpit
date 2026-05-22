import {
  actionKey,
  computeOpenActions,
  deleteClosedReminders,
  insertReminderObservations,
  loadAllReminders,
  markReminderSent,
  type OpenAction,
} from "@/db/member-action-reminders";
import BoardResolutionTaskAssignedEmail from "@/emails/board-resolution/board-resolution-task-assigned";
import MembershipApplicationReadyEmail from "@/emails/membership/admission/membership-application-ready";
import MembershipCancellationAcknowledgementNeededEmail from "@/emails/membership/cancellation/membership-cancellation-acknowledgement-needed";
import MandateCancelledEmail from "@/emails/membership/payment/mandate-cancelled";
import MandateSetupNeededEmail from "@/emails/membership/payment/mandate-setup-needed";
import MembershipTransitionApprovalNeededEmail from "@/emails/membership/transition/membership-transition-approval-needed";
import { env } from "@/env";
import { sendEmail } from "@/lib/email";
import { inngest } from "@/lib/inngest";

const REMINDER_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

export const memberActionRemindersCron = inngest.createFunction(
  {
    id: "member-action-reminders",
    name: "Member Action Reminders (Daily)",
    triggers: [{ cron: "TZ=Europe/Berlin 0 10 * * *" }],
  },
  async ({ step }) => {
    const openActions = await step.run("compute-open-actions", () =>
      computeOpenActions(),
    );

    // Phase 1: insert tracking rows for newly observed (recipient, action, subject) tuples.
    // First observation never sends an email; that enforces the 3-day cooldown
    // after the initial workflow-driven email.
    const observed = await step.run("upsert-observed", () =>
      insertReminderObservations(
        openActions.map((a) => ({
          recipientUserId: a.recipientUserId,
          actionType: a.actionType,
          subjectId: a.subjectId,
        })),
      ),
    );

    // Phase 2: re-load the reminder table so we have lastReminderAt for every action.
    // Inngest serializes step.run return values to JSON, so Date columns come back
    // as strings — convert at the boundary.
    const rawReminders = await step.run("load-reminders", () =>
      loadAllReminders(),
    );
    const reminders = rawReminders.map((r) => ({
      ...r,
      firstObservedAt: new Date(r.firstObservedAt),
      lastReminderAt: new Date(r.lastReminderAt),
    }));
    const reminderByKey = new Map(reminders.map((r) => [actionKey(r), r]));

    // Phase 3: for each currently-open action that has a row at least 3 days old,
    // send the reminder and bump lastReminderAt.
    const now = Date.now();
    let sentCount = 0;

    for (const action of openActions) {
      const row = reminderByKey.get(actionKey(action));
      if (!row) continue; // freshly inserted this run
      if (now - row.lastReminderAt.getTime() < REMINDER_COOLDOWN_MS) continue;

      const daysOpen = Math.max(
        1,
        Math.floor((now - row.firstObservedAt.getTime()) / 86_400_000),
      );

      await step.run(`send-${row.id}`, async () => {
        await sendReminderEmail(action, daysOpen);
        await markReminderSent(row.id);
      });

      sentCount++;
    }

    // Phase 4: garbage-collect rows whose underlying action has resolved.
    const openKeys = new Set(openActions.map(actionKey));
    const deleted = await step.run("cleanup-closed", () =>
      deleteClosedReminders(openKeys),
    );

    if (env.BETTERSTACK_HEARTBEAT_URL) {
      await step.run("send-heartbeat", async () => {
        await fetch(env.BETTERSTACK_HEARTBEAT_URL as string);
      });
    }

    return {
      open: openActions.length,
      newlyObserved: observed,
      remindersSent: sentCount,
      closed: deleted,
    };
  },
);

async function sendReminderEmail(
  action: OpenAction,
  daysOpen: number,
): Promise<void> {
  const baseUrl = env.NEXT_PUBLIC_COCKPIT_URL;

  switch (action.actionType) {
    case "complete_application": {
      await sendEmail({
        from: "START Berlin <notifications@cockpit.start-berlin.com>",
        to: action.recipientEmail,
        subject: "Reminder: complete your START Berlin membership application",
        react: MembershipApplicationReadyEmail({
          firstName: action.recipientFirstName,
          applicationUrl: `${baseUrl}/membership`,
          isReminder: true,
          daysOpen,
        }),
      });
      return;
    }
    case "reconfirm_membership": {
      await sendEmail({
        from: "START Berlin <notifications@cockpit.start-berlin.com>",
        to: action.recipientEmail,
        subject: "Reminder: confirm your START Berlin membership",
        react: MembershipApplicationReadyEmail({
          firstName: action.recipientFirstName,
          applicationUrl: `${baseUrl}/membership`,
          isReminder: true,
          daysOpen,
        }),
      });
      return;
    }
    case "setup_mandate": {
      await sendEmail({
        from: "START Berlin <notifications@cockpit.start-berlin.com>",
        to: action.recipientEmail,
        subject: "Reminder: set up your START Berlin direct debit",
        react: MandateSetupNeededEmail({
          firstName: action.recipientFirstName,
          membershipUrl: `${baseUrl}/membership`,
          isReminder: true,
          daysOpen,
        }),
      });
      return;
    }
    case "fix_mandate": {
      await sendEmail({
        from: "START Berlin <notifications@cockpit.start-berlin.com>",
        to: action.recipientEmail,
        subject: "Reminder: set up your START Berlin direct debit again",
        react: MandateCancelledEmail({
          firstName: action.recipientFirstName,
          membershipUrl: `${baseUrl}/membership`,
          isReminder: true,
          daysOpen,
        }),
      });
      return;
    }
    case "acknowledge_cancellation": {
      await sendEmail({
        from: "START Berlin <notifications@cockpit.start-berlin.com>",
        to: action.recipientEmail,
        subject: `Reminder: acknowledge ${action.subjectName}'s membership cancellation`,
        react: MembershipCancellationAcknowledgementNeededEmail({
          firstName: action.recipientFirstName,
          subjectName: action.subjectName,
          requestedAt: action.requestedAt,
          profileUrl: `${baseUrl}/admin/people/directory/${action.subjectUserId}`,
          receivingReason: action.receivingReason,
          isReminder: true,
          daysOpen,
        }),
      });
      return;
    }
    case "decide_transition": {
      const label =
        action.transitionType === "alumni_request"
          ? "alumni"
          : "supporting alumni";
      await sendEmail({
        from: "START Berlin <notifications@cockpit.start-berlin.com>",
        to: action.recipientEmail,
        subject: `Reminder: review ${action.subjectName}'s transition to ${label}`,
        react: MembershipTransitionApprovalNeededEmail({
          firstName: action.recipientFirstName,
          subjectName: action.subjectName,
          transitionType: action.transitionType,
          requestedAt: action.requestedAt,
          profileUrl: `${baseUrl}/admin/people/directory/${action.subjectUserId}`,
          receivingReason: action.receivingReason,
          isReminder: true,
          daysOpen,
        }),
      });
      return;
    }
    case "vote_admission": {
      await sendEmail({
        from: "START Berlin <notifications@cockpit.start-berlin.com>",
        to: action.recipientEmail,
        subject: `Reminder: vote on ${action.subjectName}'s membership`,
        react: BoardResolutionTaskAssignedEmail({
          firstName: action.recipientFirstName,
          subjectName: action.subjectName,
          resolutionUrl: `${baseUrl}/people/resolutions/${action.subjectId}`,
          isReminder: true,
          daysOpen,
        }),
      });
      return;
    }
  }
}
