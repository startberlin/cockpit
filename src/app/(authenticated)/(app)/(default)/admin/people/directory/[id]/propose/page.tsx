import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BreadcrumbCrumb } from "@/components/breadcrumb-bridge";
import { Button } from "@/components/ui/button";
import { getUserDetails } from "@/db/people";
import { LIVE_TENURE_STATUSES } from "@/db/schema/legal-membership";
import { createMetadata } from "@/lib/metadata";
import { can } from "@/lib/permissions/server";
import { ProposeMembershipForm } from "./propose-form";

export const metadata = createMetadata({
  title: "Propose for membership",
  description: "Propose a member for legal membership.",
});

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProposeMembershipPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getUserDetails(id);

  if (!user) {
    redirect(`/admin/people/directory`);
  }

  const canPropose = await can("user.membership.propose", {
    department: user.department,
  });

  const isEligible =
    user.profileOnboardingComplete &&
    !(LIVE_TENURE_STATUSES as readonly string[]).includes(
      user.legalMembershipState,
    );

  if (!canPropose || !isEligible) {
    redirect(`/admin/people/directory/${id}`);
  }

  return (
    <div className="w-full max-w-2xl space-y-6">
      <BreadcrumbCrumb
        crumbs={[
          { label: "Admin", href: "/admin/people/directory" },
          { label: "Directory", href: "/admin/people/directory" },
          {
            label: `${user.firstName} ${user.lastName}`,
            href: `/admin/people/directory/${id}`,
          },
          { label: "Propose for membership" },
        ]}
      />

      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href={`/admin/people/directory/${id}`}>
          <ArrowLeft />
          Back to profile
        </Link>
      </Button>

      <div>
        <h1 className="text-xl font-semibold">
          Propose {user.firstName} {user.lastName} for membership
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Start the board admission workflow for this member.
        </p>
      </div>

      <div className="rounded-lg border p-4 space-y-3 text-sm">
        <p className="font-medium">What proposing for membership means</p>
        <ul className="space-y-2 text-muted-foreground list-disc list-inside">
          <li>
            A board resolution will be created asking the president, vice
            president, and head of finance to vote on this person&apos;s
            admission.
          </li>
          <li>
            The member will receive emails guiding them through the application
            process once the board approves.
          </li>
          <li>
            This starts the official START Berlin e.V. membership process and
            cannot be reversed without a separate board decision.
          </li>
        </ul>
      </div>

      <ProposeMembershipForm
        userId={id}
        backHref={`/admin/people/directory/${id}`}
      />
    </div>
  );
}
