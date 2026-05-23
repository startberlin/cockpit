"use client";

import * as React from "react";
import { PeopleTable } from "@/components/people-table";
import type { PaginatedUsers } from "@/db/people";

interface AdminDirectoryPageClientProps {
  usersPromise: Promise<PaginatedUsers>;
  initialSearch: string;
}

function UsersTableSection({
  usersPromise,
  initialSearch,
}: {
  usersPromise: Promise<PaginatedUsers>;
  initialSearch: string;
}) {
  const { users, total, pageCount } = React.use(usersPromise);

  return (
    <PeopleTable
      data={users}
      total={total}
      pageCount={pageCount}
      pendingActions={[]}
      initialSearch={initialSearch}
    />
  );
}

export default function AdminDirectoryPageClient({
  usersPromise,
  initialSearch,
}: AdminDirectoryPageClientProps) {
  return (
    <>
      <div className="flex items-center justify-between pb-4">
        <div>
          <h1 className="text-xl font-semibold">People</h1>
          <p className="text-muted-foreground text-sm mt-1">
            All members as records
          </p>
        </div>
      </div>
      <React.Suspense
        fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}
      >
        <UsersTableSection
          usersPromise={usersPromise}
          initialSearch={initialSearch}
        />
      </React.Suspense>
    </>
  );
}
