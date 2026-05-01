import type { UserStatus } from "@/db/schema/auth";
import type { MembershipViewState } from "@/lib/membership-status";

type MembershipOnboardingMode =
  | MembershipViewState
  | "profile_onboarding"
  | "payment_pending"
  | "payment_processing";

type MembershipToolsCopy =
  | {
      visible: false;
      title: null;
      description: null;
      actionLabel: null;
    }
  | {
      visible: true;
      title: string;
      description: string;
      actionLabel: string;
    };

export function getMembershipBillingCopy({
  mode,
  userStatus = "onboarding",
  paidThroughAt,
  now = new Date(),
}: {
  mode: MembershipOnboardingMode;
  userStatus?: UserStatus;
  paidThroughAt?: Date | null;
  now?: Date;
}) {
  if (mode === "payment_processing") {
    return {
      title: "Confirming your payment setup.",
      description:
        "We're waiting for GoCardless to confirm your membership payment setup. This usually takes a moment.",
      paymentNote: null,
    };
  }

  if (mode === "payment_pending") {
    const coveredThrough =
      paidThroughAt && paidThroughAt >= now ? formatDate(paidThroughAt) : null;

    if (coveredThrough) {
      return {
        title: "Set up your membership billing.",
        description: `Your membership fee has been paid until ${coveredThrough}. Set up your yearly membership billing now. START Berlin will only charge you after your current membership period has ended.`,
        paymentNote: `You will not be charged before ${coveredThrough}.`,
      };
    }

    return {
      title: "Set up your membership billing.",
      description:
        "Set up your yearly membership billing. Your first membership fee will be collected as soon as GoCardless confirms the setup.",
      paymentNote: null,
    };
  }

  if (mode === "full_member") {
    const coveredThrough =
      paidThroughAt && paidThroughAt >= now ? formatDate(paidThroughAt) : null;

    if (coveredThrough) {
      return {
        title: "Your membership is active.",
        description: `Your current membership period is covered through ${coveredThrough}. Your yearly billing is set up for the following period.`,
        paymentNote: null,
      };
    }

    return {
      title: "Your membership is active.",
      description:
        "Your yearly membership billing is active. Future membership actions will appear here.",
      paymentNote: null,
    };
  }

  if (userStatus === "alumni") {
    return {
      title: "Your alumni status is active.",
      description:
        "You currently do not have an active paid membership. Membership actions will appear here when they are available.",
      paymentNote: null,
    };
  }

  return {
    title: "You're in the onboarding phase.",
    description:
      "We're glad to have you on board. After the onboarding phase, you'll see your membership details here.",
    paymentNote: null,
  };
}

export function getMembershipToolsCopy(
  status: UserStatus,
): MembershipToolsCopy {
  if (status === "alumni") {
    return {
      visible: false,
      title: null,
      description: null,
      actionLabel: null,
    };
  }

  if (status === "onboarding") {
    return {
      visible: true,
      title: "First steps",
      description: "Set up your most important software accounts",
      actionLabel: "Join",
    };
  }

  return {
    visible: true,
    title: "Your software & tools",
    description: "Open the software accounts available to you",
    actionLabel: "Open",
  };
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
