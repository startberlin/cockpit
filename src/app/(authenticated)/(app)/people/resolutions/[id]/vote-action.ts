"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import db from "@/db";
import {
  admissionParticipant,
  boardResolution,
  boardVote,
  boardVoteValue,
} from "@/db/schema/board-admission";
import { legalMembership } from "@/db/schema/legal-membership";
import { actionClient } from "@/lib/action-client";
import { newId } from "@/lib/id";
import { inngest } from "@/lib/inngest";

export const castVoteAction = actionClient
  .inputSchema(
    z.object({
      resolutionId: z.string().min(1),
      value: z.enum(boardVoteValue.enumValues),
      displayedResolutionHash: z.string().min(1),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { resolutionId, value, displayedResolutionHash } = parsedInput;
    const currentUser = ctx.user;

    // Load resolution + legal_membership in one query
    const rows = await db
      .select({
        legalMembershipId: legalMembership.id,
        legalMembershipStatus: legalMembership.status,
        resolutionTextHash: boardResolution.resolutionTextHash,
      })
      .from(boardResolution)
      .innerJoin(
        legalMembership,
        eq(legalMembership.id, boardResolution.legalMembershipId),
      )
      .where(eq(boardResolution.id, resolutionId));

    if (rows.length === 0) {
      throw new Error("Resolution not found.");
    }

    const { legalMembershipId, legalMembershipStatus, resolutionTextHash } =
      rows[0];

    // Validate that voting is still open
    if (legalMembershipStatus !== "admission_pending") {
      throw new Error("Voting is no longer open for this resolution.");
    }

    // Validate that the user is an admission participant
    const participantRows = await db
      .select({ id: admissionParticipant.id })
      .from(admissionParticipant)
      .where(
        and(
          eq(admissionParticipant.legalMembershipId, legalMembershipId),
          eq(admissionParticipant.userId, currentUser.id),
        ),
      );

    if (participantRows.length === 0) {
      throw new Error(
        "Could not cast vote. Please try again. If this keeps happening, email operations@start-berlin.com.",
      );
    }

    // Check that the user hasn't already voted
    const existingVote = await db
      .select({ id: boardVote.id })
      .from(boardVote)
      .where(
        and(
          eq(boardVote.legalMembershipId, legalMembershipId),
          eq(boardVote.voterUserId, currentUser.id),
        ),
      );

    if (existingVote.length > 0) {
      throw new Error("You have already voted on this resolution.");
    }

    // Validate that the displayed resolution hash matches the stored hash
    if (displayedResolutionHash !== resolutionTextHash) {
      throw new Error(
        "The resolution text has changed since you loaded this page. Please refresh and try again.",
      );
    }

    // Insert the vote
    const now = new Date();
    await db.insert(boardVote).values({
      id: newId("boardVote"),
      legalMembershipId,
      voterUserId: currentUser.id,
      value,
      displayedResolutionHash,
      castAt: now,
    });

    // Send Inngest event
    await inngest.send({
      name: "membership/board-vote.cast",
      data: {
        legalMembershipId,
        voterId: currentUser.id,
        value,
        castAt: now.toISOString(),
      },
    });

    return { success: true };
  });
