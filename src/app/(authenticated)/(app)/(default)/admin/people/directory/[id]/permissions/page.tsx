import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthorityEditor } from "@/components/authority-editor";
import { BreadcrumbCrumb } from "@/components/breadcrumb-bridge";
import { Button } from "@/components/ui/button";
import { getUserAuthorityData, getUserDetails } from "@/db/people";
import { createMetadata } from "@/lib/metadata";
import { can } from "@/lib/permissions/server";

export const metadata = createMetadata({
  title: "Manage permissions",
  description: "Manage a member's app permission grants.",
});

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PermissionsPage({ params }: PageProps) {
  const { id } = await params;

  const [canManage, canImpersonate] = await Promise.all([
    can("users.manage_authority"),
    can("users.impersonate"),
  ]);

  if (!canManage) {
    redirect(`/admin/people/directory/${id}`);
  }

  const [user, authorityData] = await Promise.all([
    getUserDetails(id),
    getUserAuthorityData(id),
  ]);

  if (!user || !authorityData) {
    redirect(`/admin/people/directory`);
  }

  return (
    <div className="w-full max-w-2xl space-y-6">
      <BreadcrumbCrumb
        crumbs={[
          { label: "Admin", href: "/admin/people/directory" },
          { label: "Members", href: "/admin/people/directory" },
          {
            label: `${user.firstName} ${user.lastName}`,
            href: `/admin/people/directory/${id}`,
          },
          { label: "Permissions" },
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
          Permissions — {user.firstName} {user.lastName}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage app permission grants for this member.
        </p>
      </div>

      <AuthorityEditor
        userId={id}
        grants={authorityData.accessGrants}
        canSetSuperAdmin={canImpersonate}
      />
    </div>
  );
}
