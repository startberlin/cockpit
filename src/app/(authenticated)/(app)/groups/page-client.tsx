"use client";

import { useRouter } from "next/navigation";
import { parseAsBoolean, useQueryState } from "nuqs";
import * as React from "react";
import { toast } from "sonner";
import { GroupsTable } from "@/components/groups-table";
import type { PublicGroup } from "@/db/groups";
import { CreateGroupDialog } from "./create-group-dialog";

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
  const router = useRouter();
  const [, setCreate] = useQueryState(
    "create",
    parseAsBoolean.withDefault(false),
  );

  const handleSuccess = React.useCallback(() => {
    router.refresh();

    toast.success("Group created", {
      description: "The group has been created successfully.",
    });
  }, [router]);

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
        onCreateGroupClick={() => setCreate(true)}
      />
      <CreateGroupDialog onSuccess={handleSuccess} />
    </>
  );
}
