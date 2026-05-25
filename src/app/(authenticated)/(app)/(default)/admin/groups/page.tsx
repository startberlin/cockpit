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

  const [users, positions, batches, manualGroupsResult] = await Promise.all([
    db.query.user.findMany({
      columns: {
        id: true,
        status: true,
        department: true,
        batchNumber: true,
      },
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
