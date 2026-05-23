"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import db from "@/db";
import { advancePaymentStatus, getPaymentById } from "@/db/membership-payments";
import { user } from "@/db/schema/auth";
import { actionClient } from "@/lib/action-client";
import { writeAuditLog } from "@/lib/audit-log";
import { can } from "@/lib/permissions/server";

export const declineAction = actionClient
  .inputSchema(
    z.object({
      id: z.string(),
      reason: z.string().min(1, "Reason is required"),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    if (!(await can("payments.manage"))) {
      throw new Error("Not authorized.");
    }

    const row = await getPaymentById(parsedInput.id);
    if (!row) {
      throw new Error("Payment not found.");
    }

    // advancePaymentStatus is the atomic gate — returns false if another
    // request already processed this row.
    const declined = await advancePaymentStatus(
      row.id,
      "proposed",
      "declined",
      {
        declineReason: parsedInput.reason,
      },
    );

    if (!declined) {
      return { alreadyProcessed: true };
    }

    revalidatePath("/payments");

    const [member] = await db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, row.userId))
      .limit(1);

    await writeAuditLog({
      category: "payment",
      eventType: "payment.declined",
      actor: { id: ctx.user.id, name: ctx.user.name },
      subject: member?.name ? { id: row.userId, name: member.name } : null,
      metadata: { paymentId: row.id, reason: parsedInput.reason },
      description: parsedInput.reason,
    });

    return { alreadyProcessed: false };
  });
