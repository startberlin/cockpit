"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import db from "@/db";
import { createTransitionRequest } from "@/db/membership-transitions";
import { user } from "@/db/schema/auth";
import { actionClient } from "@/lib/action-client";
import { events, inngest } from "@/lib/inngest";
import { getPostHogClient } from "@/lib/posthog-server";

const schema = z.object({
  type: z.enum(["alumni_request", "supporting_alumni_request"]),
  keepPersonalEmail: z.boolean(),
  personalEmail: z.string().email().optional(),
});

export const requestTransitionAction = actionClient
  .inputSchema(schema)
  .action(async ({ ctx, parsedInput }) => {
    const { user: currentUser } = ctx;

    const isEligible =
      currentUser.status === "member" ||
      currentUser.status === "supporting_alumni";

    if (!isEligible) {
      throw new Error(
        "You are not authorized to request a membership transition.",
      );
    }

    if (parsedInput.personalEmail) {
      await db
        .update(user)
        .set({ personalEmail: parsedInput.personalEmail })
        .where(eq(user.id, currentUser.id));
    }

    const personalEmailForNotification =
      parsedInput.personalEmail ?? currentUser.personalEmail ?? undefined;

    const request = await createTransitionRequest({
      userId: currentUser.id,
      type: parsedInput.type,
      keepPersonalEmail: parsedInput.keepPersonalEmail,
      personalEmailForNotification,
    });

    await inngest.send({
      name: events.transitionRequested.name,
      data: {
        userId: currentUser.id,
        transitionRequestId: request.id,
        type: parsedInput.type,
        keepPersonalEmail: parsedInput.keepPersonalEmail,
      },
    });

    getPostHogClient()?.capture({
      distinctId: currentUser.id,
      event: "membership_transition_requested",
      properties: {
        transition_type: parsedInput.type,
        had_reason: false,
      },
    });

    return { requestId: request.id };
  });
