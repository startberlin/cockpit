"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import type { UserStatus } from "@/db/schema/auth";
import type { LegalMembershipStatus } from "@/db/schema/legal-membership";
import type { StructuredMembershipState } from "@/lib/membership-status";
import { getLegalMembershipStatus } from "./get-legal-membership-status-action";
import {
  deriveMembershipHeroVariant,
  type MembershipHeroVariant,
} from "./membership-hero-state";
import type { MembershipNoticeType } from "./membership-notice-state";

interface MembershipHeroCardProps {
  membershipState: StructuredMembershipState;
  legalMembershipStatus: LegalMembershipStatus | null;
  userStatus: UserStatus;
  firstName: string;
  noticeType: MembershipNoticeType;
}

function getHeroContent(
  variant: MembershipHeroVariant,
  firstName: string,
): { headline: string; body: string | null } {
  switch (variant) {
    case "alumni":
      return { headline: `Hi ${firstName}`, body: null };
    case "active_mandate_member":
      return {
        headline: `Hi ${firstName}`,
        body: "Thank you for being part of START Berlin.",
      };
    case "active_mandate_alumni":
      return {
        headline: `Hi ${firstName}`,
        body: "Thank you for continuing to support START Berlin.",
      };
    case "active_cancelled":
      return {
        headline: `Hi ${firstName}`,
        body: "It's good to have you at START Berlin! We noticed there was a problem with your direct debit. Please update your direct debit authorization.",
      };
    case "active_no_payment":
      return {
        headline: `Hi ${firstName}`,
        body: "We're glad to have you at START Berlin! Please set up a direct debit for your membership payment.",
      };
    case "processing":
      return {
        headline: "Your membership documents are being prepared",
        body: "This usually only takes a moment. The page will update automatically.",
      };
    case "manual_followup":
      return {
        headline: "We need a moment",
        body: "We need to take a closer look. We'll reach out to you directly.",
      };
    case "application_pending":
      return {
        headline: "Join START Berlin e.V.",
        body: "The START Berlin board has invited you to submit your membership application and become an official member.",
      };
    case "membership_reconfirmation_pending":
      return {
        headline: "Confirm your START Berlin membership",
        body: "We have you on record as a member. Please confirm your membership to keep our records up to date. This is a one-time step and only takes a few minutes.",
      };
    case "cancelled":
      return {
        headline: "Your membership has ended",
        body: "Your START Berlin membership is no longer active. Get in touch if you have any questions.",
      };
    case "onboarding":
      return {
        headline: "Welcome to START Berlin",
        body: "Once your onboarding is complete, you can submit your membership application here. We'll notify you by email when it's time.",
      };
  }
}

function getBadgeLabel(noticeType: MembershipNoticeType): string | null {
  switch (noticeType) {
    case "application_pending":
      return "Application pending";
    case "membership_reconfirmation_pending":
      return "Confirmation needed";
    case "payment_not_started":
      return "Direct debit needed";
    case "payment_cancelled":
      return "Direct debit expired";
    default:
      return "Membership active";
  }
}

export function MembershipHeroCard({
  membershipState,
  legalMembershipStatus,
  userStatus,
  firstName,
  noticeType,
}: MembershipHeroCardProps) {
  const router = useRouter();
  const pollingStartedAt = React.useRef(Date.now());

  useQuery({
    queryKey: ["legal-membership-status"],
    queryFn: async () => {
      const status = await getLegalMembershipStatus();
      if (status && status !== "processing") {
        router.refresh();
      }
      return status;
    },
    refetchInterval: (query) => {
      const current = query.state.data;
      if (current && current !== "processing") return false;
      if (Date.now() - pollingStartedAt.current >= 60_000) return false;
      return 3_000;
    },
    enabled: legalMembershipStatus === "processing",
  });

  const variant = deriveMembershipHeroVariant(
    membershipState,
    legalMembershipStatus,
    userStatus,
  );

  const { headline, body } = getHeroContent(variant, firstName);
  const badgeLabel = getBadgeLabel(noticeType);

  return (
    <Card className="gap-0">
      <CardHeader className="gap-0">
        {variant === "processing" ? (
          <span className="mb-5 inline-flex w-fit items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
            <Loader2Icon className="size-3 animate-spin" />
            Processing
          </span>
        ) : badgeLabel ? (
          <span className="mb-5 inline-flex w-fit items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-muted-foreground/50" />
            {badgeLabel}
          </span>
        ) : null}
        <h2 className="text-3xl font-black uppercase tracking-tight leading-none">
          {headline}
        </h2>
        {body && (
          <CardDescription className="mt-3 text-sm leading-relaxed">
            {body}
          </CardDescription>
        )}
      </CardHeader>
    </Card>
  );
}
