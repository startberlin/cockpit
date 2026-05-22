"use server";

import { createTransitionRequest } from "@/db/membership-transitions";
import { actionClient } from "@/lib/action-client";
import { events, inngest } from "@/lib/inngest";

export const submitSupportingAlumniAction = actionClient.action(
  async ({ ctx }) => {
    const { user } = ctx;

    const isEligible =
      user.status === "member" || user.status === "supporting_alumni";

    if (!isEligible) {
      throw new Error(
        "You are not eligible to request a membership transition.",
      );
    }

    const transitionRequest = await createTransitionRequest({
      userId: user.id,
      type: "supporting_alumni_request",
    });

    await inngest.send({
      name: events.transitionRequested.name,
      data: {
        userId: user.id,
        transitionRequestId: transitionRequest.id,
        type: "supporting_alumni_request",
        keepPersonalEmail: false,
      },
    });

    return { requestId: transitionRequest.id };
  },
);
