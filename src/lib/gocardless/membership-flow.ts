import { goCardlessRequest } from "./client";
import {
  customerMetadata,
  membershipFlowIdempotencyKey,
  membershipFlowMetadata,
  prefilledCustomerFromMembershipInput,
} from "./membership-flow-helpers";
import type {
  BillingRequestState,
  MembershipFlowInput,
  MembershipFlowResult,
} from "./types";

const MEMBERSHIP_SUBSCRIPTION_CURRENCY = "EUR";
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
    customerId,
    idempotencyKey,
  };
}

async function createMembershipBillingRequest(
  input: MembershipFlowInput,
  idempotencyKey: string,
): Promise<{ billingRequestId: string; customerId: string | null }> {
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

  return {
    billingRequestId: billingRequest.billing_requests.id,
    customerId: billingRequest.billing_requests.links?.customer ?? null,
  };
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
            skip_success_screen: true,
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
