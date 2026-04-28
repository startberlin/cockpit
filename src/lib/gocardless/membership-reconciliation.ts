import { eq } from "drizzle-orm";
import db from "@/db";
import {
  activateMembershipPayment,
  getMembershipPaymentByBillingRequestFlowId,
  getMembershipPaymentByBillingRequestId,
  getMembershipPaymentByUserId,
  recordMembershipProviderState,
} from "@/db/membership";
import { user } from "@/db/schema/auth";
import {
  createMembershipSubscription,
  getBillingRequest,
  getBillingRequestFlow,
} from "./membership-flow";

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
  const payment = billingRequestFlowId
    ? await getMembershipPaymentByBillingRequestFlowId(billingRequestFlowId)
    : await getMembershipPaymentByUserId(userId);

  if (!payment || payment.userId !== userId) {
    return {
      status: "failed",
      message: "We could not find a matching membership payment attempt.",
    };
  }

  return reconcileMembershipPayment(payment);
}

export async function reconcileMembershipPaymentByBillingRequestId(
  billingRequestId: string,
): Promise<MembershipReconciliationResult> {
  const payment =
    await getMembershipPaymentByBillingRequestId(billingRequestId);

  if (!payment) {
    return {
      status: "failed",
      message: "No local membership payment matched this GoCardless request.",
    };
  }

  return reconcileMembershipPayment(payment);
}

async function reconcileMembershipPayment(
  payment: NonNullable<
    Awaited<ReturnType<typeof getMembershipPaymentByUserId>>
  >,
): Promise<MembershipReconciliationResult> {
  if (payment.status === "active" && payment.gocardlessSubscriptionId) {
    return { status: "already_active", hostedRedirect: "/membership" };
  }

  const member = await db.query.user.findFirst({
    where: eq(user.id, payment.userId),
  });

  if (!member) {
    return {
      status: "failed",
      message: "We could not find the member connected to this payment.",
    };
  }

  let billingRequestId = payment.gocardlessBillingRequestId;

  if (!billingRequestId && payment.gocardlessBillingRequestFlowId) {
    const flow = await getBillingRequestFlow(
      payment.gocardlessBillingRequestFlowId,
    );
    billingRequestId = flow.billingRequestId;
    await recordMembershipProviderState({
      membershipPaymentId: payment.id,
      gocardlessBillingRequestId: billingRequestId,
      gocardlessBillingRequestFlowId: flow.id,
    });
  }

  if (!billingRequestId) {
    return {
      status: "failed",
      message: "GoCardless did not return a billing request for this payment.",
    };
  }

  const billingRequest = await getBillingRequest(billingRequestId);
  const customerId =
    billingRequest.customerId ?? payment.gocardlessCustomerId ?? null;
  const mandateId = billingRequest.mandateId ?? payment.gocardlessMandateId;

  await recordMembershipProviderState({
    membershipPaymentId: payment.id,
    gocardlessCustomerId: customerId,
    gocardlessBillingRequestId: billingRequest.id,
    gocardlessMandateId: mandateId ?? null,
  });

  if (billingRequest.status === "cancelled") {
    await recordMembershipProviderState({
      membershipPaymentId: payment.id,
      status: "failed",
    });

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

  const subscription =
    payment.gocardlessSubscriptionId ??
    (
      await createMembershipSubscription({
        mandateId,
        userId: payment.userId,
        email: member.email,
        localSessionId: payment.id,
      })
    ).subscriptions.id;

  await activateMembershipPayment({
    membershipPaymentId: payment.id,
    gocardlessCustomerId: customerId,
    gocardlessMandateId: mandateId,
    gocardlessSubscriptionId: subscription,
  });

  return { status: "activated", hostedRedirect: "/membership" };
}
