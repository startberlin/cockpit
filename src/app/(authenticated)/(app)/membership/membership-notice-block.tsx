import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { UserStatus } from "@/db/schema/auth";
import type { LegalMembershipStatus } from "@/db/schema/legal-membership";
import type { StructuredMembershipState } from "@/lib/membership-status";
import {
  deriveMembershipNotice,
  type MembershipNoticeType,
} from "./membership-notice-state";
import { PaymentButton } from "./payment-button";

export { deriveMembershipNotice, type MembershipNoticeType };

interface MembershipNoticeBlockProps {
  membershipState: StructuredMembershipState;
  legalMembershipStatus: LegalMembershipStatus | null;
  userStatus: UserStatus;
}

export function MembershipNoticeBlock({
  membershipState,
  legalMembershipStatus,
  userStatus,
}: MembershipNoticeBlockProps) {
  const notice = deriveMembershipNotice(
    membershipState,
    legalMembershipStatus,
    userStatus,
  );

  if (!notice) return null;

  if (notice === "alumni") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>You're listed as alumni</CardTitle>
          <CardDescription>
            You are no longer a member of START Berlin e.V. If you would like to
            rejoin, get in touch with us — we'd love to have you back.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (notice === "application_pending") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fill out your membership application</CardTitle>
          <CardDescription>
            A few details are needed to generate your membership documents. This
            only takes a few minutes.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild>
            <Link href="/membership/application/personal-information">
              Start application
            </Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (notice === "membership_reconfirmation_pending") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Confirm your membership</CardTitle>
          <CardDescription>
            We need a few details to confirm your membership. This only takes a
            few minutes.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild>
            <Link href="/membership/application/personal-information">
              Confirm membership
            </Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (notice === "manual_followup") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>We'll be in touch</CardTitle>
          <CardDescription>
            We need to take a closer look at your application. We'll reach out
            to you directly.
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

  if (notice === "payment_cancelled") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>There is a problem with your payment</CardTitle>
          <CardDescription>
            Your membership is active but your payment details are no longer
            valid. Please update your payment details to continue.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <PaymentButton />
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set up your yearly membership payment</CardTitle>
        <CardDescription>
          START Berlin membership costs 40 EUR per year. It covers the
          essentials that keep the association running and helps fund events and
          member benefits throughout the year.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <PaymentButton />
      </CardFooter>
    </Card>
  );
}
