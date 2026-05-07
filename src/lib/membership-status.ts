import type { LegalMembershipState, User } from "@/db/schema/auth";
import type { MembershipPaymentStatus } from "@/db/schema/membership";
import { getOnboardingProgress } from "@/schema/onboarding-progress";

export interface MembershipPaymentState {
  status: MembershipPaymentStatus;
  gocardlessSubscriptionId?: string | null;
  paidThroughAt?: Date | null;
}

export type MembershipProfileState = "incomplete" | "complete";

export type MembershipPaymentViewState =
  | "not_required"
  | "not_started"
  | "pending"
  | "processing"
  | "active"
  | "failed"
  | "covered_until_date";

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
  { now = new Date() }: { now?: Date } = {},
): StructuredMembershipState {
  const profileOnboardingComplete = getOnboardingProgress(user) === "completed";
  const canContinueBilling =
    (user.status === "member" || user.status === "supporting_alumni") &&
    !!payment;

  const profile: MembershipProfileState = profileOnboardingComplete
    ? "complete"
    : "incomplete";
  const paymentState = getPaymentViewState(user, payment, now);
  const paymentSetupAllowed =
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
  now: Date,
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

  if (isFullMemberPaymentState(payment, now)) {
    return "active";
  }

  if (payment.paidThroughAt && payment.paidThroughAt >= now) {
    return "covered_until_date";
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
    !!payment ||
    user.status === "member" ||
    user.status === "supporting_alumni"
  );
}

function isFullMemberPaymentState(
  payment: MembershipPaymentState | null | undefined,
  now: Date,
) {
  return (
    payment?.status === "active" &&
    (payment.gocardlessSubscriptionId ||
      !payment.paidThroughAt ||
      payment.paidThroughAt >= now)
  );
}

function isPaymentSetupState(state: MembershipPaymentViewState) {
  return (
    state === "not_started" ||
    state === "pending" ||
    state === "processing" ||
    state === "failed" ||
    state === "covered_until_date"
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
