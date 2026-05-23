"use server";

import { eq } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";
import db from "@/db";
import { createTransitionRequest } from "@/db/membership-transitions";
import { user as userTable } from "@/db/schema/auth";
import { actionClient } from "@/lib/action-client";
import { writeAuditLog } from "@/lib/audit-log";
import { events, inngest } from "@/lib/inngest";

const schema = z.object({
  personalEmail: z.email("Please enter a valid email address."),
});

export const submitAlumniAction = actionClient
  .inputSchema(schema)
  .action(async ({ ctx, parsedInput }) => {
    const { user } = ctx;

    const isEligible =
      user.status === "member" || user.status === "supporting_alumni";

    if (!isEligible) {
      throw new Error(
        "You are not eligible to request a membership transition.",
      );
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
      type: "alumni_request",
      personalEmailForNotification,
    });

    await inngest.send({
      name: events.transitionRequested.name,
      data: {
        userId: user.id,
        transitionRequestId: transitionRequest.id,
        type: "alumni_request",
        keepPersonalEmail: false,
      },
    });

    after(() =>
      writeAuditLog({
        category: "membership",
        eventType: "membership.alumni_requested",
        actor: { id: user.id, name: user.name },
        subject: { id: user.id, name: user.name },
      }),
    );

    return { requestId: transitionRequest.id };
  });
