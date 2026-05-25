import { eq } from "drizzle-orm";
import db from "@/db";
import { listAllGroupsForAdmin } from "@/db/groups";
import { usersToGroups } from "@/db/schema/group";
import { getCurrentUser } from "@/db/user";
import {
  getAllSystemGroups,
  getMembersOfSystemGroup,
} from "@/lib/groups/system-groups";
import { createMetadata } from "@/lib/metadata";
import { can } from "@/lib/permissions/server";
import AdminGroupsPageClient from "./page-client";

export const metadata = createMetadata({
  title: "Groups",
  description: "Manage START Berlin groups.",
});

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function AdminGroupsPage({ searchParams }: PageProps) {
  const { q: search = "" } = await searchParams;

  const currentUser = await getCurrentUser();

  const [userRows, positions, batches, manualGroupsResult, canExportAll, viewerManagerRows] =
    await Promise.all([
      db.query.user.findMany({
        columns: {
          id: true,
          status: true,
          department: true,
          batchNumber: true,
        },
        with: { accessGrants: { columns: { grant: true } } },
      }),
      db.query.userOrganizationPosition.findMany({
        columns: {
          userId: true,
          position: true,
          scope: true,
          department: true,
        },
      }),
      db.query.batch.findMany({ columns: { number: true } }),
      listAllGroupsForAdmin({ search }),
      can("group.export", { isMember: false }),
      currentUser
        ? db
            .select({ groupId: usersToGroups.groupId })
            .from(usersToGroups)
            .where(eq(usersToGroups.userId, currentUser.id))
        : Promise.resolve([] as { groupId: string }[]),
    ]);

  const users = userRows.map((u) => ({
    id: u.id,
    status: u.status,
    department: u.department,
    batchNumber: u.batchNumber,
    grants: u.accessGrants.map((g) => g.grant),
  }));

  const systemGroups = getAllSystemGroups(batches).map((sg) => ({
    ...sg,
    memberCount: getMembersOfSystemGroup(sg.slug, users, positions).length,
  }));

  const viewerManagerGroupIds = viewerManagerRows.map((r) => r.groupId);

  return (
    <AdminGroupsPageClient
      systemGroups={systemGroups}
      manualGroups={manualGroupsResult.groups}
      total={manualGroupsResult.total}
      initialSearch={search}
      canExportAll={canExportAll}
      viewerManagerGroupIds={viewerManagerGroupIds}
    />
  );
}
