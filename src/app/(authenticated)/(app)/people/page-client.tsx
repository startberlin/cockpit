"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { PeopleTable } from "@/components/people-table";
import type { PublicUserWithDetails } from "@/db/people";
import { CreateUserDialog } from "./create-user-dialog";

interface PeoplePageClientProps {
  users: PublicUserWithDetails[];
  batches: { number: number }[];
  departments: { id: string; name: string }[];
}

export default function PeoplePageClient({
  users,
  batches,
  departments,
}: PeoplePageClientProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <PeopleTable data={users} onCreateUserClick={() => setOpen(true)} />
      <CreateUserDialog
        open={open}
        onOpenChange={setOpen}
        batches={batches}
        departments={departments}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
