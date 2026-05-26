import { and, eq, isNull } from "drizzle-orm";
import db from "@/db";
import { getUserByCustomerId } from "@/db/membership";
import { user } from "@/db/schema/auth";
import { events, inngest } from "@/lib/inngest";
import { getBillingRequest } from "./membership-flow";

export type MembershipReconciliationResult =
  | { status: "activated" | "already_active"; hostedRedirect: "/membership" }
  | {
      status: "not_ready" | "failed";
      message: string;
      hostedRedirect?: never;
    };

export async function reconcileMembershipPaymentByBillingRequestId(
  billingRequestId: string,
): Promise<MembershipReconciliationResult> {
  const billingRequest = await getBillingRequest(billingRequestId);

  if (!billingRequest.customerId) {
    return {
      status: "failed",
      message: "GoCardless did not return a customer for this billing request.",
    };
  }

  const member = await getUserByCustomerId(billingRequest.customerId);

  if (!member) {
    // Customer not yet stored locally — user will re-trigger via the redirect path.
    return {
      status: "failed",
      message: "No local user matched this GoCardless customer.",
    };
  }

  if (member.gocardlessMandateId) {
    // Re-emit as an idempotent recovery step: if the DB write succeeded but
    // the original send failed, reminder workflows would otherwise run forever.
    try {
      await inngest.send({
        name: events.mandateActivated.name,
        data: { userId: member.id },
      });
    } catch {
      // Non-fatal — reconciliation result is correct; reminders time out naturally.
    }
    return { status: "already_active", hostedRedirect: "/membership" };
  }

  return reconcileMembershipPayment(member, billingRequestId);
}

async function reconcileMembershipPayment(
  member: {
    id: string;
    gocardlessMandateId: string | null;
  },
  billingRequestId: string,
): Promise<MembershipReconciliationResult> {
  const billingRequest = await getBillingRequest(billingRequestId);
  const customerId = billingRequest.customerId ?? null;
  const mandateId = billingRequest.mandateId ?? null;

  if (billingRequest.status === "cancelled") {
    return {
      status: "failed",
      message: "This GoCardless setup was cancelled. Please start again.",
    };
  }

  if (!mandateId) {
    return {
      status: "not_ready",
      message:
        "GoCardless has not confirmed the mandate yet. Please try again in a moment.",
    };
  }

  // Conditional write: if a concurrent reconciliation already stored a mandate
  // (two fulfilled webhooks racing), don't overwrite it with a different one.
  await db
    .update(user)
    .set({
      gocardlessMandateId: mandateId,
      gocardlessCustomerId: customerId,
      gocardlessSetupSessionId: null,
    })
    .where(and(eq(user.id, member.id), isNull(user.gocardlessMandateId)));

  // Send mandateActivated regardless — if another concurrent write won, the
  // reminder workflows still need to be cancelled.
  await inngest.send({
    name: events.mandateActivated.name,
    data: { userId: member.id },
  });

  return { status: "activated", hostedRedirect: "/membership" };
}
