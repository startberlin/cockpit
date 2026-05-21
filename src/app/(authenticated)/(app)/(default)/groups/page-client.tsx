"use client";

import { GroupsTable } from "@/components/groups-table";
import type { PublicGroup } from "@/db/groups";

interface GroupsPageClientProps {
  groups: PublicGroup[];
  total: number;
  pageCount: number;
  initialSearch: string;
}

export default function GroupsPageClient({
  groups,
  total,
  pageCount,
  initialSearch,
}: GroupsPageClientProps) {
  return (
    <>
      <div className="flex items-center justify-between pb-4">
        <h1 className="text-xl font-semibold">Groups</h1>
      </div>
      <GroupsTable
        data={groups}
        total={total}
        pageCount={pageCount}
        initialSearch={initialSearch}
      />
    </>
  );
}
