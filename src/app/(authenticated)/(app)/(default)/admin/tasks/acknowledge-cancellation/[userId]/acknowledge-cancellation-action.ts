"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import db from "@/db";
import { user } from "@/db/schema/auth";
import { membershipTransitionRequest } from "@/db/schema/membership-transition-request";
import { actionClient } from "@/lib/action-client";
import { writeAuditLog } from "@/lib/audit-log";
import { events, inngest } from "@/lib/inngest";
import { can } from "@/lib/permissions/server";

const acknowledgeCancellationInputSchema = z.object({
  transitionRequestId: z.string().min(1),
});

export const acknowledgeCancellationAction = actionClient
  .inputSchema(acknowledgeCancellationInputSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { transitionRequestId } = parsedInput;
    const currentUser = ctx.user;

    const row = await db
      .select({
        type: membershipTransitionRequest.type,
        status: membershipTransitionRequest.status,
        reason: membershipTransitionRequest.reason,
        userId: membershipTransitionRequest.userId,
        department: user.department,
      })
      .from(membershipTransitionRequest)
      .innerJoin(user, eq(user.id, membershipTransitionRequest.userId))
      .where(eq(membershipTransitionRequest.id, transitionRequestId))
      .then((rows) => rows[0] ?? null);

    if (!row) {
      throw new Error("Cancellation request not found.");
    }

    if (row.type !== "cancellation" || row.reason !== "resigned") {
      throw new Error("Invalid cancellation request.");
    }

    if (row.status !== "pending") {
      throw new Error("This cancellation request is no longer pending.");
    }

    if (
      !(await can("membership.cancellation.acknowledge", {
        department: row.department,
      }))
    ) {
      throw new Error("Not authorized to acknowledge this cancellation.");
    }

    if (row.userId === currentUser.id) {
      throw new Error("You cannot acknowledge your own cancellation request.");
    }

    await inngest.send({
      name: events.cancellationAcknowledged.name,
      data: {
        transitionRequestId,
        acknowledgedByUserId: currentUser.id,
      },
    });

    await writeAuditLog({
      category: "membership",
      eventType: "membership.cancellation_acknowledged",
      actor: { id: currentUser.id, name: currentUser.name },
      subject: { id: row.userId, name: row.userId },
      metadata: { transitionRequestId },
      description: "Acknowledged member cancellation",
    });

    return { success: true };
  });
