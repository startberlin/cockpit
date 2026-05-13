"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import db from "@/db";
import { advancePaymentStatus, getPaymentById } from "@/db/membership-payments";
import { user } from "@/db/schema/auth";
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

    if (row.status !== "proposed") {
      return { alreadyProcessed: true };
    }

    const member = await db.query.user.findFirst({
      where: eq(user.id, row.userId),
      columns: { gocardlessMandateId: true },
    });

    if (!member?.gocardlessMandateId) {
      throw new Error("Member has no stored GoCardless mandate ID.");
    }

    const { id: gcPaymentId } = await createOneTimePayment({
      mandateId: member.gocardlessMandateId,
      amount: row.amount,
      idempotencyKey: row.id,
    });

    await advancePaymentStatus(row.id, "proposed", "pending", {
      gocardlessPaymentId: gcPaymentId,
    });

    revalidatePath("/payments");

    return { alreadyProcessed: false };
  });
