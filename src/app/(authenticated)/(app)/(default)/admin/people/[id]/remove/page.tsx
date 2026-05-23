import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BreadcrumbCrumb } from "@/components/breadcrumb-bridge";
import { Button } from "@/components/ui/button";
import { getUserDetails } from "@/db/people";
import { createMetadata } from "@/lib/metadata";
import { can } from "@/lib/permissions/server";
import { RemovePageClient } from "./page-client";

export const metadata = createMetadata({
  title: "Remove member",
  description: "Remove a member from START Berlin.",
});

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RemoveMemberPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getUserDetails(id);

  if (!user) {
    redirect(`/admin/people`);
  }

  if (user.status === "cancelled") {
    redirect(`/admin/people/${id}`);
  }

  const canRemove = await can("membership.cancel_member");

  if (!canRemove) {
    redirect(`/admin/people/${id}`);
  }

  return (
    <div className="w-full max-w-2xl space-y-6">
      <BreadcrumbCrumb
        crumbs={[
          { label: "Admin", href: "/admin/people" },
          { label: "Members", href: "/admin/people" },
          {
            label: `${user.firstName} ${user.lastName}`,
            href: `/admin/people/${id}`,
          },
          { label: "Remove member" },
        ]}
      />

      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href={`/admin/people/${id}`}>
          <ArrowLeft />
          Back to profile
        </Link>
      </Button>

      <div>
        <h1 className="text-xl font-semibold">
          Remove {user.firstName} {user.lastName}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          This action cannot be undone. The board will be notified.
        </p>
      </div>

      <RemovePageClient
        userId={id}
        firstName={user.firstName}
        lastName={user.lastName}
        userEmail={user.email ?? ""}
        backHref={`/admin/people/${id}`}
      />
    </div>
  );
}
