import { eq } from "drizzle-orm";
import db from "@/db";
import { getUserByCustomerId } from "@/db/membership";
import { user } from "@/db/schema/auth";
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

  await db
    .update(user)
    .set({
      gocardlessMandateId: mandateId,
      gocardlessCustomerId: customerId,
      gocardlessSetupSessionId: null,
    })
    .where(eq(user.id, member.id));

  return { status: "activated", hostedRedirect: "/membership" };
}
