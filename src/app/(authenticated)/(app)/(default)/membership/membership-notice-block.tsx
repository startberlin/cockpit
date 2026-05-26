import {
  ClockIcon,
  FileTextIcon,
  InfoIcon,
  LandmarkIcon,
  MailIcon,
  UserCheckIcon,
} from "lucide-react";
import Link from "next/link";
import type React from "react";
import { Button } from "@/components/ui/button";
import type { MembershipTransitionRequest } from "@/db/membership-transitions";
import type { UserStatus } from "@/db/schema/auth";
import type { LegalMembershipStatus } from "@/db/schema/legal-membership";
import type { StructuredMembershipState } from "@/lib/membership-status";
import { cn } from "@/lib/utils";
import {
  deriveMembershipNotice,
  type MembershipNoticeType,
} from "./membership-notice-state";
import { PaymentButton } from "./payment-button";
import { TransitionWithdrawButton } from "./transition-withdraw-button";

export { deriveMembershipNotice, type MembershipNoticeType };

interface MembershipNoticeBlockProps {
  membershipState: StructuredMembershipState;
  legalMembershipStatus: LegalMembershipStatus | null;
  userStatus: UserStatus;
  pendingTransition?: MembershipTransitionRequest | null;
}

function NoticePanel({
  icon,
  title,
  body,
  action,
  className,
  iconClassName,
}: {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <div
      className={`flex gap-4 items-start border p-6 ${className ?? "bg-blue-50 border-blue-200"}`}
    >
      <span className={cn("shrink-0 mt-0.5", iconClassName)}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-base leading-snug">{title}</div>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
          {body}
        </p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}

export function MembershipNoticeBlock({
  membershipState,
  legalMembershipStatus,
  userStatus,
  pendingTransition,
}: MembershipNoticeBlockProps) {
  const notice = deriveMembershipNotice(
    membershipState,
    legalMembershipStatus,
    userStatus,
    pendingTransition,
  );

  if (!notice) return null;

  if (notice === "alumni") {
    return (
      <NoticePanel
        icon={<InfoIcon className="size-5" />}
        title="You're listed as alumni"
        body="You are no longer a member of START Berlin e.V. If you would like to rejoin, get in touch with us — we'd love to have you back."
        className="bg-secondary/50 border-border"
        iconClassName="text-muted-foreground"
      />
    );
  }

  if (notice === "application_pending") {
    return (
      <NoticePanel
        icon={<FileTextIcon className="size-5" />}
        title="Fill out your membership application"
        body="A few details are needed to generate your membership documents. This only takes a few minutes."
        action={
          <Button asChild size="sm">
            <Link href="/membership/application/personal-information">
              Start membership application
            </Link>
          </Button>
        }
      />
    );
  }

  if (notice === "membership_reconfirmation_pending") {
    return (
      <NoticePanel
        icon={<UserCheckIcon className="size-5" />}
        title="Confirm your membership"
        body="We need a few details to confirm your membership. This only takes a few minutes."
        action={
          <Button asChild size="sm">
            <Link href="/membership/application/personal-information">
              Start membership confirmation
            </Link>
          </Button>
        }
      />
    );
  }

  if (notice === "manual_followup") {
    return (
      <NoticePanel
        icon={<MailIcon className="size-5" />}
        title="We'll be in touch"
        body="We need to take a closer look at your application. We'll reach out to you directly."
        action={
          <a
            href="mailto:membership@start-berlin.com"
            className="text-sm font-medium underline underline-offset-4"
          >
            membership@start-berlin.com
          </a>
        }
        className="bg-secondary/50 border-border"
        iconClassName="text-muted-foreground"
      />
    );
  }

  if (notice === "payment_cancelled") {
    return (
      <NoticePanel
        icon={<LandmarkIcon className="size-5" />}
        title="Update your direct debit"
        body="Your direct debit authorization has expired or been cancelled. Set up a new one to keep your membership running smoothly."
        action={<PaymentButton variant="update" />}
      />
    );
  }

  if (notice === "transition_pending") {
    const TRANSITION_LABELS: Record<
      MembershipTransitionRequest["type"],
      { title: string; body: string }
    > = {
      cancellation: {
        title: "Cancellation in progress",
        body: "Your cancellation request has been submitted and is being processed by the board. You'll receive an email once it's confirmed.",
      },
      alumni_request:
        userStatus === "supporting_alumni"
          ? {
              title: "Alumni transition in progress",
              body: "Your request to become a full Alumni has been submitted. No approval is required — it will auto-confirm 7 days after submission unless the board acknowledges it sooner. You'll receive an email once it's processed.",
            }
          : {
              title: "Alumni transition in progress",
              body: "Your request to become an alumni has been submitted and is awaiting board approval. You'll receive an email once a decision is made.",
            },
      supporting_alumni_request: {
        title: "Supporting alumni transition in progress",
        body: "Your request to become a Supporting Alumni has been submitted and is awaiting board approval. You'll receive an email once a decision is made.",
      },
    };
    const transitionType = pendingTransition?.type ?? "cancellation";
    const label = TRANSITION_LABELS[transitionType];
    return (
      <NoticePanel
        icon={<ClockIcon className="size-5" />}
        title={label.title}
        body={label.body}
        action={
          pendingTransition && (
            <TransitionWithdrawButton request={pendingTransition} />
          )
        }
        className="bg-amber-50 border-amber-200"
        iconClassName="text-amber-600"
      />
    );
  }

  return (
    <NoticePanel
      icon={<LandmarkIcon className="size-5" />}
      title="Set up your direct debit"
      body={
        <>
          Your annual membership fee will be collected automatically via{" "}
          <a
            href="https://payersupport.gocardless.com/hc/articles/5602098685852-Was-ist-GoCardless"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            GoCardless
          </a>
          , our payment provider. We'll notify you before each payment.
        </>
      }
      action={<PaymentButton variant="setup" />}
    />
  );
}
