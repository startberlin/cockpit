import db from "@/db";
import { listAllGroupsForAdmin } from "@/db/groups";
import {
  getAllSystemGroups,
  getMembersOfSystemGroup,
} from "@/lib/groups/system-groups";
import { createMetadata } from "@/lib/metadata";
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

  const [userRows, positions, batches, manualGroupsResult] = await Promise.all([
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

  return (
    <AdminGroupsPageClient
      systemGroups={systemGroups}
      manualGroups={manualGroupsResult.groups}
      total={manualGroupsResult.total}
      initialSearch={search}
    />
  );
}
