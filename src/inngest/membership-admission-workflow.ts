import { and, eq } from "drizzle-orm";
import db from "@/db";
import { user } from "@/db/schema/auth";
import {
  admissionParticipant,
  boardResolution,
  boardVote,
} from "@/db/schema/board-admission";
import { legalMembership } from "@/db/schema/legal-membership";
import BoardResolutionTaskAssignedEmail from "@/emails/board-resolution-task-assigned";
import MembershipAdmissionCompletedBoardEmail from "@/emails/membership-admission-completed-board";
import MembershipAdmissionConfirmedEmail from "@/emails/membership-admission-confirmed";
import MembershipApplicationReadyEmail from "@/emails/membership-application-ready";
import MembershipApplicationSubmittedEmail from "@/emails/membership-application-submitted";
import { env } from "@/env";
import {
  computeResolutionRoles,
  computeVoteOutcome,
  type VoteOutcome,
} from "@/lib/board-resolution-rules";
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
import { renderBoardResolutionTemplate } from "@/lib/legal-documents/templates/board-resolution";
import { ROLE_DISPLAY } from "@/lib/legal-documents/templates/brand";
import { renderMembershipApplicationTemplate } from "@/lib/legal-documents/templates/membership-application";
import { resend } from "@/lib/resend";

export const membershipAdmissionWorkflow = inngest.createFunction(
  {
    id: "membership-admission-workflow",
    name: "Membership Admission Workflow",
    triggers: [{ event: events.admissionWorkflowStarted }],
  },
  async ({ event, step, runId }) => {
    const { legalMembershipId, subjectUserId } = event.data;

    // Step 1: Store the Inngest run ID and load the subject user in one step so
    // downstream steps can reference firstName/lastName/email/status without
    // redundant DB round-trips.
    const subject = await step.run("store-inngest-run-id", async () => {
      await db
        .update(legalMembership)
        .set({ inngestRunId: runId, status: "admission_pending" })
        .where(eq(legalMembership.id, legalMembershipId));

      const subjectUser = await db.query.user.findFirst({
        where: (u, { eq: eqFn }) => eqFn(u.id, subjectUserId),
        columns: { firstName: true, lastName: true, email: true, status: true },
      });

      return {
        firstName: subjectUser?.firstName ?? "",
        lastName: subjectUser?.lastName ?? "",
        email: subjectUser?.email ?? "",
        status: subjectUser?.status,
      };
    });

    const subjectName =
      subject.firstName || subject.lastName
        ? `${subject.firstName} ${subject.lastName}`.trim()
        : subjectUserId;

    // Step 1b: Load board notification data — participants and resolution URL.
    const boardTaskData = await step.run("load-board-task-data", async () => {
      const resolution = await db.query.boardResolution.findFirst({
        where: (br, { eq: eqFn }) =>
          eqFn(br.legalMembershipId, legalMembershipId),
        columns: { id: true },
      });

      const participants = await db
        .select({
          userId: admissionParticipant.userId,
          email: user.email,
          firstName: user.firstName,
        })
        .from(admissionParticipant)
        .innerJoin(user, eq(user.id, admissionParticipant.userId))
        .where(eq(admissionParticipant.legalMembershipId, legalMembershipId));

      return {
        subjectName,
        resolutionUrl: resolution
          ? `${env.NEXT_PUBLIC_COCKPIT_URL}/people/resolutions/${resolution.id}`
          : `${env.NEXT_PUBLIC_COCKPIT_URL}/people`,
        participants,
      };
    });

    // Step 1c: Send one email per board participant — each in its own step so a
    // Resend failure only retries that participant's send, not the entire fan-out.
    for (const participant of boardTaskData.participants) {
      await step.run(
        `send-board-task-email-${participant.userId}`,
        async () => {
          await resend.emails.send({
            from: "START Berlin <notifications@cockpit.start-berlin.com>",
            to: participant.email,
            subject: `Action required: vote on ${boardTaskData.subjectName}'s membership`,
            react: BoardResolutionTaskAssignedEmail({
              firstName: participant.firstName ?? "",
              subjectName: boardTaskData.subjectName,
              resolutionUrl: boardTaskData.resolutionUrl,
            }),
          });
        },
      );
    }

    // Steps 2–4: Vote loop — wait for up to 3 individual board votes (one per
    // officer). We allow up to 3 rounds so each officer gets one event. The
    // loop exits early once a resolution is reached.
    let voteRound = 0;
    let resolution: VoteOutcome = "pending";

    while (voteRound < 3 && resolution === "pending") {
      voteRound++;

      // Wait up to 90 days for the next vote.
      const voteEvent = await step.waitForEvent(
        `wait-for-board-vote-${voteRound}`,
        {
          event: events.boardVoteCast,
          timeout: "90d",
          if: "async.data.legalMembershipId == event.data.legalMembershipId",
        },
      );

      if (voteEvent === null) {
        // Timeout — no vote received in 90 days; escalate to manual followup.
        await step.run("timeout-to-manual-followup", async () => {
          await db
            .update(legalMembership)
            .set({ status: "manual_followup" })
            .where(eq(legalMembership.id, legalMembershipId));
        });
        return { outcome: "timeout", legalMembershipId };
      }

      // Read all votes cast so far for this legal membership from the DB and
      // evaluate — this is robust to out-of-order delivery and Inngest replays.
      resolution = await step.run(
        `evaluate-votes-round-${voteRound}`,
        async () => {
          const votes = await db
            .select({ value: boardVote.value })
            .from(boardVote)
            .where(eq(boardVote.legalMembershipId, legalMembershipId));
          return computeVoteOutcome(votes.map((v) => v.value));
        },
      );
    }

    // Step 5: Act on the vote resolution.
    if (resolution === "manual_followup") {
      await step.run("reject-to-manual-followup", async () => {
        await db
          .update(legalMembership)
          .set({ status: "manual_followup" })
          .where(eq(legalMembership.id, legalMembershipId));
      });
      return { outcome: "manual_followup", legalMembershipId };
    }

    if (resolution !== "approved") {
      // Still pending after 3 rounds with no resolution — manual followup.
      await step.run("unresolved-to-manual-followup", async () => {
        await db
          .update(legalMembership)
          .set({ status: "manual_followup" })
          .where(eq(legalMembership.id, legalMembershipId));
      });
      return { outcome: "unresolved", legalMembershipId };
    }

    // Step 6: Board approved — update status to application_pending.
    await step.run("mark-application-pending", async () => {
      await db
        .update(legalMembership)
        .set({ status: "application_pending" })
        .where(eq(legalMembership.id, legalMembershipId));
    });

    // Notify the applicant that they can now submit their membership application.
    await step.run("notify-applicant-board-approved", async () => {
      if (!subject.email) {
        throw new Error(`Missing email for subject user ${subjectUserId}`);
      }
      await resend.emails.send({
        from: "START Berlin <notifications@cockpit.start-berlin.com>",
        to: subject.email,
        subject: "Complete your membership application",
        react: MembershipApplicationReadyEmail({
          firstName: subject.firstName,
          applicationUrl: `${env.NEXT_PUBLIC_COCKPIT_URL}/membership`,
        }),
      });
    });

    // Step 7: Wait for the applicant to submit their membership application
    // (up to 90 days).
    const applicationEvent = await step.waitForEvent(
      "wait-for-application-submitted",
      {
        event: events.applicationSubmitted,
        timeout: "90d",
        if: "async.data.legalMembershipId == event.data.legalMembershipId",
      },
    );

    if (applicationEvent === null) {
      await step.run("application-timeout-to-manual-followup", async () => {
        await db
          .update(legalMembership)
          .set({ status: "manual_followup" })
          .where(eq(legalMembership.id, legalMembershipId));
      });
      return { outcome: "application_timeout", legalMembershipId };
    }

    // Step 8: Mark as processing while we generate documents.
    await step.run("mark-processing", async () => {
      await db
        .update(legalMembership)
        .set({ status: "processing" })
        .where(eq(legalMembership.id, legalMembershipId));
    });

    // Step 9a: Render and archive board resolution PDF.
    // archiveLegalDocument handles idempotency internally via the DB UNIQUE constraint.
    await step.run("archive-board-resolution", async () => {
      const [resolution] = await db
        .select({
          id: boardResolution.id,
          resolutionText: boardResolution.resolutionText,
          resolutionTextHash: boardResolution.resolutionTextHash,
        })
        .from(boardResolution)
        .where(eq(boardResolution.legalMembershipId, legalMembershipId));

      if (!resolution) {
        throw new Error(`No board_resolution found for ${legalMembershipId}`);
      }

      const participants = await db
        .select({
          userId: admissionParticipant.userId,
          officerFunction: admissionParticipant.officerFunction,
          firstName: user.firstName,
          lastName: user.lastName,
        })
        .from(admissionParticipant)
        .innerJoin(user, eq(user.id, admissionParticipant.userId))
        .where(eq(admissionParticipant.legalMembershipId, legalMembershipId));

      const votes = await db
        .select({
          voterUserId: boardVote.voterUserId,
          value: boardVote.value,
          castAt: boardVote.castAt,
          firstName: user.firstName,
          lastName: user.lastName,
        })
        .from(boardVote)
        .innerJoin(user, eq(user.id, boardVote.voterUserId))
        .where(eq(boardVote.legalMembershipId, legalMembershipId));

      const mappedParticipants = participants.map((p) => ({
        userId: p.userId,
        name: `${p.firstName} ${p.lastName}`,
        officerFunction: p.officerFunction,
      }));

      const mappedVotes = votes.map((v) => ({
        voterUserId: v.voterUserId,
        voterName: `${v.firstName} ${v.lastName}`,
        value: v.value,
        castAt: v.castAt,
      }));

      const roles = computeResolutionRoles(
        participants.map((p) => ({
          userId: p.userId,
          officerFunction: p.officerFunction,
        })),
        votes.map((v) => ({ voterUserId: v.voterUserId, value: v.value })),
      );

      if (!roles) {
        throw new Error(
          `Cannot determine Sitzungsleiter/Protokollführer for ${legalMembershipId}: fewer than 2 yes-voting participants found`,
        );
      }

      const sitzungsleiterParticipant = participants.find(
        (p) => p.userId === roles.sitzungsleiter.userId,
      );
      const protokollfuehrerParticipant = participants.find(
        (p) => p.userId === roles.protokollfuehrer.userId,
      );

      const { renderToBuffer } = await import("@react-pdf/renderer");
      const element = renderBoardResolutionTemplate({
        legalMembershipId,
        resolutionId: resolution.id,
        resolutionText: resolution.resolutionText,
        resolutionTextHash: resolution.resolutionTextHash,
        subjectName,
        sitzungsleiter: {
          name: `${sitzungsleiterParticipant?.firstName ?? ""} ${sitzungsleiterParticipant?.lastName ?? ""}`.trim(),
          officerFunction: roles.sitzungsleiter.officerFunction,
        },
        protokollfuehrer: {
          name: `${protokollfuehrerParticipant?.firstName ?? ""} ${protokollfuehrerParticipant?.lastName ?? ""}`.trim(),
          officerFunction: roles.protokollfuehrer.officerFunction,
        },
        participants: mappedParticipants,
        votes: mappedVotes,
        renderedAt: new Date(),
      });

      const buffer = Buffer.from(await renderToBuffer(element));

      await archiveLegalDocument({
        legalMembershipId,
        documentType: "board_resolution",
        buffer,
        fileName: `board-resolution-${subject.firstName}-${subject.lastName}-${legalMembershipId}.pdf`,
        firstName: subject.firstName,
        lastName: subject.lastName,
      });
    });

    // Step 9b: Render and archive membership application PDF.
    await step.run("archive-membership-application", async () => {
      const application = await db.query.membershipApplication.findFirst({
        where: (ma, { eq: eqFn }) =>
          eqFn(ma.legalMembershipId, legalMembershipId),
      });

      if (!application) {
        throw new Error(
          `No membership_application found for ${legalMembershipId}`,
        );
      }

      if (application.subjectUserId !== subjectUserId) {
        throw new Error(
          `Ownership mismatch: application subjectUserId ${application.subjectUserId} does not match expected ${subjectUserId} for legal membership ${legalMembershipId}`,
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

      const renderedAt = new Date();
      const { renderToBuffer } = await import("@react-pdf/renderer");
      const element = renderMembershipApplicationTemplate({
        legalMembershipId,
        applicationId: application.id,
        subjectName,
        email: application.personalEmail ?? undefined,
        birthDate: application.birthDate,
        address: {
          street: application.street,
          city: application.city,
          state: application.state ?? "",
          zip: application.zip,
          country: application.country,
        },
        declarations: application.declarations,
        feeTextVersion: application.feeTextVersion,
        applicationVersion: application.applicationVersion,
        submittedAt: application.submittedAt,
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

      await archiveLegalDocument({
        legalMembershipId,
        documentType: "membership_application",
        buffer,
        fileName: `membership-application-${subject.firstName}-${subject.lastName}-${legalMembershipId}.pdf`,
        firstName: subject.firstName,
        lastName: subject.lastName,
      });
    });

    // Send the applicant a confirmation email with the application PDF attached.
    await step.run("send-application-submitted-email", async () => {
      if (!subject.email) {
        throw new Error(`Missing email for subject user ${subjectUserId}`);
      }

      const applicationDoc = await db.query.legalDocument.findFirst({
        where: (d, { and: andFn, eq: eqFn }) =>
          andFn(
            eqFn(d.legalMembershipId, legalMembershipId),
            eqFn(d.documentType, "membership_application"),
          ),
        columns: { driveFileId: true },
      });

      const attachments = applicationDoc?.driveFileId
        ? [
            {
              filename: `membership-application-${subject.firstName}-${subject.lastName}-${legalMembershipId}.pdf`,
              content: await downloadArchivedDocument(
                applicationDoc.driveFileId,
              ),
              contentType: "application/pdf",
            },
          ]
        : undefined;

      await resend.emails.send({
        from: "START Berlin <notifications@cockpit.start-berlin.com>",
        to: subject.email,
        subject: "Your membership application has been received",
        react: MembershipApplicationSubmittedEmail({
          firstName: subject.firstName,
        }),
        attachments,
      });
    });

    // Step 10: Activate the legal membership and set legalMembershipState.
    // Only reached after all documents are archived.
    // Both updates are wrapped in a transaction to prevent split-brain where
    // legal_membership.status = 'active' but user.legalMembershipState is stale.
    // The status promotion (onboarding → member) happens here, not at payment
    // setup, since legal membership and payment are independent.
    const activatedAt = await step.run(
      "activate-legal-membership",
      async () => {
        const now = new Date();
        await db.transaction(async (tx) => {
          await tx
            .update(legalMembership)
            .set({ status: "active", activatedAt: now })
            .where(eq(legalMembership.id, legalMembershipId));
          await tx
            .update(user)
            .set({ legalMembershipState: "active_member" })
            .where(eq(user.id, subjectUserId));
          await tx
            .update(user)
            .set({ status: "member" })
            .where(
              and(eq(user.id, subjectUserId), eq(user.status, "onboarding")),
            );
        });
        return now.toISOString();
      },
    );

    // Step 9c: Render and archive admission confirmation PDF (after activation so activatedAt is set).
    await step.run("archive-admission-confirmation", async () => {
      const [boardMembers, application] = await Promise.all([
        db
          .select({
            userId: admissionParticipant.userId,
            officerFunction: admissionParticipant.officerFunction,
            firstName: user.firstName,
            lastName: user.lastName,
          })
          .from(admissionParticipant)
          .innerJoin(user, eq(user.id, admissionParticipant.userId))
          .where(eq(admissionParticipant.legalMembershipId, legalMembershipId)),
        db.query.membershipApplication.findFirst({
          where: (ma, { eq: eqFn }) =>
            eqFn(ma.legalMembershipId, legalMembershipId),
          columns: { street: true, zip: true, city: true, country: true },
        }),
      ]);

      const board = boardMembers.map((p) => ({
        name: `${p.firstName} ${p.lastName}`.trim(),
        role: ROLE_DISPLAY[p.officerFunction] ?? p.officerFunction,
      }));

      const subjectAddress = application?.street
        ? [
            application.street,
            `${application.zip} ${application.city}`.trim(),
            application.country,
          ]
            .filter(Boolean)
            .join(" · ")
        : undefined;

      const { renderToBuffer } = await import("@react-pdf/renderer");
      const element = renderAdmissionConfirmationTemplate({
        legalMembershipId,
        subjectName,
        subjectAddress,
        board,
        activatedAt: new Date(activatedAt),
        renderedAt: new Date(),
      });

      const buffer = Buffer.from(await renderToBuffer(element));

      await archiveLegalDocument({
        legalMembershipId,
        documentType: "admission_confirmation",
        buffer,
        fileName: `admission-confirmation-${subject.firstName}-${subject.lastName}-${legalMembershipId}.pdf`,
        firstName: subject.firstName,
        lastName: subject.lastName,
      });
    });

    // Step 11: Send admission confirmation to the new member.
    await step.run("send-admission-confirmed-email", async () => {
      if (!subject.email) {
        throw new Error(`Missing email for subject user ${subjectUserId}`);
      }

      // Fetch user status fresh — it may have changed since step 1 (e.g. GoCardless
      // payment activated operational status from 'onboarding' to 'member').
      const [freshUser, confirmationDoc] = await Promise.all([
        db.query.user.findFirst({
          where: (u, { eq: eqFn }) => eqFn(u.id, subjectUserId),
          columns: { status: true, gocardlessMandateId: true },
        }),
        db.query.legalDocument.findFirst({
          where: (d, { and: andFn, eq: eqFn }) =>
            andFn(
              eqFn(d.legalMembershipId, legalMembershipId),
              eqFn(d.documentType, "admission_confirmation"),
            ),
          columns: { driveFileId: true },
        }),
      ]);

      const includesPaymentCta =
        freshUser?.status === "member" && !freshUser?.gocardlessMandateId;

      const attachments = confirmationDoc?.driveFileId
        ? [
            {
              filename: `admission-confirmation-${subject.firstName}-${subject.lastName}-${legalMembershipId}.pdf`,
              content: await downloadArchivedDocument(
                confirmationDoc.driveFileId,
              ),
              contentType: "application/pdf",
            },
          ]
        : undefined;

      await resend.emails.send({
        from: "START Berlin <notifications@cockpit.start-berlin.com>",
        to: subject.email,
        subject: "Welcome to START Berlin",
        react: MembershipAdmissionConfirmedEmail({
          firstName: subject.firstName,
          includesPaymentCta,
          membershipUrl: `${env.NEXT_PUBLIC_COCKPIT_URL}/membership`,
        }),
        attachments,
      });
    });

    // Step 11b: Load board completion notification data.
    const boardCompletionData = await step.run(
      "load-board-completion-data",
      async () => {
        const [participants, boardResolutionDoc] = await Promise.all([
          db
            .select({
              userId: admissionParticipant.userId,
              email: user.email,
              firstName: user.firstName,
            })
            .from(admissionParticipant)
            .innerJoin(user, eq(user.id, admissionParticipant.userId))
            .where(
              eq(admissionParticipant.legalMembershipId, legalMembershipId),
            ),
          db.query.legalDocument.findFirst({
            where: (d, { and: andFn, eq: eqFn }) =>
              andFn(
                eqFn(d.legalMembershipId, legalMembershipId),
                eqFn(d.documentType, "board_resolution"),
              ),
            columns: { driveFileId: true },
          }),
        ]);

        return {
          subjectName,
          participants,
          boardResolutionDriveFileId: boardResolutionDoc?.driveFileId ?? null,
        };
      },
    );

    // Step 11c: Send one completion email per board participant.
    for (const participant of boardCompletionData.participants) {
      await step.run(
        `send-board-completion-email-${participant.userId}`,
        async () => {
          const attachments = boardCompletionData.boardResolutionDriveFileId
            ? [
                {
                  filename: `board-resolution-${subject.firstName}-${subject.lastName}-${legalMembershipId}.pdf`,
                  content: await downloadArchivedDocument(
                    boardCompletionData.boardResolutionDriveFileId,
                  ),
                  contentType: "application/pdf",
                },
              ]
            : undefined;

          await resend.emails.send({
            from: "START Berlin <notifications@cockpit.start-berlin.com>",
            to: participant.email,
            subject: `Admission complete: ${boardCompletionData.subjectName}`,
            react: MembershipAdmissionCompletedBoardEmail({
              firstName: participant.firstName ?? "",
              subjectName: boardCompletionData.subjectName,
              legalMembershipId,
            }),
            attachments,
          });
        },
      );
    }

    return { outcome: "activated", legalMembershipId };
  },
);
