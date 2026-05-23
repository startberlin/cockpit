"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import db from "@/db";
import { createTransitionRequest } from "@/db/membership-transitions";
import { session } from "@/db/schema/auth";
import { actionClient } from "@/lib/action-client";
import { events, inngest } from "@/lib/inngest";
import { can } from "@/lib/permissions/server";

const schema = z.object({
  targetUserId: z.string().min(1),
});

export const boardKickAction = actionClient
  .inputSchema(schema)
  .action(async ({ parsedInput }) => {
    if (!(await can("membership.cancel_member"))) {
      throw new Error("You are not authorized to remove members.");
    }

    const request = await createTransitionRequest({
      userId: parsedInput.targetUserId,
      type: "cancellation",
      reason: "removed_by_board",
    });

    await inngest.send({
      name: events.cancellationRequested.name,
      data: {
        userId: parsedInput.targetUserId,
        transitionRequestId: request.id,
        requiresAcknowledgement: false,
        reason: "removed_by_board",
      },
    });

    // Revoke sessions synchronously after the workflow is queued — board kick
    // requires immediate access cutoff. Even if this throws, the workflow's
    // own transaction will revoke sessions when it runs.
    await db
      .delete(session)
      .where(eq(session.userId, parsedInput.targetUserId));

    return { requestId: request.id };
  });
