"use server";

import { after } from "next/server";
import { z } from "zod";
import db from "@/db";
import { retractTransitionRequest } from "@/db/membership-transitions";
import { actionClient } from "@/lib/action-client";
import { writeAuditLog } from "@/lib/audit-log";
import { events, inngest } from "@/lib/inngest";
import { track } from "@/lib/posthog-server";

const schema = z.object({
  requestId: z.string().min(1),
});

export const retractTransitionAction = actionClient
  .inputSchema(schema)
  .action(async ({ ctx, parsedInput }) => {
    const { user: currentUser } = ctx;

    const existing = await db.query.membershipTransitionRequest.findFirst({
      where: (t, { eq: eqFn }) => eqFn(t.id, parsedInput.requestId),
      columns: { type: true },
    });

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

    after(() =>
      track({
        distinctId: currentUser.id,
        event: "membership_transition_retracted",
        properties: {
          transition_type: existing?.type ?? null,
        },
      }),
    );
  });
