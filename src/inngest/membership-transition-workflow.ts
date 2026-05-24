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
import MembershipCancelledEmail from "@/emails/membership/cancellation/membership-cancelled";
import MembershipTerminationFyiEmail from "@/emails/membership/cancellation/membership-termination-fyi";
import MembershipSupportingAlumniConfirmedEmail from "@/emails/membership/transition/membership-supporting-alumni-confirmed";
import MembershipTransitionApprovalNeededEmail from "@/emails/membership/transition/membership-transition-approval-needed";
import MembershipTransitionRejectedEmail from "@/emails/membership/transition/membership-transition-rejected";
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
import { notifyUntil } from "./lib/step-loops";

export const membershipTransitionWorkflow = inngest.createFunction(
  {
    id: "membership-transition-workflow",
    name: "Membership Transition Workflow",
    triggers: [{ event: events.transitionRequested }],
    idempotency: "event.data.transitionRequestId",
    cancelOn: [
      {
        event: events.transitionRetracted.name,
        if: "async.data.transitionRequestId == event.data.transitionRequestId",
      },
    ],
  },
  async ({ event, step }) => {
    const { userId, transitionRequestId, type, keepPersonalEmail } = event.data;

    // Step 1: Read user data needed for execution.
    const requestData = await step.run("read-request-data", async () => {
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
          and(eqFn(l.userId, userId), inArray(l.status, ["active"])),
        columns: { id: true },
      });

      return {
        firstName: userRecord.firstName,
        lastName: userRecord.lastName,
        startEmail: userRecord.email,
        personalEmail: userRecord.personalEmail,
        mandateId: userRecord.gocardlessMandateId,
        department: userRecord.department,
        legalMembershipId: lm?.id ?? null,
      };
    });

    // Step 2: Notify board / department head that approval is required, then
    // wait for the decision with a 3-day reminder cadence (30-day total budget).
    const subjectName =
      `${requestData.firstName} ${requestData.lastName}`.trim() || userId;
    const requestedAt = new Date().toISOString().substring(0, 10);

    const sendApprovalEmails = async (
      opts: { isReminder: boolean } = { isReminder: false },
    ) => {
      const positions = await getPositionAssignments();
      const recipients = getApprovalRecipients(
        positions,
        userId,
        requestData.department,
      );
      // Non-board recipients can only be the dept head of the subject's
      // department (per getApprovalRecipients), so department is non-null here.
      const subjectDepartmentLabel = requestData.department
        ? DEPARTMENT_NAMES[requestData.department]
        : null;
      const boardMemberIds = new Set(
        [
          positions.president,
          positions.vice_president,
          positions.head_of_finance,
        ].flatMap((p) => (p ? [p.userId] : [])),
      );
      const label = type === "alumni_request" ? "alumni" : "supporting alumni";
      const subjectPrefix = opts.isReminder ? "Reminder: " : "";

      await Promise.all(
        recipients
          .filter((r) => r.email)
          .map((recipient) =>
            sendEmail({
              from: "START Berlin <no-reply@notification.cockpit.start-berlin.com>",
              to: recipient.email!,
              subject: `${subjectPrefix}Action required: review ${subjectName}'s transition to ${label}`,
              react: MembershipTransitionApprovalNeededEmail({
                firstName: recipient.firstName,
                subjectName,
                transitionType: type,
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

    const decisionEvent = (await notifyUntil(step, {
      id: "decision",
      terminateOn: {
        eventName: events.transitionDecided.name,
        match: "transitionRequestId",
      },
      timeoutDays: 30,
      remindEveryDays: 3,
      send: (index) => sendApprovalEmails({ isReminder: index > 0 }),
    })) as Awaited<ReturnType<typeof step.waitForEvent>> | null;

    // Step 3a: Timeout — mark expired and notify via START Berlin email.
    if (decisionEvent === null) {
      await step.run("mark-request-expired", async () => {
        await db
          .update(membershipTransitionRequest)
          .set({ status: "expired" })
          .where(eq(membershipTransitionRequest.id, transitionRequestId));
      });

      if (requestData.startEmail) {
        await step.run("send-expiry-notification", async () => {
          await sendEmail({
            from: "START Berlin <no-reply@notification.cockpit.start-berlin.com>",
            to: requestData.startEmail!,
            subject: "Your transition request was not approved at this time",
            react: MembershipTransitionRejectedEmail({
              firstName: requestData.firstName,
              transitionType: type,
            }),
          });
        });
      }

      return { outcome: "expired", transitionRequestId };
    }

    // Step 3b: Rejected — mark and notify via START Berlin email.
    if (decisionEvent.data.decision === "rejected") {
      await step.run("mark-request-rejected", async () => {
        await db
          .update(membershipTransitionRequest)
          .set({
            status: "expired",
            decidedAt: new Date(),
            decidedByUserId: decisionEvent.data.decidedByUserId,
          })
          .where(eq(membershipTransitionRequest.id, transitionRequestId));
      });

      if (requestData.startEmail) {
        await step.run("send-rejection-notification", async () => {
          await sendEmail({
            from: "START Berlin <no-reply@notification.cockpit.start-berlin.com>",
            to: requestData.startEmail!,
            subject: "Your transition request was not approved at this time",
            react: MembershipTransitionRejectedEmail({
              firstName: requestData.firstName,
              transitionType: type,
            }),
          });
        });
      }

      await step.run("write-audit-log-transition-rejected", async () => {
        await writeAuditLog({
          category: "membership",
          eventType: "membership.transition_rejected",
          subject: { id: userId, name: subjectName },
          metadata: { type, transitionRequestId },
          description:
            type === "alumni_request"
              ? "Alumni request"
              : "Supporting alumni request",
        });
      });

      return { outcome: "rejected", transitionRequestId };
    }

    // Step 4: Approved — execute based on type.
    if (type === "supporting_alumni_request") {
      // Read user state before the transition for replay-safe before/after diff.
      const userBeforeTransition = await step.run(
        "read-user-state-before-transition",
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

      // Supporting alumni: status change only, Google + mandate unchanged.
      await step.run("execute-supporting-alumni-transition", async () => {
        await db.transaction(async (tx) => {
          await tx
            .update(user)
            .set({ status: "supporting_alumni", department: null })
            .where(eq(user.id, userId));

          await tx
            .update(membershipTransitionRequest)
            .set({
              status: "executed",
              decidedAt: new Date(),
              decidedByUserId: decisionEvent.data.decidedByUserId,
            })
            .where(eq(membershipTransitionRequest.id, transitionRequestId));
        });
      });

      if (requestData.startEmail) {
        await step.run("send-supporting-alumni-confirmation", async () => {
          await sendEmail({
            from: "START Berlin <no-reply@notification.cockpit.start-berlin.com>",
            to: requestData.startEmail!,
            subject: "You're now a Supporting Alumni of START Berlin",
            react: MembershipSupportingAlumniConfirmedEmail({
              firstName: requestData.firstName,
            }),
          });
        });
      }

      await step.sendEvent("fire-group-reconciliation", {
        name: events.cockpitUserUpdated.name,
        data: { id: userId },
      });

      await step.sendEvent("sync-system-groups-after-supporting-alumni", {
        name: events.userSystemGroupsSync.name,
        data: {
          userId,
          before: userBeforeTransition,
          after: {
            status: "supporting_alumni",
            department: null,
            batchNumber: userBeforeTransition.batchNumber,
          },
        },
      });

      await step.run("write-audit-log-supporting-alumni", async () => {
        await writeAuditLog({
          category: "membership",
          eventType: "membership.transition_completed",
          subject: { id: userId, name: subjectName },
          metadata: { type: "supporting_alumni_request", transitionRequestId },
          description: "To supporting alumni",
        });
      });

      return { outcome: "supporting_alumni", transitionRequestId };
    }

    // Alumni request: full exit sequence.

    // Read user state before alumni transition for replay-safe before/after diff.
    const userBeforeAlumniTransition = await step.run(
      "read-user-state-before-alumni-transition",
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

    // Step 5: Atomic alumni transition transaction.
    await step.run("execute-alumni-transition", async () => {
      await db.transaction(async (tx) => {
        if (requestData.legalMembershipId) {
          await tx
            .update(legalMembership)
            .set({ status: "cancelled", endedAt: new Date() })
            .where(eq(legalMembership.id, requestData.legalMembershipId));
        }

        await tx
          .update(user)
          .set({ legalMembershipState: "former_member", status: "alumni" })
          .where(eq(user.id, userId));

        await tx.delete(session).where(eq(session.userId, userId));

        await tx
          .update(membershipTransitionRequest)
          .set({
            decidedAt: new Date(),
            decidedByUserId: decisionEvent.data.decidedByUserId,
          })
          .where(eq(membershipTransitionRequest.id, transitionRequestId));
      });
    });

    // Step 6: Suspend Google account.
    if (requestData.startEmail) {
      await step.run("suspend-google-account", async () => {
        await suspendWorkspaceUser(requestData.startEmail!);
      });
    }

    // Step 7: Cancel GoCardless mandate.
    if (requestData.mandateId) {
      await step.run("cancel-gocardless-mandate", async () => {
        await cancelMembershipMandate(requestData.mandateId!);
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

    // Step 8: Generate and archive cancellation PDF.
    await step.run("generate-and-archive-pdf", async () => {
      const { renderToBuffer } = await import("@react-pdf/renderer");
      const pdfBuffer = await renderToBuffer(
        renderMembershipTransitionTemplate({
          legalMembershipId: requestData.legalMembershipId ?? "unknown",
          firstName: requestData.firstName,
          lastName: requestData.lastName,
          transitionType: "cancelled",
          transitionDate: new Date(),
          reason: "resigned",
          renderedAt: new Date(),
        }),
      );

      if (requestData.legalMembershipId) {
        await archiveLegalDocument({
          legalMembershipId: requestData.legalMembershipId,
          buffer: Buffer.from(pdfBuffer),
          fileName: `membership-cancellation-${requestData.legalMembershipId}.pdf`,
          firstName: requestData.firstName,
          lastName: requestData.lastName,
        });
      }
    });

    // Step 9: Send confirmation email using cached personal email.
    if (requestData.personalEmail) {
      await step.run("send-cancellation-email", async () => {
        await sendEmail({
          from: "START Berlin <no-reply@notification.cockpit.start-berlin.com>",
          to: requestData.personalEmail!,
          subject: "Your START Berlin membership has ended",
          react: MembershipCancelledEmail({
            firstName: requestData.firstName,
            keepInTouch: keepPersonalEmail,
            reason: "resigned",
          }),
        });
      });
    }

    // Step 10: Notify board and department head of the alumni transition.
    // Per-recipient failures must not block downstream cleanup steps.
    await step.run("send-internal-fyi", async () => {
      const positions = await getPositionAssignments();
      const recipients = getFyiRecipients(
        positions,
        userId,
        requestData.department,
      );
      const subjectName =
        `${requestData.firstName} ${requestData.lastName}`.trim();
      const terminatedOn = new Date().toISOString().substring(0, 10);
      // Non-board recipients can only be the dept head of the subject's
      // department (per getFyiRecipients), so department is non-null here.
      const subjectDepartmentLabel = requestData.department
        ? DEPARTMENT_NAMES[requestData.department]
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
                context: "alumni",
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

    // Step 11: Fire group reconciliation.
    await step.sendEvent("fire-group-reconciliation-alumni", {
      name: events.cockpitUserUpdated.name,
      data: { id: userId },
    });

    await step.sendEvent("sync-system-groups-after-alumni", {
      name: events.userSystemGroupsSync.name,
      data: {
        userId,
        before: userBeforeAlumniTransition,
        after: {
          status: "alumni",
          department: userBeforeAlumniTransition.department,
          batchNumber: userBeforeAlumniTransition.batchNumber,
        },
      },
    });

    await step.run("write-audit-log-alumni", async () => {
      await writeAuditLog({
        category: "membership",
        eventType: "membership.transition_completed",
        subject: { id: userId, name: subjectName },
        metadata: { type: "alumni_request", transitionRequestId },
        description: "To alumni",
      });
    });

    // Step 12: Erase personal data (personal email optionally preserved).
    await step.run("erase-personal-data", async () => {
      await db
        .update(user)
        .set({
          personalEmail: keepPersonalEmail ? undefined : null,
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

    // Step 13: Wait 7 days before hard-deleting workspace account.
    await step.sleep("wait-7d-before-deletion", "7d");

    // Step 14: Hard-delete Google Workspace account.
    if (requestData.startEmail) {
      await step.run("hard-delete-google-account", async () => {
        await deleteWorkspaceUser(requestData.startEmail!);
      });
    }

    // Step 15: Null the start email.
    await step.run("null-start-email", async () => {
      await db.update(user).set({ email: null }).where(eq(user.id, userId));
    });

    return { outcome: "alumni", transitionRequestId };
  },
);
