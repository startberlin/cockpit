import { and, eq } from "drizzle-orm";
import db from "@/db";
import { createProposedPayment } from "@/db/membership-payments";
import { user } from "@/db/schema/auth";
import { legalMembership } from "@/db/schema/legal-membership";
import MembershipAdmissionConfirmedEmail from "@/emails/membership/admission/membership-admission-confirmed";
import { writeAuditLog } from "@/lib/audit-log";
import { sendEmail } from "@/lib/email";
import { events, inngest } from "@/lib/inngest";
import {
  archiveLegalDocument,
  downloadArchivedDocument,
} from "@/lib/legal-documents/drive-archive";
import { renderAdmissionConfirmationTemplate } from "@/lib/legal-documents/templates/admission-confirmation";
import { archiveMembershipApplicationPdf } from "./lib/archive-application-pdf";

export const membershipReconfirmationWorkflow = inngest.createFunction(
  {
    id: "membership-reconfirmation-workflow",
    name: "Membership Reconfirmation Workflow",
    triggers: [{ event: events.reconfirmationSubmitted }],
    cancelOn: [
      {
        event: events.cancellationRequested.name,
        if: "async.data.userId == event.data.userId",
      },
    ],
  },
  async ({ event, step }) => {
    const { legalMembershipId } = event.data;

    // Step 1: Load subject user and legal membership data.
    const subjectData = await step.run("load-subject-data", async () => {
      const lm = await db.query.legalMembership.findFirst({
        where: (l, { eq: eqFn }) => eqFn(l.id, legalMembershipId),
        columns: {
          userId: true,
          activatedAt: true,
          status: true,
          importedPaidThroughAt: true,
        },
      });

      if (!lm) {
        throw new Error(`Legal membership not found: ${legalMembershipId}`);
      }

      const application = await db.query.membershipApplication.findFirst({
        where: (ma, { eq: eqFn }) =>
          eqFn(ma.legalMembershipId, legalMembershipId),
      });

      if (!application || application.status !== "submitted") {
        throw new Error(
          `No submitted membership application found for ${legalMembershipId}`,
        );
      }

      if (application.subjectUserId !== lm.userId) {
        throw new Error(
          `Ownership mismatch: application subjectUserId ${application.subjectUserId} does not match legal membership userId ${lm.userId} for ${legalMembershipId}`,
        );
      }

      if (
        !application.street ||
        !application.city ||
        !application.zip ||
        !application.country ||
        !application.birthDate ||
        !application.declarations ||
        !application.feeTextVersion ||
        !application.applicationVersion ||
        !application.submittedAt
      ) {
        throw new Error(
          `Membership application ${application.id} is missing required fields`,
        );
      }

      const subjectUser = await db.query.user.findFirst({
        where: (u, { eq: eqFn }) => eqFn(u.id, lm.userId),
        columns: { firstName: true, lastName: true, email: true, status: true },
      });

      if (!subjectUser) {
        throw new Error(`User not found: ${lm.userId}`);
      }

      return {
        userId: lm.userId,
        activatedAt: (lm.activatedAt ?? new Date()).toISOString(),
        importedPaidThroughAt: lm.importedPaidThroughAt?.toISOString() ?? null,
        firstName: subjectUser.firstName ?? "",
        lastName: subjectUser.lastName ?? "",
        email: subjectUser.email ?? "",
        userStatus: subjectUser.status,
        applicationId: application.id,
        personalEmail: application.personalEmail,
        phone: application.phone,
        street: application.street,
        city: application.city,
        state: application.state ?? "",
        zip: application.zip,
        country: application.country,
        birthDate: application.birthDate,
        declarations: application.declarations,
        feeTextVersion: application.feeTextVersion,
        applicationVersion: application.applicationVersion,
        submittedAt: application.submittedAt.toISOString(),
      };
    });

    const subjectName =
      subjectData.firstName || subjectData.lastName
        ? `${subjectData.firstName} ${subjectData.lastName}`.trim()
        : subjectData.userId;

    // Step 2: Archive the membership application PDF.
    const { driveFileId: applicationFileDriveId } = await step.run(
      "archive-membership-application",
      () =>
        archiveMembershipApplicationPdf({
          legalMembershipId,
          applicationId: subjectData.applicationId,
          subjectName,
          firstName: subjectData.firstName,
          lastName: subjectData.lastName,
          email: subjectData.personalEmail ?? undefined,
          birthDate: subjectData.birthDate,
          address: {
            street: subjectData.street,
            city: subjectData.city,
            state: subjectData.state,
            zip: subjectData.zip,
            country: subjectData.country,
          },
          declarations: subjectData.declarations,
          feeTextVersion: subjectData.feeTextVersion,
          applicationVersion: subjectData.applicationVersion,
          submittedAt: new Date(subjectData.submittedAt),
        }),
    );

    // Step 2b: Read user state before activation (replay-safe before-state).
    const userBeforeActivation = await step.run(
      "read-user-state-before-activation",
      async () => {
        const u = await db.query.user.findFirst({
          where: (u, { eq: eqFn }) => eqFn(u.id, subjectData.userId),
          columns: { status: true, department: true, batchNumber: true },
        });
        return {
          status: u?.status ?? null,
          department: u?.department ?? null,
          batchNumber: u?.batchNumber ?? null,
        };
      },
    );

    // Step 3: Activate the legal membership and insert the payment row.
    await step.run("activate-legal-membership", async () => {
      await db.transaction(async (tx) => {
        await tx
          .update(legalMembership)
          .set({ status: "active" })
          .where(eq(legalMembership.id, legalMembershipId));

        await tx
          .update(user)
          .set({ legalMembershipState: "active_member" })
          .where(eq(user.id, subjectData.userId));

        await tx
          .update(user)
          .set({ status: "member" })
          .where(
            and(eq(user.id, subjectData.userId), eq(user.status, "onboarding")),
          );
      });
    });

    await step.sendEvent("user-status-changed", {
      name: events.cockpitUserUpdated.name,
      data: { id: subjectData.userId },
    });

    await step.sendEvent("sync-system-groups-after-activation", {
      name: events.userSystemGroupsSync.name,
      data: {
        userId: subjectData.userId,
        before: userBeforeActivation,
        after: {
          status:
            userBeforeActivation.status === "onboarding"
              ? "member"
              : userBeforeActivation.status,
          department: userBeforeActivation.department,
          batchNumber: userBeforeActivation.batchNumber,
        },
      },
    });

    // Kick off the mandate-setup reminder workflow; it self-checks current
    // mandate state at each tick so it's a no-op if the user already has one.
    await step.sendEvent("kick-mandate-setup-reminder", {
      name: events.mandateSetupNeeded.name,
      data: { userId: subjectData.userId },
    });

    await step.run("write-audit-log-reconfirmed", async () => {
      await writeAuditLog({
        category: "membership",
        eventType: "membership.reconfirmation_completed",
        subject: { id: subjectData.userId, name: subjectName },
        metadata: { legalMembershipId },
      });
    });

    // Step 4: Create the first proposed membership payment.
    const proposalVisible = await step.run(
      "create-proposed-payment",
      async () => {
        const today = new Date().toISOString().slice(0, 10);
        let activationDate = today;

        if (subjectData.importedPaidThroughAt) {
          const d = new Date(subjectData.importedPaidThroughAt);
          d.setUTCFullYear(d.getUTCFullYear() + 1);
          const renewalDate = d.toISOString().slice(0, 10);
          if (renewalDate > today) {
            activationDate = renewalDate;
          }
        }

        await createProposedPayment(subjectData.userId, activationDate);

        // The proposal is visible to the finance digest immediately when its
        // activation date is today or in the past (a member with an immediate
        // payment need). Future-dated proposals stay blocked until their date
        // arrives, at which point the daily proposals cron re-triggers the
        // digest.
        return activationDate <= today;
      },
    );

    // Trigger the finance digest for the newly-visible proposal. The digest
    // function debounces, so a burst of reconfirmations coalesces into a single
    // email.
    if (proposalVisible) {
      await step.sendEvent("fire-finance-digest", {
        name: events.paymentProposalCreated.name,
        data: { count: 1 },
      });
    }

    // Step 5: Archive the admission confirmation PDF.
    const { driveFileId: confirmationFileDriveId } = await step.run(
      "archive-admission-confirmation",
      async () => {
        const subjectAddress = [
          subjectData.street,
          `${subjectData.zip} ${subjectData.city}`.trim(),
          subjectData.country,
        ]
          .filter(Boolean)
          .join(" · ");

        const { renderToBuffer } = await import("@react-pdf/renderer");
        const element = renderAdmissionConfirmationTemplate({
          legalMembershipId,
          subjectName,
          subjectAddress,
          board: [],
          activatedAt: new Date(subjectData.activatedAt),
          renderedAt: new Date(),
        });

        const buffer = Buffer.from(await renderToBuffer(element));

        return archiveLegalDocument({
          legalMembershipId,
          buffer,
          fileName: `admission-confirmation-${subjectData.firstName}-${subjectData.lastName}-${legalMembershipId}.pdf`,
          firstName: subjectData.firstName,
          lastName: subjectData.lastName,
        });
      },
    );

    // Step 6: Send confirmation email with both PDFs attached.
    await step.run("send-confirmation-email", async () => {
      if (!subjectData.email) {
        throw new Error(`Missing email for user ${subjectData.userId}`);
      }

      const attachments = [];

      if (applicationFileDriveId) {
        attachments.push({
          filename: `membership-application-${subjectData.firstName}-${subjectData.lastName}-${legalMembershipId}.pdf`,
          content: await downloadArchivedDocument(applicationFileDriveId),
          contentType: "application/pdf",
        });
      }

      if (confirmationFileDriveId) {
        attachments.push({
          filename: `admission-confirmation-${subjectData.firstName}-${subjectData.lastName}-${legalMembershipId}.pdf`,
          content: await downloadArchivedDocument(confirmationFileDriveId),
          contentType: "application/pdf",
        });
      }

      await sendEmail({
        from: "START Berlin <no-reply@notification.cockpit.start-berlin.com>",
        to: subjectData.email,
        subject: "Your START Berlin membership is active",
        react: MembershipAdmissionConfirmedEmail({
          firstName: subjectData.firstName,
        }),
        attachments: attachments.length > 0 ? attachments : undefined,
      });
    });

    return { outcome: "reconfirmed", legalMembershipId };
  },
);
