import { eq, or } from "drizzle-orm";
import { reconcileMembershipPaymentByBillingRequestId } from "@/lib/gocardless/membership-reconciliation";
import type { GoCardlessEvent } from "@/lib/gocardless/webhook";
import {
  getGoCardlessEventUserHints,
  isMembershipFailureEvent,
  isMembershipMandateReadyEvent,
} from "@/lib/gocardless/webhook";
import db from ".";
import { membershipPayment } from "./schema/membership";

export async function recordAndProcessGoCardlessEvent(event: GoCardlessEvent) {
  const hints = getGoCardlessEventUserHints(event);

  if (isMembershipMandateReadyEvent(event) && hints.billingRequestId) {
    return reconcileMembershipPaymentByBillingRequestId(hints.billingRequestId);
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

  if (hints.customerId || hints.subscriptionId) {
    return db.query.membershipPayment.findFirst({
      where: or(
        hints.customerId
          ? eq(membershipPayment.gocardlessCustomerId, hints.customerId)
          : undefined,
        hints.subscriptionId
          ? eq(membershipPayment.gocardlessSubscriptionId, hints.subscriptionId)
          : undefined,
      ),
    });
  }

  return null;
}
