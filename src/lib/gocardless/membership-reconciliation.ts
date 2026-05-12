import { eq } from "drizzle-orm";
import db from "@/db";
import { getUserByCustomerId } from "@/db/membership";
import { createProposedPayment } from "@/db/membership-payments";
import { user } from "@/db/schema/auth";
import { getBillingRequest, getBillingRequestFlow } from "./membership-flow";

export type MembershipReconciliationResult =
  | { status: "activated" | "already_active"; hostedRedirect: "/membership" }
  | {
      status: "not_ready" | "failed";
      message: string;
      hostedRedirect?: never;
    };

export async function reconcileMembershipPaymentForUser({
  userId,
  billingRequestFlowId,
}: {
  userId: string;
  billingRequestFlowId?: string | null;
}): Promise<MembershipReconciliationResult> {
  const member = await db.query.user.findFirst({
    where: eq(user.id, userId),
  });

  if (!member) {
    return {
      status: "failed",
      message: "We could not find your account.",
    };
  }

  if (member.gocardlessMandateId) {
    return { status: "already_active", hostedRedirect: "/membership" };
  }

  if (!billingRequestFlowId) {
    return {
      status: "not_ready",
      message:
        "No billing request flow provided. Please try setting up payment again.",
    };
  }

  const flow = await getBillingRequestFlow(billingRequestFlowId);
  return reconcileMembershipPayment(member, flow.billingRequestId);
}

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
    status: string;
    legalMembershipState: string;
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

  await db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({
        gocardlessMandateId: mandateId,
        gocardlessCustomerId: customerId,
        // Advance onboarding → member once mandate is confirmed
        ...(member.status === "onboarding" &&
        member.legalMembershipState === "active_member"
          ? { status: "member" as const }
          : {}),
      })
      .where(eq(user.id, member.id));

    const today = new Date().toISOString().slice(0, 10);
    await createProposedPayment(member.id, today, tx);
  });

  return { status: "activated", hostedRedirect: "/membership" };
}
