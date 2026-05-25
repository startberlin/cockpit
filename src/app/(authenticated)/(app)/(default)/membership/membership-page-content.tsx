import { Suspense } from "react";
import type { MembershipTransitionRequest } from "@/db/membership-transitions";
import type { User } from "@/db/schema/auth";
import type { LegalMembershipStatus } from "@/db/schema/legal-membership";
import { getStructuredMembershipState } from "@/lib/membership-status";
import { ContactDetailsCard } from "./contact-details-card";
import { MembershipDetailsCard } from "./membership-details-card";
import { MembershipDetailsSkeleton } from "./membership-details-skeleton";
import { MembershipHeroCard } from "./membership-hero-card";
import { MembershipNoticeBlock } from "./membership-notice-block";
import { deriveMembershipNotice } from "./membership-notice-state";
import { MembershipOptions } from "./membership-options";

interface MembershipPageContentProps {
  user: User;
  activeLegalMembership: { id: string; status: LegalMembershipStatus } | null;
  pendingTransition: MembershipTransitionRequest | null;
}

export function MembershipPageContent({
  user,
  activeLegalMembership,
  pendingTransition,
}: MembershipPageContentProps) {
  const membershipState = getStructuredMembershipState(user);
  const legalMembershipStatus = activeLegalMembership?.status ?? null;
  const noticeType = deriveMembershipNotice(
    membershipState,
    legalMembershipStatus,
    user.status,
    pendingTransition,
  );

  const showMembershipDetails = user.status !== "onboarding";
  const showMembershipOptions =
    !pendingTransition &&
    (user.status === "member" || user.status === "supporting_alumni");

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <MembershipHeroCard
          membershipState={membershipState}
          legalMembershipStatus={legalMembershipStatus}
          userStatus={user.status}
          firstName={user.firstName}
          noticeType={noticeType}
        />
        <MembershipNoticeBlock
          membershipState={membershipState}
          legalMembershipStatus={legalMembershipStatus}
          userStatus={user.status}
          pendingTransition={pendingTransition}
        />
      </div>
      {showMembershipDetails && (
        <Suspense fallback={<MembershipDetailsSkeleton />}>
          <MembershipDetailsCard user={user} />
        </Suspense>
      )}
      <ContactDetailsCard user={user} />
      {showMembershipOptions && (
        <MembershipOptions
          hasActiveLegalMembership={activeLegalMembership !== null}
        />
      )}
    </div>
  );
}
