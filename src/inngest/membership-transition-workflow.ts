import { eq } from "drizzle-orm";
import db from "@/db";
import { getApprovalRecipients, getPositionAssignments } from "@/db/authority";
import { session, user } from "@/db/schema/auth";
import { legalMembership } from "@/db/schema/legal-membership";
import { membershipTransitionRequest } from "@/db/schema/membership-transition-request";
import MembershipAlumniConfirmedEmail from "@/emails/membership-alumni-confirmed";
import MembershipSupportingAlumniConfirmedEmail from "@/emails/membership-supporting-alumni-confirmed";
import MembershipTransitionApprovalNeededEmail from "@/emails/membership-transition-approval-needed";
import MembershipTransitionRejectedEmail from "@/emails/membership-transition-rejected";
import { env } from "@/env";
import { sendEmail } from "@/lib/email";
import { cancelMembershipMandate } from "@/lib/gocardless/membership-cancellation";
import {
  deleteWorkspaceUser,
  suspendWorkspaceUser,
} from "@/lib/google-workspace/directory";
import { events, inngest } from "@/lib/inngest";
import { archiveLegalDocument } from "@/lib/legal-documents/drive-archive";
import { renderMembershipTransitionTemplate } from "@/lib/legal-documents/templates/membership-transition";

export const membershipTransitionWorkflow = inngest.createFunction(
  {
    id: "membership-transition-workflow",
    name: "Membership Transition Workflow",
    triggers: [{ event: events.transitionRequested }],
    cancelOn: [
      {
        event: events.transitionRetracted.name,
        if: "async.data.transitionRequestId == event.data.transitionRequestId",
      },
    ],
  },
  async ({ event, step }) => {
    const { userId, transitionRequestId, type, keepPersonalEmail } = event.data;

    // Step 1: Read transition request and user data, determine approvers.
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

      const positions = await getPositionAssignments();
      const approvers = getApprovalRecipients(
        positions,
        userId,
        userRecord.department,
      );

      return {
        firstName: userRecord.firstName,
        lastName: userRecord.lastName,
        personalEmail: userRecord.personalEmail,
        startEmail: userRecord.email,
        mandateId: userRecord.gocardlessMandateId,
        legalMembershipId: lm?.id ?? null,
        approvers,
      };
    });

    // Step 2: Send approval request to dept head / board.
    await step.run("send-approval-request", async () => {
      const subjectName =
        `${requestData.firstName} ${requestData.lastName}`.trim();
      const transitionLabel =
        type === "alumni_request"
          ? "alumni_request"
          : "supporting_alumni_request";

      await Promise.all(
        requestData.approvers
          .filter((r) => r.email)
          .map((recipient) =>
            sendEmail({
              from: "START Berlin <notifications@cockpit.start-berlin.com>",
              to: recipient.email!,
              subject: `Action required: review ${subjectName}'s transition request`,
              react: MembershipTransitionApprovalNeededEmail({
                firstName: recipient.firstName,
                subjectName,
                transitionType: transitionLabel,
                requestedAt: new Date().toISOString().substring(0, 10),
                profileUrl: `${env.NEXT_PUBLIC_COCKPIT_URL}/admin/people/directory/${userId}`,
              }),
            }),
          ),
      );
    });

    // Step 3: Wait for decision (30-day timeout).
    const decisionEvent = await step.waitForEvent("wait-for-decision", {
      event: events.transitionDecided.name,
      timeout: "30d",
      if: "async.data.transitionRequestId == event.data.transitionRequestId",
    });

    // Step 4a: Timeout — mark expired and notify member.
    if (decisionEvent === null) {
      await step.run("mark-request-expired", async () => {
        await db
          .update(membershipTransitionRequest)
          .set({ status: "expired" })
          .where(eq(membershipTransitionRequest.id, transitionRequestId));
      });

      if (requestData.personalEmail) {
        await step.run("send-expiry-notification", async () => {
          await sendEmail({
            from: "START Berlin <notifications@cockpit.start-berlin.com>",
            to: requestData.personalEmail!,
            subject: "Your transition request has expired",
            react: MembershipTransitionRejectedEmail({
              firstName: requestData.firstName,
              transitionType:
                type === "alumni_request"
                  ? "alumni_request"
                  : "supporting_alumni_request",
            }),
          });
        });
      }

      return { outcome: "expired", transitionRequestId };
    }

    // Step 4b: Rejected — notify member.
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

      if (requestData.personalEmail) {
        await step.run("send-rejection-email", async () => {
          await sendEmail({
            from: "START Berlin <notifications@cockpit.start-berlin.com>",
            to: requestData.personalEmail!,
            subject: "Your transition request was not approved",
            react: MembershipTransitionRejectedEmail({
              firstName: requestData.firstName,
              transitionType:
                type === "alumni_request"
                  ? "alumni_request"
                  : "supporting_alumni_request",
            }),
          });
        });
      }

      return { outcome: "rejected", transitionRequestId };
    }

    // Step 5: Approved — execute based on type.
    if (type === "supporting_alumni_request") {
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

      if (requestData.personalEmail) {
        await step.run("send-supporting-alumni-email", async () => {
          await sendEmail({
            from: "START Berlin <notifications@cockpit.start-berlin.com>",
            to: requestData.personalEmail!,
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

      return { outcome: "supporting_alumni", transitionRequestId };
    }

    // Alumni request: full exit sequence (mirrors cancellation workflow).

    // Step 6: Atomic alumni transition transaction.
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

    // Step 7: Suspend Google account.
    if (requestData.startEmail) {
      await step.run("suspend-google-account", async () => {
        await suspendWorkspaceUser(requestData.startEmail!);
      });
    }

    // Step 8: Cancel GoCardless mandate.
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

    // Step 9: Generate and archive alumni transition PDF.
    await step.run("generate-and-archive-pdf", async () => {
      const { renderToBuffer } = await import("@react-pdf/renderer");
      const pdfBuffer = await renderToBuffer(
        renderMembershipTransitionTemplate({
          legalMembershipId: requestData.legalMembershipId ?? "unknown",
          firstName: requestData.firstName,
          lastName: requestData.lastName,
          transitionType: "alumni",
          transitionDate: new Date(),
          renderedAt: new Date(),
        }),
      );

      if (requestData.legalMembershipId) {
        await archiveLegalDocument({
          legalMembershipId: requestData.legalMembershipId,
          buffer: Buffer.from(pdfBuffer),
          fileName: `membership-alumni-transition-${requestData.legalMembershipId}.pdf`,
          firstName: requestData.firstName,
          lastName: requestData.lastName,
        });
      }
    });

    // Step 10: Send alumni confirmation email using cached personal email.
    if (requestData.personalEmail) {
      await step.run("send-alumni-confirmed-email", async () => {
        await sendEmail({
          from: "START Berlin <notifications@cockpit.start-berlin.com>",
          to: requestData.personalEmail!,
          subject: "Your START Berlin membership has transitioned to alumni",
          react: MembershipAlumniConfirmedEmail({
            firstName: requestData.firstName,
            keepInTouch: keepPersonalEmail,
          }),
        });
      });
    }

    // Step 11: Fire group reconciliation.
    await step.sendEvent("fire-group-reconciliation-alumni", {
      name: events.cockpitUserUpdated.name,
      data: { id: userId },
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
