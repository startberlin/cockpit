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
import { AuthorityCard } from "./authority-card";
import { ContactCard } from "./contact-card";
import { GroupsCard } from "./groups-card";
import { ImpersonateButton } from "./impersonate-button";
import { ProfileCard } from "./profile-card";
import { ProposeMembershipButton } from "./propose-membership-button";

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

  const canViewDetails = await can("user.view", user);

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

  const canManageAuthority = await can("users.manage_authority");
  const canImpersonate = await can("users.impersonate");

  const isEligibleForMembershipProposal =
    user.profileOnboardingComplete &&
    !(LIVE_TENURE_STATUSES as readonly string[]).includes(
      user.legalMembershipState,
    );

  const canProposeMembership =
    isEligibleForMembershipProposal &&
    (await can("user.membership.propose", user));

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

      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2 self-start">
          <Link href="/admin/people/directory">
            <ArrowLeft />
            Back to directory
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {user.firstName} {user.lastName}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            {canImpersonate && (
              <ImpersonateButton userId={user.id} userEmail={user.email} />
            )}
            {canProposeMembership && (
              <ProposeMembershipButton
                userId={user.id}
                firstName={user.firstName}
                lastName={user.lastName}
              />
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Suspense fallback={<Skeleton className="h-48 rounded-xl" />}>
          <ProfileCard userId={id} />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-48 rounded-xl" />}>
          <ContactCard userId={id} />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-48 rounded-xl" />}>
          <GroupsCard userId={id} />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-48 rounded-xl" />}>
          <AuthorityCard userId={id} canManageAuthority={canManageAuthority} />
        </Suspense>
      </div>
    </div>
  );
}
