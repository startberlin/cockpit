"use server";

import { z } from "zod";
import { retractTransitionRequest } from "@/db/membership-transitions";
import { actionClient } from "@/lib/action-client";
import { writeAuditLog } from "@/lib/audit-log";
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

    await writeAuditLog({
      category: "membership",
      eventType: "membership.transition_retracted",
      actor: { id: currentUser.id, name: currentUser.name },
      subject: { id: currentUser.id, name: currentUser.name },
    });
  });
