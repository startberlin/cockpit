import { eq } from "drizzle-orm";
import db from "@/db";
import {
  getApprovalRecipients,
  getFyiRecipients,
  getPositionAssignments,
} from "@/db/authority";
import { session, user } from "@/db/schema/auth";
import { legalMembership } from "@/db/schema/legal-membership";
import { membershipTransitionRequest } from "@/db/schema/membership-transition-request";
import MembershipCancellationAcknowledgementNeededEmail from "@/emails/membership/cancellation/membership-cancellation-acknowledgement-needed";
import MembershipCancelledEmail from "@/emails/membership/cancellation/membership-cancelled";
import MembershipTerminationFyiEmail from "@/emails/membership/cancellation/membership-termination-fyi";
import { env } from "@/env";
import { writeAuditLog } from "@/lib/audit-log";
import { DEPARTMENT_NAMES } from "@/lib/departments";
import { sendEmail } from "@/lib/email";
import { cancelMembershipMandate } from "@/lib/gocardless/membership-cancellation";
import {
  deleteWorkspaceUser,
  suspendWorkspaceUser,
} from "@/lib/google-workspace/directory";
import { events, inngest } from "@/lib/inngest";
import { archiveLegalDocument } from "@/lib/legal-documents/drive-archive";
import { renderMembershipTransitionTemplate } from "@/lib/legal-documents/templates/membership-transition";
import { track } from "@/lib/posthog-server";
import { notifyUntil } from "./lib/step-loops";

export const membershipCancellationWorkflow = inngest.createFunction(
  {
    id: "membership-cancellation-workflow",
    name: "Membership Cancellation Workflow",
    triggers: [{ event: events.cancellationRequested }],
    cancelOn: [
      {
        event: events.cancellationRetracted.name,
        if: "async.data.transitionRequestId == event.data.transitionRequestId",
      },
    ],
  },
  async ({ event, step }) => {
    const { userId, transitionRequestId, requiresAcknowledgement, reason } =
      event.data;

    // Step 1: Read and cache user data before any mutations.
    const userData = await step.run("read-user-data", async () => {
      const userRecord = await db.query.user.findFirst({
        where: (u, { eq: eqFn }) => eqFn(u.id, userId),
        columns: {
          firstName: true,
          lastName: true,
          email: true,
          personalEmail: true,
          gocardlessMandateId: true,
          department: true,
        },
      });

      if (!userRecord) {
        throw new Error(`User not found: ${userId}`);
      }

      const lm = await db.query.legalMembership.findFirst({
        where: (l, { eq: eqFn, and, inArray }) =>
          and(
            eqFn(l.userId, userId),
            inArray(l.status, [
              "active",
              "admission_pending",
              "application_pending",
              "membership_reconfirmation_pending",
            ]),
          ),
        columns: { id: true },
      });

      return {
        firstName: userRecord.firstName,
        lastName: userRecord.lastName,
        personalEmail: userRecord.personalEmail,
        startEmail: userRecord.email,
        mandateId: userRecord.gocardlessMandateId,
        department: userRecord.department,
        legalMembershipId: lm?.id ?? null,
      };
    });

    // Step 2: Acknowledgement step (self-service cancellations only).
    if (requiresAcknowledgement) {
      const subjectName = `${userData.firstName} ${userData.lastName}`.trim();
      const requestedAt = new Date().toISOString().substring(0, 10);

      const sendAckEmails = async (
        opts: { isReminder: boolean } = { isReminder: false },
      ) => {
        const positions = await getPositionAssignments();
        const recipients = getApprovalRecipients(
          positions,
          userId,
          userData.department,
        );
        // Non-board recipients can only be the dept head of the subject's
        // department (per getFyiRecipients), so department is non-null here.
        const subjectDepartmentLabel = userData.department
          ? DEPARTMENT_NAMES[userData.department]
          : null;
        const boardMemberIds = new Set(
          [
            positions.president,
            positions.vice_president,
            positions.head_of_finance,
          ].flatMap((p) => (p ? [p.userId] : [])),
        );

        const subjectPrefix = opts.isReminder ? "Reminder: " : "";
        await Promise.all(
          recipients
            .filter((r) => r.email)
            .map((recipient) =>
              sendEmail({
                from: "START Berlin <no-reply@notification.cockpit.start-berlin.com>",
                to: recipient.email!,
                subject: `${subjectPrefix}Action required: acknowledge ${subjectName}'s membership cancellation`,
                react: MembershipCancellationAcknowledgementNeededEmail({
                  firstName: recipient.firstName,
                  subjectName,
                  requestedAt,
                  profileUrl: `${env.NEXT_PUBLIC_COCKPIT_URL}/admin/people/${userId}`,
                  receivingReason: boardMemberIds.has(recipient.userId)
                    ? "You're receiving this because you're a board member of START Berlin."
                    : `You're receiving this because you're the department head of ${subjectDepartmentLabel}.`,
                  isReminder: opts.isReminder,
                }),
              }),
            ),
        );
      };

      await notifyUntil(step, {
        id: "acknowledgement",
        terminateOn: {
          eventName: events.cancellationAcknowledged.name,
          match: "transitionRequestId",
        },
        timeoutDays: 7,
        remindEveryDays: 3,
        send: (index) => sendAckEmails({ isReminder: index > 0 }),
      });
    }

    // Read user state before cancellation for replay-safe before/after diff.
    const userBeforeCancellation = await step.run(
      "read-user-state-before-cancellation",
      async () => {
        const u = await db.query.user.findFirst({
          where: (u, { eq: eqFn }) => eqFn(u.id, userId),
          columns: { status: true, department: true, batchNumber: true },
        });
        return {
          status: u?.status ?? null,
          department: u?.department ?? null,
          batchNumber: u?.batchNumber ?? null,
        };
      },
    );

    // Step 3: Atomic cancellation transaction.
    await step.run("execute-cancellation-transaction", async () => {
      await db.transaction(async (tx) => {
        if (userData.legalMembershipId) {
          await tx
            .update(legalMembership)
            .set({ status: "cancelled", endedAt: new Date() })
            .where(eq(legalMembership.id, userData.legalMembershipId));
        }

        await tx
          .update(user)
          .set({ legalMembershipState: "former_member", status: "cancelled" })
          .where(eq(user.id, userId));

        await tx.delete(session).where(eq(session.userId, userId));
      });
    });

    await step.run("write-audit-log-cancelled", async () => {
      const subjectName =
        `${userData.firstName} ${userData.lastName}`.trim() || userId;
      await writeAuditLog({
        category: "membership",
        eventType: "membership.cancelled",
        subject: { id: userId, name: subjectName },
        metadata: {
          legalMembershipId: userData.legalMembershipId,
          reason,
        },
        description:
          reason === "removed_by_board" ? "Removed by board" : "Self-requested",
      });
    });

    // Step 4: Suspend Google Workspace account.
    if (userData.startEmail) {
      await step.run("suspend-google-account", async () => {
        await suspendWorkspaceUser(userData.startEmail!);
      });
    }

    // Step 5: Cancel GoCardless mandate.
    if (userData.mandateId) {
      await step.run("cancel-gocardless-mandate", async () => {
        await cancelMembershipMandate(userData.mandateId!);
        await db
          .update(user)
          .set({
            gocardlessMandateId: null,
            gocardlessCustomerId: null,
            gocardlessSetupSessionId: null,
          })
          .where(eq(user.id, userId));
      });
    }

    // Step 6: Generate and archive transition PDF.
    await step.run("generate-and-archive-pdf", async () => {
      const { renderToBuffer } = await import("@react-pdf/renderer");
      const pdfBuffer = await renderToBuffer(
        renderMembershipTransitionTemplate({
          legalMembershipId: userData.legalMembershipId ?? "unknown",
          firstName: userData.firstName,
          lastName: userData.lastName,
          transitionType: "cancelled",
          transitionDate: new Date(),
          reason,
          renderedAt: new Date(),
        }),
      );

      if (userData.legalMembershipId) {
        await archiveLegalDocument({
          legalMembershipId: userData.legalMembershipId,
          buffer: Buffer.from(pdfBuffer),
          fileName: `membership-cancellation-${userData.legalMembershipId}.pdf`,
          firstName: userData.firstName,
          lastName: userData.lastName,
        });
      }
    });

    // Step 7: Send confirmation email to cached personal email.
    if (userData.personalEmail) {
      await step.run("send-cancellation-email", async () => {
        await sendEmail({
          from: "START Berlin <no-reply@notification.cockpit.start-berlin.com>",
          to: userData.personalEmail!,
          subject:
            reason === "removed_by_board"
              ? "Your START Berlin membership has been terminated"
              : "Your START Berlin membership has ended",
          react: MembershipCancelledEmail({
            firstName: userData.firstName,
            keepInTouch: false,
            reason,
          }),
        });
      });

      await step.run("capture-analytics-cancellation-email", async () => {
        track({
          distinctId: userId,
          event: "workflow_email_sent",
          properties: {
            email_type: "membership_cancelled",
            subject_id: userId,
          },
        });
      });
    }

    // Step 8: Notify board and department head that the membership has ended.
    // Per-recipient failures must not block downstream cleanup steps.
    await step.run("send-internal-fyi", async () => {
      const positions = await getPositionAssignments();
      const recipients = getFyiRecipients(
        positions,
        userId,
        userData.department,
      );
      const subjectName = `${userData.firstName} ${userData.lastName}`.trim();
      const terminatedOn = new Date().toISOString().substring(0, 10);
      // Non-board recipients can only be the dept head of the subject's
      // department (per getFyiRecipients), so department is non-null here.
      const subjectDepartmentLabel = userData.department
        ? DEPARTMENT_NAMES[userData.department]
        : null;
      const boardMemberIds = new Set(
        [
          positions.president,
          positions.vice_president,
          positions.head_of_finance,
        ].flatMap((p) => (p ? [p.userId] : [])),
      );

      const results = await Promise.allSettled(
        recipients
          .filter((r) => r.email)
          .map((recipient) =>
            sendEmail({
              from: "START Berlin <no-reply@notification.cockpit.start-berlin.com>",
              to: recipient.email!,
              subject: `FYI: ${subjectName}'s START Berlin membership has ended`,
              react: MembershipTerminationFyiEmail({
                firstName: recipient.firstName,
                subjectName,
                terminatedOn,
                context: reason,
                receivingReason: boardMemberIds.has(recipient.userId)
                  ? "You're receiving this because you're a board member of START Berlin."
                  : `You're receiving this because you're the department head of ${subjectDepartmentLabel}.`,
              }),
            }),
          ),
      );

      for (const r of results) {
        if (r.status === "rejected") {
          console.error("[send-internal-fyi] email send failed", r.reason);
        }
      }
    });

    // Step 10: Fire group reconciliation to remove from all Google groups.
    await step.sendEvent("fire-group-reconciliation", {
      name: events.cockpitUserUpdated.name,
      data: { id: userId },
    });

    await step.sendEvent("sync-system-groups-after-cancellation", {
      name: events.userSystemGroupsSync.name,
      data: {
        userId,
        before: userBeforeCancellation,
        after: {
          status: "cancelled",
          department: userBeforeCancellation.department,
          batchNumber: userBeforeCancellation.batchNumber,
        },
      },
    });

    // Step 11: Erase personal data and mark request executed.
    await step.run("erase-personal-data", async () => {
      await db
        .update(user)
        .set({
          personalEmail: null,
          phone: null,
          street: null,
          city: null,
          state: null,
          zip: null,
          country: null,
          birthDate: null,
          department: null,
          memberSinceDate: null,
        })
        .where(eq(user.id, userId));

      await db
        .update(membershipTransitionRequest)
        .set({ status: "executed" })
        .where(eq(membershipTransitionRequest.id, transitionRequestId));
    });

    // Step 12: Wait 7 days before hard-deleting the workspace account.
    await step.sleep("wait-7d-before-deletion", "7d");

    // Step 13: Hard-delete Google Workspace account.
    if (userData.startEmail) {
      await step.run("hard-delete-google-account", async () => {
        await deleteWorkspaceUser(userData.startEmail!);
      });
    }

    // Step 14: Null the start (START Berlin) email.
    await step.run("null-start-email", async () => {
      await db.update(user).set({ email: null }).where(eq(user.id, userId));
    });
  },
);
