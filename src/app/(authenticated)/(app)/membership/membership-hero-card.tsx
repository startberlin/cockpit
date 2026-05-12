"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { UserStatus } from "@/db/schema/auth";
import type { LegalMembershipStatus } from "@/db/schema/legal-membership";
import type { StructuredMembershipState } from "@/lib/membership-status";
import { getLegalMembershipStatus } from "./get-legal-membership-status-action";
import {
  deriveMembershipHeroVariant,
  type MembershipHeroVariant,
} from "./membership-hero-state";

interface MembershipHeroCardProps {
  membershipState: StructuredMembershipState;
  legalMembershipStatus: LegalMembershipStatus | null;
  userStatus: UserStatus;
  firstName: string;
  hasNotice: boolean;
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
        body: "Your membership is active but there is a problem with your payment.",
      };
    case "active_no_payment":
      return {
        headline: `Hi ${firstName}`,
        body: "Your membership is active. We still need your payment details.",
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
        headline:
          "Fill out your membership application and join START Berlin e.V.",
        body: "The START Berlin board has invited you to submit your membership application and become an official member.",
      };
    case "membership_reconfirmation_pending":
      return {
        headline: "Confirm your START Berlin membership",
        body: "We have you on record as a member, but we still need your official confirmation and a few details. This only takes a few minutes.",
      };
    case "cancelled":
      return {
        headline: "Your membership has ended",
        body: "Your START Berlin membership is no longer active. Get in touch if you have any questions.",
      };
    case "onboarding":
      return {
        headline: "Welcome to START Berlin",
        body: "Your membership details will appear here once your onboarding is complete.",
      };
  }
}

export function MembershipHeroCard({
  membershipState,
  legalMembershipStatus,
  userStatus,
  firstName,
  hasNotice,
}: MembershipHeroCardProps) {
  const router = useRouter();

  const { data: polledStatus } = useQuery({
    queryKey: ["legal-membership-status"],
    queryFn: getLegalMembershipStatus,
    refetchInterval: (query) => {
      const current = query.state.data;
      return !current || current === "processing" ? 2000 : false;
    },
    enabled: legalMembershipStatus === "processing",
  });

  useEffect(() => {
    if (
      polledStatus &&
      polledStatus !== "processing" &&
      polledStatus !== "active"
    ) {
      router.refresh();
    }
  }, [polledStatus, router]);

  const variant = deriveMembershipHeroVariant(
    membershipState,
    legalMembershipStatus,
    userStatus,
  );

  const { headline, body } = getHeroContent(variant, firstName);

  return (
    <Card>
      <CardHeader>
        {hasNotice && (
          <Badge className="w-fit" variant="secondary">
            Action required
          </Badge>
        )}
        <CardTitle className="flex items-center gap-2">
          {variant === "processing" && (
            <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
          )}
          {headline}
        </CardTitle>
        {body && <CardDescription>{body}</CardDescription>}
      </CardHeader>
    </Card>
  );
}
