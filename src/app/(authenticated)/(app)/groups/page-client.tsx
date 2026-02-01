"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { GroupsTable } from "@/components/groups-table";
import type { PublicGroup } from "@/db/groups";
import { CreateGroupDialog } from "./create-group-dialog";

interface GroupsPageClientProps {
  groups: PublicGroup[];
}

export default function GroupsPageClient({ groups }: GroupsPageClientProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const handleSuccess = React.useCallback(() => {
    router.refresh();

    toast.success("Group created", {
      description: "The group has been created successfully.",
    });
  }, [router]);

  return (
    <>
      <GroupsTable data={groups} onCreateGroupClick={() => setOpen(true)} />
      <CreateGroupDialog
        open={open}
        onOpenChange={setOpen}
        onSuccess={handleSuccess}
      />
    </>
  );
}
