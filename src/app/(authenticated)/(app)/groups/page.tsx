import { listGroupsForViewer } from "@/db/groups";
import { getCurrentUser } from "@/db/user";
import { createMetadata } from "@/lib/metadata";
import GroupsPageClient from "./page-client";

export const metadata = createMetadata({
  title: "Groups",
  description: "View and manage START Berlin groups.",
});

interface GroupsPageProps {
  searchParams: Promise<{ page?: string; q?: string }>;
}

export default async function GroupsPage({ searchParams }: GroupsPageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return <p>No groups found</p>;
  }

  const { page: pageParam, q: search = "" } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const { groups, total, pageCount } = await listGroupsForViewer(
    currentUser.id,
    {
      page,
      search,
    },
  );

  return (
    <GroupsPageClient
      groups={groups}
      total={total}
      pageCount={pageCount}
      initialSearch={search}
    />
  );
}
