import { eq } from "drizzle-orm";
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
import { env } from "@/env";
import {
  computeVoteOutcome,
  type VoteOutcome,
} from "@/lib/board-resolution-rules";
import { inngest } from "@/lib/inngest";
import { archiveLegalDocument } from "@/lib/legal-documents/drive-archive";
import { renderAdmissionConfirmationTemplate } from "@/lib/legal-documents/templates/admission-confirmation";
import { renderBoardResolutionTemplate } from "@/lib/legal-documents/templates/board-resolution";
import { renderMembershipApplicationTemplate } from "@/lib/legal-documents/templates/membership-application";
import { resend } from "@/lib/resend";

export const membershipAdmissionWorkflow = inngest.createFunction(
  {
    id: "membership-admission-workflow",
    name: "Membership Admission Workflow",
  },
  { event: "membership/admission-workflow.started" },
  async ({ event, step, runId }) => {
    const { legalMembershipId, subjectUserId } = event.data;

    // Step 1: Store the Inngest run ID on the legal_membership row so operators
    // can look up the live run in the Inngest dashboard.
    await step.run("store-inngest-run-id", async () => {
      await db
        .update(legalMembership)
        .set({ inngestRunId: runId, status: "admission_pending" })
        .where(eq(legalMembership.id, legalMembershipId));
    });

    // Step 1b: Load board notification data — participants, subject name, resolution URL.
    const boardTaskData = await step.run("load-board-task-data", async () => {
      const resolution = await db.query.boardResolution.findFirst({
        where: (br, { eq: eqFn }) =>
          eqFn(br.legalMembershipId, legalMembershipId),
        columns: { id: true },
      });

      const subjectUser = await db.query.user.findFirst({
        where: (u, { eq: eqFn }) => eqFn(u.id, subjectUserId),
        columns: { firstName: true, lastName: true },
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
        subjectName: subjectUser
          ? `${subjectUser.firstName} ${subjectUser.lastName}`
          : subjectUserId,
        resolutionUrl: resolution
          ? `${env.NEXT_PUBLIC_COCKPIT_URL}/people/resolutions/${resolution.id}`
          : `${env.NEXT_PUBLIC_COCKPIT_URL}/people`,
        participants,
      };
    });

    // Step 1c: Send one email per board participant — each in its own step so a
    // Resend failure only retries that participant's send, not the entire fan-out.
    for (const participant of boardTaskData.participants) {
      await step.run(`send-board-task-email-${participant.userId}`, async () => {
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
      });
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
          event: "membership/board-vote.cast",
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
      const subjectUser = await db.query.user.findFirst({
        where: (u, { eq: eqFn }) => eqFn(u.id, subjectUserId),
        columns: { firstName: true, email: true },
      });
      if (!subjectUser) return;

      await resend.emails.send({
        from: "START Berlin <notifications@cockpit.start-berlin.com>",
        to: subjectUser.email,
        subject: "Complete your membership application",
        react: MembershipApplicationReadyEmail({
          firstName: subjectUser.firstName ?? "",
          applicationUrl: `${env.NEXT_PUBLIC_COCKPIT_URL}/membership`,
        }),
      });
    });

    // Step 7: Wait for the applicant to submit their membership application
    // (up to 90 days).
    const applicationEvent = await step.waitForEvent(
      "wait-for-application-submitted",
      {
        event: "membership/application.submitted",
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
        throw new Error(
          `No board_resolution found for ${legalMembershipId}`,
        );
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

      const subjectUser = await db.query.user.findFirst({
        where: (u, { eq: eqFn }) => eqFn(u.id, subjectUserId),
        columns: { firstName: true, lastName: true },
      });

      const { renderToBuffer } = await import("@react-pdf/renderer");
      const element = renderBoardResolutionTemplate({
        legalMembershipId,
        resolutionId: resolution.id,
        resolutionText: resolution.resolutionText,
        resolutionTextHash: resolution.resolutionTextHash,
        subjectName: subjectUser
          ? `${subjectUser.firstName} ${subjectUser.lastName}`
          : subjectUserId,
        participants: participants.map((p) => ({
          userId: p.userId,
          name: `${p.firstName} ${p.lastName}`,
          officerFunction: p.officerFunction,
        })),
        votes: votes.map((v) => ({
          voterUserId: v.voterUserId,
          voterName: `${v.firstName} ${v.lastName}`,
          value: v.value,
          castAt: v.castAt,
        })),
        renderedAt: new Date(),
      });

      const buffer = Buffer.from(
        await renderToBuffer(
          element as import("react").ReactElement<
            import("@react-pdf/renderer").DocumentProps
          >,
        ),
      );

      await archiveLegalDocument({
        legalMembershipId,
        documentType: "board_resolution",
        buffer,
        fileName: `board-resolution-${legalMembershipId}.pdf`,
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

      const { renderToBuffer } = await import("@react-pdf/renderer");
      const element = renderMembershipApplicationTemplate({
        legalMembershipId,
        applicationId: application.id,
        subjectName:
          `${(await db.query.user.findFirst({ where: (u, { eq: eqFn }) => eqFn(u.id, subjectUserId), columns: { firstName: true, lastName: true } }))?.firstName ?? ""} ${(await db.query.user.findFirst({ where: (u, { eq: eqFn }) => eqFn(u.id, subjectUserId), columns: { firstName: true, lastName: true } }))?.lastName ?? ""}`.trim(),
        address: {
          street: application.street,
          city: application.city,
          state: application.state,
          zip: application.zip,
          country: application.country,
        },
        declarations: application.declarations as Record<string, boolean>,
        feeTextVersion: application.feeTextVersion,
        applicationVersion: application.applicationVersion,
        submittedAt: application.submittedAt,
        renderedAt: new Date(),
      });

      const buffer = Buffer.from(
        await renderToBuffer(
          element as import("react").ReactElement<
            import("@react-pdf/renderer").DocumentProps
          >,
        ),
      );

      await archiveLegalDocument({
        legalMembershipId,
        documentType: "membership_application",
        buffer,
        fileName: `membership-application-${legalMembershipId}.pdf`,
      });
    });

    // Step 10: Activate the legal membership and set legalMembershipState.
    // Only reached after all documents are archived.
    // Both updates are wrapped in a transaction to prevent split-brain where
    // legal_membership.status = 'active' but user.legalMembershipState is stale.
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
        });
        return now.toISOString();
      },
    );

    // Step 9c: Render and archive admission confirmation PDF (after activation so activatedAt is set).
    await step.run("archive-admission-confirmation", async () => {
      const subjectUser = await db.query.user.findFirst({
        where: (u, { eq: eqFn }) => eqFn(u.id, subjectUserId),
        columns: { firstName: true, lastName: true },
      });

      const { renderToBuffer } = await import("@react-pdf/renderer");
      const element = renderAdmissionConfirmationTemplate({
        legalMembershipId,
        subjectName: subjectUser
          ? `${subjectUser.firstName} ${subjectUser.lastName}`
          : subjectUserId,
        activatedAt: new Date(activatedAt),
        renderedAt: new Date(),
      });

      const buffer = Buffer.from(
        await renderToBuffer(
          element as import("react").ReactElement<
            import("@react-pdf/renderer").DocumentProps
          >,
        ),
      );

      await archiveLegalDocument({
        legalMembershipId,
        documentType: "admission_confirmation",
        buffer,
        fileName: `admission-confirmation-${legalMembershipId}.pdf`,
      });
    });

    // Step 11: Send admission confirmation to the new member.
    await step.run("send-admission-confirmed-email", async () => {
      const subjectUser = await db.query.user.findFirst({
        where: (u, { eq: eqFn }) => eqFn(u.id, subjectUserId),
        columns: { firstName: true, email: true, status: true },
      });
      if (!subjectUser) return;

      const payment = await db.query.membershipPayment.findFirst({
        where: (mp, { eq: eqFn }) => eqFn(mp.userId, subjectUserId),
        columns: { id: true },
      });

      const includesPaymentCta = subjectUser.status === "member" && !payment;

      await resend.emails.send({
        from: "START Berlin <notifications@cockpit.start-berlin.com>",
        to: subjectUser.email,
        subject: "Welcome to START Berlin",
        react: MembershipAdmissionConfirmedEmail({
          firstName: subjectUser.firstName ?? "",
          includesPaymentCta,
          membershipUrl: `${env.NEXT_PUBLIC_COCKPIT_URL}/membership`,
        }),
      });
    });

    // Step 11b: Load board completion notification data.
    const boardCompletionData = await step.run(
      "load-board-completion-data",
      async () => {
        const subjectUser = await db.query.user.findFirst({
          where: (u, { eq: eqFn }) => eqFn(u.id, subjectUserId),
          columns: { firstName: true, lastName: true },
        });

        const participants = await db
          .select({
            userId: admissionParticipant.userId,
            email: user.email,
            firstName: user.firstName,
          })
          .from(admissionParticipant)
          .innerJoin(user, eq(user.id, admissionParticipant.userId))
          .where(
            eq(admissionParticipant.legalMembershipId, legalMembershipId),
          );

        return {
          subjectName: subjectUser
            ? `${subjectUser.firstName} ${subjectUser.lastName}`
            : subjectUserId,
          participants,
        };
      },
    );

    // Step 11c: Send one completion email per board participant.
    for (const participant of boardCompletionData.participants) {
      await step.run(
        `send-board-completion-email-${participant.userId}`,
        async () => {
          await resend.emails.send({
            from: "START Berlin <notifications@cockpit.start-berlin.com>",
            to: participant.email,
            subject: `Admission complete: ${boardCompletionData.subjectName}`,
            react: MembershipAdmissionCompletedBoardEmail({
              firstName: participant.firstName ?? "",
              subjectName: boardCompletionData.subjectName,
              legalMembershipId,
            }),
          });
        },
      );
    }

    return { outcome: "activated", legalMembershipId };
  },
);
