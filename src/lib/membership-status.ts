import type { User } from "@/db/schema/auth";
import type { MembershipPaymentStatus } from "@/db/schema/membership";
import { getOnboardingProgress } from "@/schema/onboarding-progress";

export type MembershipViewState =
  | "profile_onboarding"
  | "payment_pending"
  | "payment_processing"
  | "full_member";

export interface MembershipPaymentState {
  status: MembershipPaymentStatus;
}

export function getMembershipViewState(
  user: User,
  payment: MembershipPaymentState | null | undefined,
): MembershipViewState {
  if (getOnboardingProgress(user) !== "completed") {
    return "profile_onboarding";
  }

  if (payment?.status === "active") {
    return "full_member";
  }

  if (user.status === "member" && !payment) {
    return "full_member";
  }

  if (payment?.status === "checkout_started") {
    return "payment_processing";
  }

  if (payment) {
    return "payment_pending";
  }

  return "profile_onboarding";
}

export function isProfileOnboardingComplete(user: User) {
  return getOnboardingProgress(user) === "completed";
}

export function isPaymentPendingState(state: MembershipViewState) {
  return state === "payment_pending";
}
