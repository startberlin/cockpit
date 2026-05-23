import { ArrowLeft, ShieldX } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BreadcrumbCrumb } from "@/components/breadcrumb-bridge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { getUserDetails } from "@/db/people";
import { LIVE_TENURE_STATUSES } from "@/db/schema/legal-membership";
import { createMetadata } from "@/lib/metadata";
import { can } from "@/lib/permissions/server";
import { AdminActionCards } from "./admin-action-cards";
import { ContactCard } from "./contact-card";
import { GroupsCard } from "./groups-card";
import { MemberHeader } from "./member-header";
import { OnboardingSection } from "./onboarding-section";
import { PaymentSection } from "./payment-section";
import { ProfileSection } from "./profile-section";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const user = await getUserDetails(id);

  if (!user) {
    return createMetadata({
      title: "Member not found",
      description: "The requested member could not be found.",
    });
  }

  return createMetadata({
    title: `${user.firstName} ${user.lastName}`,
    description: `Member profile for ${user.firstName} ${user.lastName}`,
  });
}

export default async function UserDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getUserDetails(id);

  if (!user) {
    notFound();
  }

  const [
    canViewDetails,
    canViewPayment,
    canImpersonate,
    canManageAuthority,
    canRemoveMemberBase,
  ] = await Promise.all([
    can("user.view_details", { department: user.department }),
    can("user.payment.view", { department: user.department }),
    can("users.impersonate"),
    can("users.manage_authority"),
    can("membership.cancel_member"),
  ]);

  if (!canViewDetails) {
    return (
      <Empty className="min-h-[50vh]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldX />
          </EmptyMedia>
          <EmptyTitle>Member details unavailable</EmptyTitle>
          <EmptyDescription>
            You can only view member details for members you are allowed to
            manage.
          </EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" asChild>
          <Link href="/admin/people/directory">Back to people</Link>
        </Button>
      </Empty>
    );
  }

  const isEligibleForMembershipProposal =
    user.profileOnboardingComplete &&
    !(LIVE_TENURE_STATUSES as readonly string[]).includes(
      user.legalMembershipState,
    );

  const canProposeMembership =
    isEligibleForMembershipProposal &&
    (await can("user.membership.propose", { department: user.department }));

  const canRemoveMember = user.status !== "cancelled" && canRemoveMemberBase;

  return (
    <div className="w-full space-y-6">
      <BreadcrumbCrumb
        crumbs={[
          { label: "Admin", href: "/admin/people/directory" },
          { label: "People", href: "/admin/people/directory" },
          { label: "Directory", href: "/admin/people/directory" },
          { label: `${user.firstName} ${user.lastName}` },
        ]}
      />

      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/admin/people/directory">
          <ArrowLeft />
          Back to directory
        </Link>
      </Button>

      <Suspense
        fallback={
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        }
      >
        <MemberHeader userId={id} />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
        <ProfileSection userId={id} />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
        <ContactCard userId={id} />
      </Suspense>

      {canViewPayment && (
        <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
          <PaymentSection userId={id} />
        </Suspense>
      )}

      <Suspense fallback={<Skeleton className="h-24 w-full rounded-xl" />}>
        <OnboardingSection userId={id} />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-32 w-full rounded-xl" />}>
        <GroupsCard userId={id} />
      </Suspense>

      <AdminActionCards
        userId={id}
        userEmail={user.email ?? ""}
        firstName={user.firstName}
        lastName={user.lastName}
        canImpersonate={canImpersonate}
        canProposeMembership={canProposeMembership}
        canRemoveMember={canRemoveMember}
        canManageAuthority={canManageAuthority}
      />
    </div>
  );
}
