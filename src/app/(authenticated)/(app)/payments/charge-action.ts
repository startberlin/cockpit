"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import db from "@/db";
import { advancePaymentStatus, getPaymentById } from "@/db/membership-payments";
import { user } from "@/db/schema/auth";
import { membershipPayments } from "@/db/schema/membership-payments";
import { actionClient } from "@/lib/action-client";
import { createOneTimePayment } from "@/lib/gocardless/payments";
import { can } from "@/lib/permissions/server";

export const chargeAction = actionClient
  .inputSchema(z.object({ id: z.string() }))
  .action(async ({ parsedInput }) => {
    if (!(await can("payments.manage"))) {
      throw new Error("Not authorized.");
    }

    const row = await getPaymentById(parsedInput.id);
    if (!row) {
      throw new Error("Payment not found.");
    }

    // Atomically claim the row before touching GoCardless.
    // Returns false if another concurrent request already claimed it.
    const claimed = await advancePaymentStatus(row.id, "proposed", "pending");
    if (!claimed) {
      return { alreadyProcessed: true };
    }

    const member = await db.query.user.findFirst({
      where: eq(user.id, row.userId),
      columns: { gocardlessMandateId: true },
    });

    if (!member?.gocardlessMandateId) {
      await advancePaymentStatus(row.id, "pending", "failed");
      throw new Error("Member has no stored GoCardless mandate ID.");
    }

    try {
      const { id: gcPaymentId } = await createOneTimePayment({
        mandateId: member.gocardlessMandateId,
        amount: row.amount,
        idempotencyKey: row.id,
      });

      // Row is already pending — store the GoCardless reference without re-advancing.
      await db
        .update(membershipPayments)
        .set({ gocardlessPaymentId: gcPaymentId })
        .where(eq(membershipPayments.id, row.id));
    } catch (err) {
      await advancePaymentStatus(row.id, "pending", "failed");
      throw err;
    }

    revalidatePath("/payments");

    return { alreadyProcessed: false };
  });
