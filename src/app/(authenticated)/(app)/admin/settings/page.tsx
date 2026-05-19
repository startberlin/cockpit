import { redirect } from "next/navigation";
import { getUsersWithAnyAuthority } from "@/db/authority";
import { createMetadata } from "@/lib/metadata";
import { can } from "@/lib/permissions/server";
import AdminSettingsPageClient from "./page-client";

export const metadata = createMetadata({
  title: "Settings",
  description: "Manage START Cockpit settings and member permissions.",
});

export default async function AdminSettingsPage() {
  if (!(await can("users.manage_authority"))) {
    redirect("/membership");
  }

  const [users, canSetSuperAdmin] = await Promise.all([
    getUsersWithAnyAuthority(),
    can("users.impersonate"),
  ]);

  return (
    <AdminSettingsPageClient
      users={users}
      canSetSuperAdmin={canSetSuperAdmin}
    />
  );
}
