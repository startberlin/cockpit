"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import db from "@/db";
import { advancePaymentStatus, getPaymentById } from "@/db/membership-payments";
import { user } from "@/db/schema/auth";
import { membershipPayments } from "@/db/schema/membership-payments";
import { actionClient } from "@/lib/action-client";
import { writeAuditLog } from "@/lib/audit-log";
import { createOneTimePayment } from "@/lib/gocardless/payments";
import { can } from "@/lib/permissions/server";
import { buildSubjectMetadata, track } from "@/lib/posthog-server";

export const chargeAction = actionClient
  .inputSchema(z.object({ id: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    if (!(await can("payments.manage"))) {
      throw new Error("Not authorized.");
    }

    const row = await getPaymentById(parsedInput.id);
    if (!row) {
      throw new Error("Payment not found.");
    }

    const today = new Date().toISOString().slice(0, 10);
    if (row.activationDate > today) {
      throw new Error(
        `Payment is not due until ${row.activationDate}. Cannot charge before the activation date.`,
      );
    }

    // Atomically claim the row before touching GoCardless.
    // Returns false if another concurrent request already claimed it.
    const claimed = await advancePaymentStatus(row.id, "proposed", "pending");
    if (!claimed) {
      return { alreadyProcessed: true };
    }

    const member = await db.query.user.findFirst({
      where: eq(user.id, row.userId),
      columns: {
        gocardlessMandateId: true,
        name: true,
        id: true,
        status: true,
        department: true,
        batchNumber: true,
        legalMembershipState: true,
        memberSinceDate: true,
      },
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

    await writeAuditLog({
      category: "payment",
      eventType: "payment.charged",
      actor: { id: ctx.user.id, name: ctx.user.name },
      subject: member?.name ? { id: row.userId, name: member.name } : null,
      metadata: { paymentId: row.id, amount: row.amount },
      description: `€${(row.amount / 100).toFixed(2)}`,
    });

    if (member) {
      after(() =>
        track({
          distinctId: row.userId,
          event: "admin_payment_charged",
          properties: {
            actor_id: ctx.user.id,
            payment_amount_cents: row.amount,
            ...buildSubjectMetadata(member, row.activationDate),
          },
        }),
      );
    }

    return { alreadyProcessed: false };
  });
