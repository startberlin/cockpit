import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { LegalMembershipState, UserStatus } from "@/db/schema/auth";
import type { LegalMembershipStatus } from "@/db/schema/legal-membership";
import type { StructuredMembershipState } from "@/lib/membership-status";
import { MembershipProcessingCard } from "./membership-processing-card";
import { MembershipSection } from "./onboarding";
import { PaymentButton } from "./payment-button";

interface MembershipTaskCardProps {
  legalMembershipStatus: LegalMembershipStatus | null;
  legalMembershipState: LegalMembershipState;
  hasPayment: boolean;
  paidThroughAt: Date | null;
  // existing props for backward compat (used by MembershipSection)
  membershipState: StructuredMembershipState;
  userStatus: UserStatus;
}

export function MembershipTaskCard({
  legalMembershipStatus,
  legalMembershipState,
  hasPayment,
  paidThroughAt,
  membershipState,
  userStatus,
}: MembershipTaskCardProps) {
  // admission_pending: board reviewing application
  if (legalMembershipStatus === "admission_pending") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your membership application is in review</CardTitle>
          <CardDescription>
            The board is reviewing your application. You'll hear from us once
            the vote is complete.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // manual_followup: needs closer look
  if (legalMembershipStatus === "manual_followup") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>We need a moment</CardTitle>
          <CardDescription>
            We need to take a closer look at your application. We'll reach out
            to you directly — feel free to get in touch if you have questions.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <a
            href="mailto:hello@startberlin.com"
            className="text-sm font-medium underline underline-offset-4"
          >
            hello@startberlin.com
          </a>
        </CardFooter>
      </Card>
    );
  }

  // application_pending: board approved, fill out application
  if (legalMembershipStatus === "application_pending") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Complete your membership application</CardTitle>
          <CardDescription>
            The board approved your admission. Fill out your membership
            application to continue.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild>
            <Link href="/membership/application/personal-information">
              Fill out application
            </Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // processing: preparing documents — polls for status changes via React Query
  if (legalMembershipStatus === "processing") {
    return <MembershipProcessingCard />;
  }

  // active + payment not yet set up: welcome, set up payment
  if (
    legalMembershipStatus === "active" &&
    (membershipState.payment === "not_started" ||
      membershipState.payment === "pending")
  ) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Welcome to START Berlin</CardTitle>
          <CardDescription>
            Your membership is confirmed. Set up your yearly membership payment
            to complete your onboarding.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-3">
          <PaymentButton />
        </CardFooter>
      </Card>
    );
  }

  // active + has payment: delegate to MembershipSection
  if (legalMembershipStatus === "active" && hasPayment) {
    return (
      <MembershipSection
        membershipState={membershipState}
        userStatus={userStatus}
        paidThroughAt={paidThroughAt}
      />
    );
  }

  // null + active_member: backward-compat path (imported members with documentsVerified)
  // and all other cases: delegate to MembershipSection
  return (
    <MembershipSection
      membershipState={membershipState}
      userStatus={userStatus}
      paidThroughAt={paidThroughAt}
    />
  );
}
