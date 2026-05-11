import type { LegalMembershipState, User } from "@/db/schema/auth";
import type { MembershipPaymentStatus } from "@/db/schema/membership";
import { getOnboardingProgress } from "@/schema/onboarding-progress";

export interface MembershipPaymentState {
  status: MembershipPaymentStatus;
}

export type MembershipProfileState = "incomplete" | "complete";

export type MembershipPaymentViewState =
  | "not_required"
  | "not_started"
  | "pending"
  | "processing"
  | "active"
  | "failed";

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
>;

export function getStructuredMembershipState(
  user: MembershipStatusUser,
  payment: MembershipPaymentState | null | undefined,
): StructuredMembershipState {
  const profileOnboardingComplete = getOnboardingProgress(user) === "completed";
  const canContinueBilling =
    (user.status === "member" || user.status === "supporting_alumni") &&
    !!payment;

  const profile: MembershipProfileState = profileOnboardingComplete
    ? "complete"
    : "incomplete";
  const paymentState = getPaymentViewState(user, payment);
  const paymentSetupAllowed =
    user.legalMembershipState === "active_member" &&
    (profileOnboardingComplete || canContinueBilling) &&
    canSetUpPayment(user, payment) &&
    isPaymentSetupState(paymentState);

  return {
    profile,
    operational: user.status,
    legal: user.legalMembershipState,
    payment: paymentState,
    nextAction: getNextAction({
      paymentSetupAllowed,
      profileOnboardingComplete,
    }),
    paymentSetupAllowed,
  };
}

function getPaymentViewState(
  user: MembershipStatusUser,
  payment: MembershipPaymentState | null | undefined,
): MembershipPaymentViewState {
  if (user.status === "alumni" && !payment) {
    return "not_required";
  }

  if (!payment) {
    return "not_started";
  }

  if (payment.status === "checkout_started") {
    return "processing";
  }

  if (payment.status === "failed") {
    return "failed";
  }

  if (isFullMemberPaymentState(payment)) {
    return "active";
  }

  return "pending";
}

function canSetUpPayment(
  user: MembershipStatusUser,
  payment: MembershipPaymentState | null | undefined,
) {
  if (user.status === "alumni") {
    return false;
  }

  return (
    !!payment || user.status === "member" || user.status === "supporting_alumni"
  );
}

function isFullMemberPaymentState(
  payment: MembershipPaymentState | null | undefined,
) {
  return payment?.status === "active";
}

function isPaymentSetupState(state: MembershipPaymentViewState) {
  return (
    state === "not_started" ||
    state === "pending" ||
    state === "processing" ||
    state === "failed"
  );
}

function getNextAction({
  paymentSetupAllowed,
  profileOnboardingComplete,
}: {
  paymentSetupAllowed: boolean;
  profileOnboardingComplete: boolean;
}): MembershipNextAction {
  if (!profileOnboardingComplete && !paymentSetupAllowed) {
    return "complete_profile";
  }

  if (paymentSetupAllowed) {
    return "set_up_payment";
  }

  return "none";
}
