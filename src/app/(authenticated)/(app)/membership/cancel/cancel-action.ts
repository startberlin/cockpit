"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import db from "@/db";
import { createTransitionRequest } from "@/db/membership-transitions";
import { user as userTable } from "@/db/schema/auth";
import { actionClient } from "@/lib/action-client";
import { events, inngest } from "@/lib/inngest";
import { can } from "@/lib/permissions/server";

const schema = z.object({
  personalEmail: z
    .union([z.email("Please enter a valid email address."), z.literal("")])
    .optional(),
});

export const cancelMembershipAction = actionClient
  .inputSchema(schema)
  .action(async ({ ctx, parsedInput }) => {
    const { user } = ctx;

    if (!(await can("membership.cancel_own", { id: user.id }))) {
      throw new Error("You are not authorized to cancel your membership.");
    }

    if (parsedInput.personalEmail) {
      await db
        .update(userTable)
        .set({ personalEmail: parsedInput.personalEmail })
        .where(eq(userTable.id, user.id));
    }

    const personalEmailForNotification =
      parsedInput.personalEmail ?? user.personalEmail ?? undefined;

    const transitionRequest = await createTransitionRequest({
      userId: user.id,
      type: "cancellation",
      reason: "resigned",
      personalEmailForNotification,
    });

    await inngest.send({
      name: events.cancellationRequested.name,
      data: {
        userId: user.id,
        transitionRequestId: transitionRequest.id,
        requiresAcknowledgement: true,
        reason: "resigned",
      },
    });

    return { requestId: transitionRequest.id };
  });
