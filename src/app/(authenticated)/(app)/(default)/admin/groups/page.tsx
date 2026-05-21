import { redirect } from "next/navigation";
import { listAllGroupsForAdmin } from "@/db/groups";
import { createMetadata } from "@/lib/metadata";
import { can } from "@/lib/permissions/server";
import AdminGroupsPageClient from "./page-client";

export const metadata = createMetadata({
  title: "Groups",
  description: "Manage START Berlin groups.",
});

interface PageProps {
  searchParams: Promise<{ page?: string; q?: string }>;
}

export default async function AdminGroupsPage({ searchParams }: PageProps) {
  if (!(await can("groups.view_all"))) {
    redirect("/membership");
  }

  const { page: pageParam, q: search = "" } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const { groups, total, pageCount } = await listAllGroupsForAdmin({
    page,
    search,
  });

  return (
    <AdminGroupsPageClient
      groups={groups}
      total={total}
      pageCount={pageCount}
      initialSearch={search}
    />
  );
}
