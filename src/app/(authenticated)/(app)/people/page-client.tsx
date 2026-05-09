"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { PeopleTable } from "@/components/people-table";
import type { PublicUser } from "@/db/people";
import type { PendingBoardAction } from "@/db/people-actions";
import { CreateUserDialog } from "./create-user-dialog";
import { ImportGoogleUserDialog } from "./import-google-user-dialog";

interface PeoplePageClientProps {
  users: PublicUser[];
  batches: { number: number }[];
  pendingActions: PendingBoardAction[];
}

export default function PeoplePageClient({
  users,
  batches,
  pendingActions,
}: PeoplePageClientProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);

  const handleSuccess = React.useCallback(() => {
    router.refresh();

    toast.success("Adding member...", {
      description:
        "It may take a few minutes for the member to appear in the list.",
    });
  }, [router]);

  return (
    <>
      <PeopleTable
        data={users}
        pendingActions={pendingActions}
        onCreateUserClick={() => setCreateOpen(true)}
        onImportUserClick={() => setImportOpen(true)}
      />

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        batches={batches}
        onSuccess={handleSuccess}
      />
      <ImportGoogleUserDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        batches={batches}
        onSuccess={() => {
          router.refresh();
          toast.success("Member imported from Google Workspace");
        }}
      />
    </>
  );
}
