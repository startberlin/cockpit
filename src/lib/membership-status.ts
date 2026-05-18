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
  mandateCancelled: boolean;
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
  | "gocardlessCustomerId"
  | "eventEmailPreference"
>;

export function getStructuredMembershipState(
  user: MembershipStatusUser,
): StructuredMembershipState {
  const profileOnboardingComplete = getOnboardingProgress(user) === "completed";
  const hasMandate = !!user.gocardlessMandateId;
  const hasGoCardlessCustomer = !!user.gocardlessCustomerId;
  const isActiveLegalMember = user.legalMembershipState === "active_member";
  const isNotAlumni = user.status !== "alumni";
  const canContinueBilling =
    user.status === "member" || user.status === "supporting_alumni";

  const profile: MembershipProfileState = profileOnboardingComplete
    ? "complete"
    : "incomplete";
  const paymentState = getPaymentViewState(user);

  // True only when all four gates pass:
  //   1. Legal admission is complete (board must have approved first)
  //   2. Profile is ready: new members must finish onboarding; existing
  //      members/supporting_alumni skip this because they already did it
  //      when they first joined and may just be re-connecting a lapsed mandate
  //   3. No mandate yet — nothing to set up if billing is already active
  //   4. Not alumni — they are exempt from payment obligations entirely
  const paymentSetupAllowed =
    isActiveLegalMember &&
    (profileOnboardingComplete || canContinueBilling) &&
    !hasMandate &&
    isNotAlumni;

  const mandateCancelled = isNotAlumni && hasGoCardlessCustomer && !hasMandate;

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
    mandateCancelled,
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
