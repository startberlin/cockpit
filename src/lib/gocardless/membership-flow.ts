import { goCardlessRequest } from "./client";
import {
  customerMetadata,
  membershipFlowIdempotencyKey,
  membershipFlowMetadata,
  prefilledCustomerFromMembershipInput,
} from "./membership-flow-helpers";
import type {
  BillingRequestFlowState,
  BillingRequestState,
  MembershipFlowInput,
  MembershipFlowResult,
} from "./types";

const MEMBERSHIP_SUBSCRIPTION_AMOUNT = 4000;
const MEMBERSHIP_SUBSCRIPTION_CURRENCY = "EUR";
const MEMBERSHIP_SUBSCRIPTION_NAME = "START Membership";
const MEMBERSHIP_MANDATE_SCHEME = "sepa_core";

interface BillingRequestResponse {
  billing_requests: {
    id: string;
    status?: string;
    mandate_request?: {
      links?: {
        mandate?: string;
      };
    };
    links?: {
      customer?: string;
      mandate?: string;
      mandate_request_mandate?: string;
    };
  };
}

interface CustomerDetailsActionResponse {
  billing_requests: {
    id: string;
  };
}

interface BillingRequestFlowResponse {
  billing_request_flows: {
    id: string;
    authorisation_url: string;
    links: {
      billing_request: string;
    };
  };
}

interface SubscriptionResponse {
  subscriptions: {
    id: string;
    links: {
      mandate: string;
    };
  };
}

export async function createMembershipFlow(
  input: MembershipFlowInput,
): Promise<MembershipFlowResult> {
  const idempotencyKey = membershipFlowIdempotencyKey(input);
  const billingRequestId =
    input.existingBillingRequestId ??
    (await createMembershipBillingRequest(input, idempotencyKey));

  if (!input.existingCustomerId) {
    await collectMembershipCustomerDetails({
      billingRequestId,
      input,
      idempotencyKey: `${idempotencyKey}:customer-details`,
    });
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
    idempotencyKey,
  };
}

async function createMembershipBillingRequest(
  input: MembershipFlowInput,
  idempotencyKey: string,
) {
  const metadata = membershipFlowMetadata(input);
  const billingRequest = await goCardlessRequest<BillingRequestResponse>(
    "/billing_requests",
    {
      method: "POST",
      idempotencyKey,
      body: {
        billing_requests: {
          mandate_request: {
            currency: MEMBERSHIP_SUBSCRIPTION_CURRENCY,
            scheme: MEMBERSHIP_MANDATE_SCHEME,
          },
          metadata,
          links: input.existingCustomerId
            ? {
                customer: input.existingCustomerId,
              }
            : undefined,
        },
      },
    },
  );

  return billingRequest.billing_requests.id;
}

async function collectMembershipCustomerDetails({
  billingRequestId,
  input,
  idempotencyKey,
}: {
  billingRequestId: string;
  input: MembershipFlowInput;
  idempotencyKey: string;
}) {
  return goCardlessRequest<CustomerDetailsActionResponse>(
    `/billing_requests/${billingRequestId}/actions/collect_customer_details`,
    {
      method: "POST",
      idempotencyKey,
      body: {
        data: {
          customer: {
            ...prefilledCustomerFromMembershipInput(input),
            metadata: customerMetadata(input),
          },
        },
      },
    },
  );
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
  const billingRequestFlow =
    await goCardlessRequest<BillingRequestFlowResponse>(
      "/billing_request_flows",
      {
        method: "POST",
        idempotencyKey,
        body: {
          billing_request_flows: {
            redirect_uri: input.returnUrl,
            exit_uri: input.exitUrl,
            prefilled_customer: prefilledCustomerFromMembershipInput(input),
            links: {
              billing_request: billingRequestId,
            },
          },
        },
      },
    );

  return {
    id: billingRequestFlow.billing_request_flows.id,
    hostedUrl: billingRequestFlow.billing_request_flows.authorisation_url,
  };
}

export async function getBillingRequest(
  billingRequestId: string,
): Promise<BillingRequestState> {
  const response = await goCardlessRequest<BillingRequestResponse>(
    `/billing_requests/${billingRequestId}`,
  );

  const billingRequest = response.billing_requests;

  return {
    id: billingRequest.id,
    status: billingRequest.status ?? "unknown",
    customerId: billingRequest.links?.customer ?? null,
    mandateId:
      billingRequest.links?.mandate ??
      billingRequest.links?.mandate_request_mandate ??
      billingRequest.mandate_request?.links?.mandate ??
      null,
  };
}

export async function getBillingRequestFlow(
  billingRequestFlowId: string,
): Promise<BillingRequestFlowState> {
  const response = await goCardlessRequest<BillingRequestFlowResponse>(
    `/billing_request_flows/${billingRequestFlowId}`,
  );

  return {
    id: response.billing_request_flows.id,
    billingRequestId: response.billing_request_flows.links.billing_request,
  };
}

export async function createMembershipSubscription({
  mandateId,
  userId,
  email,
  localSessionId,
}: {
  mandateId: string;
  userId: string;
  email: string;
  localSessionId: string;
}) {
  const metadata = {
    start_cockpit_user_id: userId,
    start_cockpit_user_email: email,
    start_cockpit_session: localSessionId,
  };

  return goCardlessRequest<SubscriptionResponse>("/subscriptions", {
    method: "POST",
    idempotencyKey: `membership-subscription:${userId}:${mandateId}`,
    body: {
      subscriptions: {
        amount: MEMBERSHIP_SUBSCRIPTION_AMOUNT,
        currency: MEMBERSHIP_SUBSCRIPTION_CURRENCY,
        interval: 1,
        interval_unit: "yearly",
        name: MEMBERSHIP_SUBSCRIPTION_NAME,
        metadata,
        links: {
          mandate: mandateId,
        },
      },
    },
  });
}
