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

const approveAlumniInputSchema = z.object({
  transitionRequestId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
});

export const approveAlumniAction = actionClient
  .inputSchema(approveAlumniInputSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { transitionRequestId, decision } = parsedInput;
    const currentUser = ctx.user;

    const row = await db
      .select({
        type: membershipTransitionRequest.type,
        status: membershipTransitionRequest.status,
        userId: membershipTransitionRequest.userId,
        department: user.department,
      })
      .from(membershipTransitionRequest)
      .innerJoin(user, eq(user.id, membershipTransitionRequest.userId))
      .where(eq(membershipTransitionRequest.id, transitionRequestId))
      .then((rows) => rows[0] ?? null);

    if (!row) {
      throw new Error("Transition request not found.");
    }

    if (!["alumni_request", "supporting_alumni_request"].includes(row.type)) {
      throw new Error("Invalid transition type.");
    }

    if (row.status !== "pending") {
      throw new Error("This transition request is no longer pending.");
    }

    if (
      !(await can("membership.transition.decide", {
        department: row.department,
      }))
    ) {
      throw new Error("Not authorized to decide on this transition.");
    }

    await inngest.send({
      name: events.transitionDecided.name,
      data: {
        transitionRequestId,
        decision,
        decidedByUserId: currentUser.id,
      },
    });

    await writeAuditLog({
      category: "membership",
      eventType: "membership.transition_decided",
      actor: { id: currentUser.id, name: currentUser.name },
      subject: { id: row.userId, name: row.userId },
      metadata: { transitionRequestId, decision, type: row.type },
      description:
        decision === "approved"
          ? `Approved ${row.type.replace("_", " ")}`
          : `Rejected ${row.type.replace("_", " ")}`,
    });

    return { success: true };
  });
