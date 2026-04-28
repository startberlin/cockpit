export const GOCARDLESS_API_VERSION = "2015-07-06";

export interface MembershipFlowInput {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  address?: {
    street?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    country?: string | null;
  };
  returnUrl: string;
  exitUrl: string;
  localSessionId: string;
  existingCustomerId?: string | null;
  existingBillingRequestId?: string | null;
}

export interface MembershipFlowResult {
  hostedUrl: string;
  billingRequestId: string;
  billingRequestFlowId: string;
  customerId?: string | null;
  idempotencyKey: string;
}

export interface BillingRequestState {
  id: string;
  status: string;
  customerId?: string | null;
  mandateId?: string | null;
}

export interface BillingRequestFlowState {
  id: string;
  billingRequestId: string;
}

export class GoCardlessConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoCardlessConfigurationError";
  }
}

export class GoCardlessCapabilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoCardlessCapabilityError";
  }
}

export class GoCardlessRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly responseBody: string,
  ) {
    super(message);
    this.name = "GoCardlessRequestError";
  }
}
