import { redirect } from "next/navigation";
import {
  getEligibleUsersForPositions,
  getPositionAssignments,
} from "@/db/authority";
import { createMetadata } from "@/lib/metadata";
import { can } from "@/lib/permissions/server";
import AdminSettingsPageClient from "./page-client";

export const metadata = createMetadata({
  title: "Positions",
  description: "Manage START Berlin org positions.",
});

export default async function AdminSettingsPositionsPage() {
  if (!(await can("settings.positions.manage"))) {
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
