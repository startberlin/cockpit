"use server";

import { z } from "zod";
import { retractTransitionRequest } from "@/db/membership-transitions";
import { actionClient } from "@/lib/action-client";
import { events, inngest } from "@/lib/inngest";

const schema = z.object({
  requestId: z.string().min(1),
});

export const retractTransitionAction = actionClient
  .inputSchema(schema)
  .action(async ({ ctx, parsedInput }) => {
    const { user: currentUser } = ctx;

    await retractTransitionRequest(parsedInput.requestId, currentUser.id);

    await inngest.send({
      name: events.transitionRetracted.name,
      data: { transitionRequestId: parsedInput.requestId },
    });
  });
