import { eq } from "drizzle-orm";
import { advancePaymentStatus } from "@/db/membership-payments";
import { reconcileMembershipPaymentByBillingRequestId } from "@/lib/gocardless/membership-reconciliation";
import type { GoCardlessEvent } from "@/lib/gocardless/webhook";
import {
  getGoCardlessEventUserHints,
  getGoCardlessPaymentId,
  isMembershipFailureEvent,
  isMembershipMandateReadyEvent,
  isPaymentLifecycleEvent,
} from "@/lib/gocardless/webhook";
import db from ".";
import { membershipPayment } from "./schema/membership";
import { membershipPayments } from "./schema/membership-payments";

export async function recordAndProcessGoCardlessEvent(event: GoCardlessEvent) {
  const hints = getGoCardlessEventUserHints(event);

  if (isMembershipMandateReadyEvent(event) && hints.billingRequestId) {
    return reconcileMembershipPaymentByBillingRequestId(hints.billingRequestId);
  }

  if (isPaymentLifecycleEvent(event)) {
    return handlePaymentEvent(event);
  }

  if (isMembershipFailureEvent(event)) {
    const payment = await findMembershipPaymentForEvent(hints);

    if (!payment) {
      return { status: "ignored" as const };
    }

    await db
      .update(membershipPayment)
      .set({ status: "failed" })
      .where(eq(membershipPayment.id, payment.id));

    return { status: "failed" as const };
  }

  return { status: "ignored" as const };
}

async function handlePaymentEvent(event: GoCardlessEvent & { action: string }) {
  const gcPaymentId = getGoCardlessPaymentId(event);
  if (!gcPaymentId) {
    return { status: "ignored" as const };
  }

  const row = await db.query.membershipPayments.findFirst({
    where: eq(membershipPayments.gocardlessPaymentId, gcPaymentId),
    columns: { id: true, status: true },
  });

  if (!row) {
    // Unknown GC payment ID — not created by this system (e.g. old subscription)
    return { status: "ignored" as const };
  }

  type FromTo = {
    from: Parameters<typeof advancePaymentStatus>[1];
    to: Parameters<typeof advancePaymentStatus>[2];
  };

  const statusMap: Record<string, FromTo> = {
    submitted: { from: "pending", to: "submitted" },
    confirmed: { from: "submitted", to: "confirmed" },
    paid_out: { from: "confirmed", to: "paid_out" },
    failed: { from: ["pending", "submitted"], to: "failed" },
    cancelled: { from: "pending", to: "cancelled" },
    charged_back: { from: ["confirmed", "paid_out"], to: "charged_back" },
  };

  const transition = statusMap[event.action];
  if (!transition) {
    return { status: "ignored" as const };
  }

  await advancePaymentStatus(row.id, transition.from, transition.to);
  return { status: event.action };
}

async function findMembershipPaymentForEvent(
  hints: ReturnType<typeof getGoCardlessEventUserHints>,
) {
  if (hints.billingRequestId) {
    const byBillingRequestId = await db.query.membershipPayment.findFirst({
      where: eq(
        membershipPayment.gocardlessBillingRequestId,
        hints.billingRequestId,
      ),
    });
    if (byBillingRequestId) return byBillingRequestId;
  }

  if (hints.customerId) {
    return db.query.membershipPayment.findFirst({
      where: eq(membershipPayment.gocardlessCustomerId, hints.customerId),
    });
  }

  return null;
}
