import { PageSection } from "@/components/page-section";
import { listGroupsForViewer, listMemberGroupsForViewer } from "@/db/groups";
import { getCurrentUser } from "@/db/user";
import { createMetadata } from "@/lib/metadata";
import { can } from "@/lib/permissions/server";
import GroupsPageClient from "./page-client";

export const metadata = createMetadata({
  title: "Groups",
  description: "View and manage START Berlin groups.",
});

export default async function GroupsPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return <p>No groups found</p>;
  }

  const canViewAll = await can("groups.view_all");

  const groups = canViewAll
    ? await listGroupsForViewer(currentUser.id)
    : await listMemberGroupsForViewer(currentUser.id);

  return (
    <PageSection>
      <GroupsPageClient groups={groups} />
    </PageSection>
  );
}
