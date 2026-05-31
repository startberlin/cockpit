import { ShieldX } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BreadcrumbCrumb } from "@/components/breadcrumb-bridge";
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
import { BackButton } from "./back-button";
import { ContactCard } from "./contact-card";
import { GroupsCard } from "./groups-card";
import { MemberHeader } from "./member-header";
import { MemberSummaryStrip } from "./member-summary-strip";
import { MembershipCard } from "./membership-card";
import { PaymentSection } from "./payment-section";
import { PermissionsSection } from "./permissions-section";

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
    canChangeDepartment,
    canChangePersonalEmail,
    canResetPassword,
  ] = await Promise.all([
    can("user.view_details", { department: user.department }),
    can("user.payment.view", { department: user.department }),
    can("users.impersonate"),
    can("users.manage_authority"),
    can("membership.cancel_member"),
    can("user.department.change", { department: user.department }),
    can("user.personal_email.change"),
    can("user.password.reset"),
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
        <BackButton variant="outline">Back to people</BackButton>
      </Empty>
    );
  }

  const isEligibleForMembershipProposal =
    user.status === "onboarding" &&
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
          { label: "Admin", href: "/admin/people" },
          { label: "People", href: "/admin/people" },
          { label: `${user.firstName} ${user.lastName}` },
        ]}
      />

      <BackButton>Back to members</BackButton>

      <Suspense
        fallback={
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-4">
            <Skeleton className="h-16 w-16 rounded-full sm:h-14 sm:w-14" />
            <div className="flex flex-col items-center gap-2 sm:items-start">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-5 w-64" />
            </div>
          </div>
        }
      >
        <MemberHeader userId={id} canImpersonate={canImpersonate} />
      </Suspense>

      <Suspense
        fallback={
          <div className="grid grid-cols-2 overflow-hidden rounded-lg border sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="px-4 py-3">
                <Skeleton className="mb-1.5 h-3 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        }
      >
        <MemberSummaryStrip userId={id} />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <MembershipCard
          userId={id}
          canPropose={canProposeMembership}
          canRemove={canRemoveMember}
          canChangeDepartment={canChangeDepartment}
          canChangePersonalEmail={canChangePersonalEmail}
          canResetPassword={canResetPassword}
          currentDepartment={user.department}
          personalEmail={user.personalEmail}
        />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
        <ContactCard userId={id} />
      </Suspense>

      {canViewPayment && (
        <Suspense
          fallback={
            <div className="space-y-3">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-28 w-full rounded-md" />
            </div>
          }
        >
          <PaymentSection userId={id} />
        </Suspense>
      )}

      <Suspense
        fallback={
          <div className="space-y-3">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-24 w-full rounded-md" />
          </div>
        }
      >
        <GroupsCard userId={id} />
      </Suspense>

      {canManageAuthority && (
        <Suspense
          fallback={
            <div className="space-y-3">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-24 w-full rounded-md" />
            </div>
          }
        >
          <PermissionsSection userId={id} />
        </Suspense>
      )}
    </div>
  );
}
