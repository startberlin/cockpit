import { redirect } from "next/navigation";
import {
  getEligibleUsersForPositions,
  getPositionAssignments,
} from "@/db/authority";
import { createMetadata } from "@/lib/metadata";
import { can } from "@/lib/permissions/server";
import AdminSettingsPageClient from "./page-client";

export const metadata = createMetadata({
  title: "Settings",
  description: "Manage START Berlin positions and org settings.",
});

export default async function AdminSettingsPage() {
  if (!(await can("users.manage_authority"))) {
    redirect("/membership");
  }

  const [positions, eligibleUsers] = await Promise.all([
    getPositionAssignments(),
    getEligibleUsersForPositions(),
  ]);

  return (
    <AdminSettingsPageClient
      positions={positions}
      eligibleUsers={eligibleUsers}
    />
  );
}
