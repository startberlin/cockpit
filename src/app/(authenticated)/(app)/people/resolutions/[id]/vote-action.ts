"use server";

import { sql } from "drizzle-orm";
import { returnValidationErrors } from "next-safe-action";
import { z } from "zod";
import db from "@/db";
import type { BoardVote } from "@/db/schema/legal-membership";
import { legalMembership } from "@/db/schema/legal-membership";
import { actionClient } from "@/lib/action-client";
import { events, inngest } from "@/lib/inngest";
import { can } from "@/lib/permissions/server";

const voteInputSchema = z.object({
  legalMembershipId: z.string().min(1),
  value: z.enum(["yes", "no"]),
  displayedResolutionHash: z.string().min(1),
});

export const castVoteAction = actionClient
  .inputSchema(voteInputSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { legalMembershipId, value, displayedResolutionHash } = parsedInput;
    const currentUser = ctx.user;

    if (!(await can("membership.resolution.vote"))) {
      throw new Error(
        "Could not cast vote. Please try again. If this keeps happening, email operations@start-berlin.com.",
      );
    }

    const lm = await db.query.legalMembership.findFirst({
      where: (l, { eq: eqFn }) => eqFn(l.id, legalMembershipId),
      columns: {
        status: true,
        boardResolutionHash: true,
        boardParticipants: true,
        boardVotes: true,
      },
    });

    if (!lm) {
      throw new Error("Resolution not found.");
    }

    if (lm.status !== "admission_pending") {
      throw new Error("Voting is no longer open for this resolution.");
    }

    if (displayedResolutionHash !== lm.boardResolutionHash) {
      throw new Error(
        "The resolution text has changed since you loaded this page. Please refresh and try again.",
      );
    }

    const participants = lm.boardParticipants ?? [];
    const isParticipant = participants.some((p) => p.userId === currentUser.id);

    if (!isParticipant) {
      throw new Error(
        "Could not cast vote. Please try again. If this keeps happening, email operations@start-berlin.com.",
      );
    }

    const existingVotes: BoardVote[] = lm.boardVotes ?? [];
    const alreadyVoted = existingVotes.some(
      (v) => v.voterUserId === currentUser.id,
    );

    if (alreadyVoted) {
      return returnValidationErrors(voteInputSchema, {
        value: { _errors: ["You have already voted on this resolution."] },
      });
    }

    const now = new Date();
    const newVote: BoardVote = {
      voterUserId: currentUser.id,
      value,
      castAt: now.toISOString(),
      displayedResolutionHash,
    };

    // Atomic conditional append: only updates if the voter hasn't voted yet.
    const result = await db
      .update(legalMembership)
      .set({
        boardVotes: sql`COALESCE(${legalMembership.boardVotes}, '[]'::jsonb) || ${JSON.stringify([newVote])}::jsonb`,
      })
      .where(
        sql`${legalMembership.id} = ${legalMembershipId}
          AND ${legalMembership.status} = 'admission_pending'
          AND NOT (COALESCE(${legalMembership.boardVotes}, '[]'::jsonb) @> ${JSON.stringify([{ voterUserId: currentUser.id }])}::jsonb)`,
      )
      .returning({ id: legalMembership.id });

    if (result.length === 0) {
      return returnValidationErrors(voteInputSchema, {
        value: { _errors: ["You have already voted on this resolution."] },
      });
    }

    await inngest.send({
      name: events.boardVoteCast.name,
      data: {
        legalMembershipId,
        voterId: currentUser.id,
        value,
        castAt: now.toISOString(),
      },
    });

    return { success: true };
  });
