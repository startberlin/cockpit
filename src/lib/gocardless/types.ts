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
