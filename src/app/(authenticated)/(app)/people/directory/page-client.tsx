"use client";

import { Download, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Can } from "@/components/can";
import { PeopleTable } from "@/components/people-table";
import { Button } from "@/components/ui/button";
import type { PublicUser } from "@/db/people";
import type { PendingBoardAction } from "@/db/people-actions";
import { CreateUserDialog } from "../create-user-dialog";
import { ImportGoogleUserDialog } from "../import-google-user-dialog";

interface DirectoryPageClientProps {
  users: PublicUser[];
  batches: { number: number }[];
  pendingActions: PendingBoardAction[];
}

export default function DirectoryPageClient({
  users,
  batches,
  pendingActions,
}: DirectoryPageClientProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);

  const handleSuccess = React.useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <>
      <div className="flex items-center justify-between pb-4">
        <h1 className="text-xl font-semibold">Directory</h1>
        <div className="flex gap-2">
          <Can permission="users.create">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Add member
            </Button>
          </Can>
          <Can permission="users.import">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setImportOpen(true)}
            >
              <Download className="h-4 w-4" />
              Import from Google Workspace
            </Button>
          </Can>
        </div>
      </div>

      {users.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          No members found.
        </p>
      ) : (
        <PeopleTable data={users} pendingActions={pendingActions} />
      )}

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
