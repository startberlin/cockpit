import { and, eq } from "drizzle-orm";
import db from "@/db";
import { createProposedPayment } from "@/db/membership-payments";
import { user } from "@/db/schema/auth";
import { legalMembership } from "@/db/schema/legal-membership";
import MembershipAdmissionConfirmedEmail from "@/emails/membership-admission-confirmed";
import { env } from "@/env";
import { sendEmail } from "@/lib/email";
import { events, inngest } from "@/lib/inngest";
import {
  archiveLegalDocument,
  downloadArchivedDocument,
} from "@/lib/legal-documents/drive-archive";
import { mergePdfsWithAttachments } from "@/lib/legal-documents/pdf-merge";
import {
  readFinanzordnungBuffer,
  readSatzungBuffer,
} from "@/lib/legal-documents/static-documents";
import { renderAdmissionConfirmationTemplate } from "@/lib/legal-documents/templates/admission-confirmation";
import { renderAppendixPage } from "@/lib/legal-documents/templates/appendix";
import { renderMembershipApplicationTemplate } from "@/lib/legal-documents/templates/membership-application";

export const membershipReconfirmationWorkflow = inngest.createFunction(
  {
    id: "membership-reconfirmation-workflow",
    name: "Membership Reconfirmation Workflow",
    triggers: [{ event: events.reconfirmationSubmitted }],
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
      async () => {
        const renderedAt = new Date();
        const { renderToBuffer } = await import("@react-pdf/renderer");

        const element = renderMembershipApplicationTemplate({
          legalMembershipId,
          applicationId: subjectData.applicationId,
          subjectName,
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
          renderedAt,
        });

        const [
          mainBuffer,
          appendixABuffer,
          appendixBBuffer,
          satzungBuffer,
          finanzordnungBuffer,
        ] = await Promise.all([
          renderToBuffer(element).then((b) => Buffer.from(b)),
          renderToBuffer(
            renderAppendixPage({
              letter: "A",
              title: "Bylaws (Satzung)",
              docId: "ANX-A",
              legalMembershipId,
              renderedAt,
            }),
          ).then((b) => Buffer.from(b)),
          renderToBuffer(
            renderAppendixPage({
              letter: "B",
              title: "Financial Regulations (Finanzordnung)",
              docId: "ANX-B",
              legalMembershipId,
              renderedAt,
            }),
          ).then((b) => Buffer.from(b)),
          readSatzungBuffer(),
          readFinanzordnungBuffer(),
        ]);

        const buffer = await mergePdfsWithAttachments(mainBuffer, [
          {
            title: "Appendix A: Bylaws",
            buffer: satzungBuffer,
            dividerBuffer: appendixABuffer,
          },
          {
            title: "Appendix B: Financial Regulations",
            buffer: finanzordnungBuffer,
            dividerBuffer: appendixBBuffer,
          },
        ]);

        return archiveLegalDocument({
          legalMembershipId,
          buffer,
          fileName: `membership-application-${subjectData.firstName}-${subjectData.lastName}-${legalMembershipId}.pdf`,
          firstName: subjectData.firstName,
          lastName: subjectData.lastName,
        });
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

    // Step 4: Create the first proposed membership payment.
    await step.run("create-proposed-payment", async () => {
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
    });

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

      const freshUser = await db.query.user.findFirst({
        where: (u, { eq: eqFn }) => eqFn(u.id, subjectData.userId),
        columns: { status: true, gocardlessMandateId: true },
      });

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

      const includesPaymentCta =
        freshUser?.status === "member" && !freshUser?.gocardlessMandateId;

      await sendEmail({
        from: "START Berlin <notifications@cockpit.start-berlin.com>",
        to: subjectData.email,
        subject: "Your START Berlin membership is now officially documented",
        react: MembershipAdmissionConfirmedEmail({
          firstName: subjectData.firstName,
          includesPaymentCta,
          membershipUrl: `${env.NEXT_PUBLIC_COCKPIT_URL}/membership`,
        }),
        attachments: attachments.length > 0 ? attachments : undefined,
      });
    });

    return { outcome: "reconfirmed", legalMembershipId };
  },
);
