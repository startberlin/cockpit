import type { UserStatus } from "@/db/schema/auth";
import type { MembershipPaymentViewState } from "@/lib/membership-status";

type MembershipBillingMode = MembershipPaymentViewState;

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
  mode: MembershipBillingMode;
  userStatus?: UserStatus;
  paidThroughAt?: Date | null;
  now?: Date;
}) {
  if (mode === "processing") {
    return {
      title: "Finishing your membership setup",
      description:
        "We're updating your membership status. This usually only takes a moment.",
      paymentNote: null,
    };
  }

  if (userStatus === "onboarding") {
    return {
      title: "You're in the onboarding phase.",
      description:
        "We're glad to have you on board. After the onboarding phase, you'll see your membership details here.",
      paymentNote: null,
    };
  }

  if (
    mode === "not_started" ||
    mode === "pending" ||
    mode === "failed" ||
    mode === "covered_until_date"
  ) {
    const coveredThrough =
      paidThroughAt && paidThroughAt >= now ? formatDate(paidThroughAt) : null;

    if (coveredThrough) {
      return {
        title: "Set up your yearly membership payment",
        description: `Your START Berlin membership costs 40 EUR per year. It covers the essentials that keep the association running and helps fund internal and external events and member benefits throughout the year. Your current membership period is covered through ${coveredThrough}, so you will not be charged before then.`,
        paymentNote: `You will not be charged before ${coveredThrough}.`,
      };
    }

    return {
      title: "Set up your yearly membership payment",
      description:
        "Your START Berlin membership costs 40 EUR per year. It covers the essentials that keep the association running and helps fund internal and external events and member benefits throughout the year.",
      paymentNote: null,
    };
  }

  if (mode === "active") {
    if (userStatus === "supporting_alumni") {
      return {
        title: "Thanks for supporting START Berlin",
        description:
          "Your yearly payment is set up. Thank you for continuing to support the community as alumni.",
        paymentNote: null,
      };
    }

    const coveredThrough =
      paidThroughAt && paidThroughAt >= now ? formatDate(paidThroughAt) : null;

    if (coveredThrough) {
      return {
        title: "Your membership is active",
        description: `Your current membership period is covered through ${coveredThrough}. Your yearly membership payment is set up for the following period.`,
        paymentNote: null,
      };
    }

    return {
      title: "Your membership is active",
      description:
        "Your yearly membership payment is set up. Thanks for being part of START Berlin.",
      paymentNote: null,
    };
  }

  if (mode === "not_required" || userStatus === "alumni") {
    return {
      title: "You're listed as alumni",
      description:
        "No membership payment is needed. START Cockpit will show anything relevant to your alumni status here.",
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
      title: "Get connected",
      description:
        "Join the START Berlin workspaces where members coordinate, share resources, and work on projects.",
      actionLabel: "Join",
    };
  }

  return {
    visible: true,
    title: "Your START Berlin tools",
    description:
      "Open the workspaces you use for communication, projects, and resources.",
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
