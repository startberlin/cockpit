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
  searchParams: Promise<{ page?: string; q?: string }>;
}

export default async function AdminGroupsPage({ searchParams }: PageProps) {
  const { page: pageParam, q: search = "" } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

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
    listAllGroupsForAdmin({ page, search }),
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
      pageCount={manualGroupsResult.pageCount}
      initialSearch={search}
    />
  );
}
