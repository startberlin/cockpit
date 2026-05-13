import { SubscriptionIntervalUnit } from "gocardless-nodejs/types";
import { gocardless } from "./client";
import {
  billingDetailFromMembershipInput,
  customerMetadata,
  membershipFlowIdempotencyKey,
  membershipFlowMetadata,
  prefilledCustomerFromMembershipInput,
  subscriptionIdempotencyKey,
} from "./membership-flow-helpers";
import type {
  BillingRequestState,
  MembershipFlowInput,
  MembershipFlowResult,
} from "./types";

const MEMBERSHIP_SUBSCRIPTION_AMOUNT = 4000;
const MEMBERSHIP_SUBSCRIPTION_CURRENCY = "EUR";
const MEMBERSHIP_SUBSCRIPTION_NAME = "START Berlin Membership";
const MEMBERSHIP_MANDATE_SCHEME = "sepa_core";

export async function createMembershipFlow(
  input: MembershipFlowInput,
): Promise<MembershipFlowResult> {
  const idempotencyKey = membershipFlowIdempotencyKey(
    input.userId,
    input.localSessionId,
  );

  let billingRequestId: string;
  let customerId: string | null;

  if (input.existingBillingRequestId) {
    billingRequestId = input.existingBillingRequestId;
    customerId = input.existingCustomerId ?? null;
  } else {
    const br = await createMembershipBillingRequest(input, idempotencyKey);
    billingRequestId = br.billingRequestId;
    customerId = br.customerId;
  }

  if (!input.existingCustomerId) {
    await collectMembershipCustomerDetails({ billingRequestId, input });
  }

  const billingRequestFlow = await createMembershipBillingRequestFlow({
    billingRequestId,
    input,
    idempotencyKey: `${idempotencyKey}:flow`,
  });

  return {
    hostedUrl: billingRequestFlow.hostedUrl,
    billingRequestId,
    billingRequestFlowId: billingRequestFlow.id,
    customerId,
    idempotencyKey,
  };
}

async function createMembershipBillingRequest(
  input: MembershipFlowInput,
  idempotencyKey: string,
): Promise<{ billingRequestId: string; customerId: string | null }> {
  const metadata = membershipFlowMetadata(input);

  const billingRequest = await gocardless.billingRequests.create(
    {
      mandate_request: {
        currency: MEMBERSHIP_SUBSCRIPTION_CURRENCY,
        scheme: MEMBERSHIP_MANDATE_SCHEME,
      },
      metadata,
      links: input.existingCustomerId
        ? { customer: input.existingCustomerId }
        : undefined,
    },
    idempotencyKey,
  );

  return {
    billingRequestId: billingRequest.id,
    customerId: billingRequest.links?.customer ?? null,
  };
}

async function collectMembershipCustomerDetails({
  billingRequestId,
  input,
}: {
  billingRequestId: string;
  input: MembershipFlowInput;
}) {
  const prefilled = prefilledCustomerFromMembershipInput(input);

  return gocardless.billingRequests.collectCustomerDetails(billingRequestId, {
    customer: {
      given_name: prefilled.given_name as string | undefined,
      family_name: prefilled.family_name as string | undefined,
      email: prefilled.email as string | undefined,
      metadata: customerMetadata(input),
    },
    customer_billing_detail: billingDetailFromMembershipInput(input),
  });
}

export async function createMembershipBillingRequestFlow({
  billingRequestId,
  input,
  idempotencyKey,
}: {
  billingRequestId: string;
  input: MembershipFlowInput;
  idempotencyKey: string;
}) {
  const flow = await gocardless.billingRequestFlows.create(
    {
      redirect_uri: input.returnUrl,
      exit_uri: input.exitUrl,
      skip_success_screen: true,
      prefilled_customer: prefilledCustomerFromMembershipInput(input),
      links: { billing_request: billingRequestId },
    },
    idempotencyKey,
  );

  return {
    id: flow.id,
    hostedUrl: flow.authorisation_url ?? "",
  };
}

export async function getBillingRequest(
  billingRequestId: string,
): Promise<BillingRequestState> {
  const billingRequest =
    await gocardless.billingRequests.find(billingRequestId);

  return {
    id: billingRequest.id,
    status: billingRequest.status ?? "unknown",
    customerId: billingRequest.links?.customer ?? null,
    mandateId: billingRequest.links?.mandate_request_mandate ?? null,
  };
}

export async function createMembershipSubscription({
  mandateId,
  userId,
  email,
  membershipPaymentId,
  startDate,
}: {
  mandateId: string;
  userId: string;
  email: string;
  membershipPaymentId: string;
  startDate?: string | null;
}): Promise<string> {
  const metadata = {
    start_cockpit_user_id: userId,
    start_cockpit_user_email: email,
    start_cockpit_session: membershipPaymentId,
  };

  const subscription = await gocardless.subscriptions.create(
    {
      amount: String(MEMBERSHIP_SUBSCRIPTION_AMOUNT),
      currency: MEMBERSHIP_SUBSCRIPTION_CURRENCY,
      interval: "1",
      interval_unit: SubscriptionIntervalUnit.Yearly,
      name: MEMBERSHIP_SUBSCRIPTION_NAME,
      start_date: startDate ?? undefined,
      metadata,
      links: { mandate: mandateId },
    },
    subscriptionIdempotencyKey(membershipPaymentId, startDate),
  );

  if (!subscription.id)
    throw new Error("GoCardless did not return a subscription id");
  return subscription.id;
}
