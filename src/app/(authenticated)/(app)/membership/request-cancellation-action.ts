"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import db from "@/db";
import { createTransitionRequest } from "@/db/membership-transitions";
import { user } from "@/db/schema/auth";
import { actionClient } from "@/lib/action-client";
import { events, inngest } from "@/lib/inngest";
import { can } from "@/lib/permissions/server";

const schema = z.object({
  personalEmail: z.string().email().optional(),
});

export const requestCancellationAction = actionClient
  .inputSchema(schema)
  .action(async ({ ctx, parsedInput }) => {
    const { user: currentUser } = ctx;

    if (!(await can("membership.cancel_own", { id: currentUser.id }))) {
      throw new Error("You are not authorized to cancel your membership.");
    }

    if (parsedInput.personalEmail) {
      await db
        .update(user)
        .set({ personalEmail: parsedInput.personalEmail })
        .where(eq(user.id, currentUser.id));
    }

    const request = await createTransitionRequest({
      userId: currentUser.id,
      type: "cancellation",
      reason: "resigned",
    });

    await inngest.send({
      name: events.cancellationRequested.name,
      data: {
        userId: currentUser.id,
        transitionRequestId: request.id,
        requiresAcknowledgement: true,
        reason: "resigned",
      },
    });

    return { requestId: request.id };
  });
