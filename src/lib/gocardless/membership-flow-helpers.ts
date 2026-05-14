import { findCountryByName } from "../countries";
import type { MembershipFlowInput } from "./types";

export function membershipFlowIdempotencyKey(
  userId: string,
  localSessionId: string,
) {
  return `membership-payment:${userId}:${localSessionId}`;
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
  const countryCode = findCountryByName(input.address?.country ?? "")?.code;

  return stripEmptyValues({
    given_name: input.firstName,
    family_name: input.lastName,
    email: input.email,
    address_line1: input.address?.street,
    city: input.address?.city,
    region: input.address?.state,
    postal_code: input.address?.zip,
    country_code: countryCode,
  });
}

export function billingDetailFromMembershipInput(input: MembershipFlowInput) {
  const countryCode = findCountryByName(input.address?.country ?? "")?.code;

  return stripEmptyValues({
    address_line1: input.address?.street,
    city: input.address?.city,
    region: input.address?.state,
    postal_code: input.address?.zip,
    country_code: countryCode,
  });
}

export function customerMetadata(input: MembershipFlowInput) {
  return {
    start_cockpit_user_id: input.userId,
    start_cockpit_user_email: input.email,
  };
}

export function subscriptionIdempotencyKey(
  membershipPaymentId: string,
  startDate: string | null | undefined,
) {
  return `membership-subscription:${membershipPaymentId}:${startDate ?? "no-date"}`;
}

export function membershipSubscriptionStartDate(
  paidThroughAt: Date | null | undefined,
  now = new Date(),
) {
  if (!paidThroughAt || paidThroughAt < now) {
    return null;
  }

  const startDate = new Date(
    Date.UTC(
      paidThroughAt.getUTCFullYear(),
      paidThroughAt.getUTCMonth(),
      paidThroughAt.getUTCDate() + 1,
    ),
  );

  return startDate.toISOString().slice(0, 10);
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
