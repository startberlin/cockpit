import type { LegalMembershipState, User } from "@/db/schema/auth";
import { getOnboardingProgress } from "@/schema/onboarding-progress";

export type MembershipProfileState = "incomplete" | "complete";

export type MembershipPaymentViewState =
  | "not_required"
  | "not_started"
  | "active";

export type MembershipNextAction =
  | "complete_profile"
  | "set_up_payment"
  | "none";

export interface StructuredMembershipState {
  profile: MembershipProfileState;
  operational: MembershipStatusUser["status"];
  legal: LegalMembershipState;
  payment: MembershipPaymentViewState;
  nextAction: MembershipNextAction;
  paymentSetupAllowed: boolean;
}

type MembershipStatusUser = Pick<
  User,
  | "personalEmail"
  | "phone"
  | "birthDate"
  | "street"
  | "city"
  | "state"
  | "zip"
  | "country"
  | "status"
  | "legalMembershipState"
  | "gocardlessMandateId"
>;

export function getStructuredMembershipState(
  user: MembershipStatusUser,
): StructuredMembershipState {
  const profileOnboardingComplete = getOnboardingProgress(user) === "completed";
  const hasMandate = !!user.gocardlessMandateId;
  const canContinueBilling =
    user.status === "member" || user.status === "supporting_alumni";

  const profile: MembershipProfileState = profileOnboardingComplete
    ? "complete"
    : "incomplete";
  const paymentState = getPaymentViewState(user);
  const paymentSetupAllowed =
    user.legalMembershipState === "active_member" &&
    (profileOnboardingComplete || canContinueBilling) &&
    !hasMandate &&
    user.status !== "alumni";

  return {
    profile,
    operational: user.status,
    legal: user.legalMembershipState,
    payment: paymentState,
    nextAction: getNextAction({
      paymentSetupAllowed,
      profileOnboardingComplete,
      paymentState,
    }),
    paymentSetupAllowed,
  };
}

function getPaymentViewState(
  user: MembershipStatusUser,
): MembershipPaymentViewState {
  if (user.gocardlessMandateId) {
    return "active";
  }

  if (user.status === "alumni") {
    return "not_required";
  }

  return "not_started";
}

function getNextAction({
  paymentSetupAllowed,
  profileOnboardingComplete,
  paymentState,
}: {
  paymentSetupAllowed: boolean;
  profileOnboardingComplete: boolean;
  paymentState: MembershipPaymentViewState;
}): MembershipNextAction {
  if (paymentState === "active" || paymentState === "not_required") {
    return "none";
  }

  if (!profileOnboardingComplete && !paymentSetupAllowed) {
    return "complete_profile";
  }

  if (paymentSetupAllowed) {
    return "set_up_payment";
  }

  return "none";
}
