import type { MembershipFlowInput } from "./types";

export function membershipFlowIdempotencyKey(input: MembershipFlowInput) {
  return `membership-payment:${input.userId}:${input.localSessionId}`;
}

export function membershipFlowMetadata(input: MembershipFlowInput) {
  return {
    start_cockpit_user_id: input.userId,
    start_cockpit_user_email: input.email,
    start_cockpit_session: input.localSessionId,
  };
}

export function prefilledCustomerFromMembershipInput(
  input: MembershipFlowInput,
) {
  return stripEmptyValues({
    given_name: input.firstName,
    family_name: input.lastName,
    email: input.email,
    address_line1: input.address?.street,
    city: input.address?.city,
    region: input.address?.state,
    postal_code: input.address?.zip,
    country_code: input.address?.country,
  });
}

export function customerMetadata(input: MembershipFlowInput) {
  return {
    start_cockpit_user_id: input.userId,
    start_cockpit_user_email: input.email,
  };
}

function stripEmptyValues(
  values: Record<string, string | Record<string, string> | null | undefined>,
) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => {
      if (typeof value === "string") {
        return value.trim();
      }

      return value && Object.keys(value).length > 0;
    }),
  );
}
