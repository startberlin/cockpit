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
      <div className="pb-4">
        <h1 className="text-xl font-semibold">Groups</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Teams, batches, and project groups at START Berlin.
        </p>
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
