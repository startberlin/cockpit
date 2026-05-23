"use server";

import { createTransitionRequest } from "@/db/membership-transitions";
import { actionClient } from "@/lib/action-client";
import { writeAuditLog } from "@/lib/audit-log";
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

    await writeAuditLog({
      category: "membership",
      eventType: "membership.supporting_alumni_requested",
      actor: { id: user.id, name: user.name },
      subject: { id: user.id, name: user.name },
    });

    return { requestId: transitionRequest.id };
  },
);
