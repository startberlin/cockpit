import { eq } from "drizzle-orm";
import db from "@/db";
import { advancePaymentStatus } from "@/db/membership-payments";
import { reconcileMembershipPaymentByBillingRequestId } from "@/lib/gocardless/membership-reconciliation";
import type { GoCardlessEvent } from "@/lib/gocardless/webhook";
import {
  getGoCardlessEventUserHints,
  getGoCardlessPaymentId,
  isMandateInvalidatedEvent,
  isMembershipMandateReadyEvent,
  isPaymentLifecycleEvent,
} from "@/lib/gocardless/webhook";
import { user } from "./schema/auth";
import { membershipPayments } from "./schema/membership-payments";

export async function recordAndProcessGoCardlessEvent(event: GoCardlessEvent) {
  const hints = getGoCardlessEventUserHints(event);

  if (isMembershipMandateReadyEvent(event) && hints.billingRequestId) {
    return reconcileMembershipPaymentByBillingRequestId(hints.billingRequestId);
  }

  if (isMandateInvalidatedEvent(event) && event.links.mandate) {
    await db
      .update(user)
      .set({ gocardlessMandateId: null })
      .where(eq(user.gocardlessMandateId, event.links.mandate));
    return { status: "mandate_cleared" as const };
  }

  if (isPaymentLifecycleEvent(event)) {
    return handlePaymentEvent(event);
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
