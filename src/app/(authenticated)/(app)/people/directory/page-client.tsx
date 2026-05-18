"use client";

import { Download, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Can } from "@/components/can";
import { PeopleTable } from "@/components/people-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { PaginatedUsers } from "@/db/people";
import type { PendingBoardAction } from "@/db/people-actions";
import { CreateUserDialog } from "../create-user-dialog";
import { ImportGoogleUserDialog } from "../import-google-user-dialog";

interface DirectoryPageClientProps {
  usersPromise: Promise<PaginatedUsers>;
  batches: { number: number }[];
  pendingActions: PendingBoardAction[];
  initialSearch: string;
}

function DirectoryTableSkeleton() {
  return (
    <div className="rounded-md border">
      <div className="flex border-b px-4 py-3 gap-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          className="flex border-b last:border-b-0 px-4 py-3 gap-4 items-center"
        >
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

function UserTableSection({
  usersPromise,
  pendingActions,
  initialSearch,
}: {
  usersPromise: Promise<PaginatedUsers>;
  pendingActions: PendingBoardAction[];
  initialSearch: string;
}) {
  const { users, total, pageCount } = React.use(usersPromise);

  if (total === 0 && !initialSearch) {
    return (
      <p className="text-muted-foreground py-8 text-center">
        No members found.
      </p>
    );
  }

  return (
    <PeopleTable
      data={users}
      total={total}
      pageCount={pageCount}
      pendingActions={pendingActions}
      initialSearch={initialSearch}
    />
  );
}

export default function DirectoryPageClient({
  usersPromise,
  batches,
  pendingActions,
  initialSearch,
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

      <React.Suspense fallback={<DirectoryTableSkeleton />}>
        <UserTableSection
          usersPromise={usersPromise}
          pendingActions={pendingActions}
          initialSearch={initialSearch}
        />
      </React.Suspense>

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
