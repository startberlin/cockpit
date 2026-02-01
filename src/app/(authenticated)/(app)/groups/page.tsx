import { getAllGroups, getMyGroups } from "@/db/groups";
import { createMetadata } from "@/lib/metadata";
import { can } from "@/lib/permissions/server";
import GroupsPageClient from "./page-client";

export const metadata = createMetadata({
  title: "Groups",
  description: "View groups you're part of and manage them.",
});

export default async function GroupsPage() {
  const canViewAll = await can("groups.view_all");

  const groupsResult = canViewAll
    ? await getAllGroups()
    : await getMyGroups();

  if (!groupsResult.data) {
    return <p>No groups found</p>;
  }

  return <GroupsPageClient groups={groupsResult.data} />;
}
