import { eq } from "drizzle-orm";
import db from "@/db";
import { boardVote } from "@/db/schema/board-admission";
import { legalMembership } from "@/db/schema/legal-membership";
import {
  computeVoteOutcome,
  type VoteOutcome,
} from "@/lib/board-resolution-rules";
import { inngest } from "@/lib/inngest";

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
          match: "data.legalMembershipId",
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

    // TODO (U12): Send board-approval notification email to applicant.
    await step.run("stub-notify-applicant-approved", async () => {
      console.log(
        `[stub] Notify applicant ${subjectUserId} that board approved admission for ${legalMembershipId}`,
      );
    });

    // Step 7: Wait for the applicant to submit their membership application
    // (up to 90 days).
    const applicationEvent = await step.waitForEvent(
      "wait-for-application-submitted",
      {
        event: "membership/application.submitted",
        timeout: "90d",
        match: "data.legalMembershipId",
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

    // Step 9: Render and archive legal documents (stubs — filled in U11).
    await step.run("stub-render-board-resolution-pdf", async () => {
      console.log(
        `[stub] Render board resolution PDF for legal membership ${legalMembershipId}`,
      );
    });

    await step.run("stub-render-membership-application-pdf", async () => {
      console.log(
        `[stub] Render membership application PDF for legal membership ${legalMembershipId}`,
      );
    });

    await step.run("stub-archive-to-drive", async () => {
      console.log(
        `[stub] Archive documents to Google Drive for legal membership ${legalMembershipId}`,
      );
    });

    // Step 10: Activate the legal membership.
    await step.run("activate-legal-membership", async () => {
      const now = new Date();
      await db
        .update(legalMembership)
        .set({ status: "active", activatedAt: now })
        .where(eq(legalMembership.id, legalMembershipId));
    });

    // Step 11: Send activation notifications (stubs — filled in U12).
    await step.run("stub-send-activation-email", async () => {
      console.log(
        `[stub] Send membership activation email to ${subjectUserId} for ${legalMembershipId}`,
      );
    });

    await step.run("stub-send-board-confirmation", async () => {
      console.log(
        `[stub] Send board confirmation notification for ${legalMembershipId}`,
      );
    });

    return { outcome: "activated", legalMembershipId };
  },
);
