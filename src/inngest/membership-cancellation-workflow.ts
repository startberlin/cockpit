import { eq } from "drizzle-orm";
import db from "@/db";
import { getApprovalRecipients, getPositionAssignments } from "@/db/authority";
import { session, user } from "@/db/schema/auth";
import { legalMembership } from "@/db/schema/legal-membership";
import { membershipTransitionRequest } from "@/db/schema/membership-transition-request";
import MembershipCancellationAcknowledgementNeededEmail from "@/emails/membership-cancellation-acknowledgement-needed";
import MembershipCancelledEmail from "@/emails/membership-cancelled";
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
      await step.run("send-acknowledgement-notification", async () => {
        const positions = await getPositionAssignments();
        const recipients = getApprovalRecipients(
          positions,
          userId,
          userData.department,
        );

        const subjectName = `${userData.firstName} ${userData.lastName}`.trim();

        await Promise.all(
          recipients
            .filter((r) => r.email)
            .map((recipient) =>
              sendEmail({
                from: "START Berlin <notifications@cockpit.start-berlin.com>",
                to: recipient.email!,
                subject: `Action required: acknowledge ${subjectName}'s membership cancellation`,
                react: MembershipCancellationAcknowledgementNeededEmail({
                  firstName: recipient.firstName,
                  subjectName,
                  requestedAt: new Date().toISOString().substring(0, 10),
                  profileUrl: `${env.NEXT_PUBLIC_COCKPIT_URL}/admin/people/directory/${userId}`,
                }),
              }),
            ),
        );
      });

      await step.waitForEvent("wait-for-acknowledgement", {
        event: events.cancellationAcknowledged.name,
        timeout: "7d",
        if: "async.data.transitionRequestId == event.data.transitionRequestId",
      });
    }

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
          from: "START Berlin <notifications@cockpit.start-berlin.com>",
          to: userData.personalEmail!,
          subject: "Your START Berlin membership has ended",
          react: MembershipCancelledEmail({
            firstName: userData.firstName,
            keepInTouch: false,
          }),
        });
      });
    }

    // Step 8: Fire group reconciliation to remove from all Google groups.
    await step.sendEvent("fire-group-reconciliation", {
      name: events.cockpitUserUpdated.name,
      data: { id: userId },
    });

    // Step 9: Erase personal data and mark request executed.
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

    // Step 10: Wait 7 days before hard-deleting the workspace account.
    await step.sleep("wait-7d-before-deletion", "7d");

    // Step 11: Hard-delete Google Workspace account.
    if (userData.startEmail) {
      await step.run("hard-delete-google-account", async () => {
        await deleteWorkspaceUser(userData.startEmail!);
      });
    }

    // Step 12: Null the start (START Berlin) email.
    await step.run("null-start-email", async () => {
      await db.update(user).set({ email: null }).where(eq(user.id, userId));
    });
  },
);
