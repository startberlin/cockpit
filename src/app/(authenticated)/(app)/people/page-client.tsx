"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { PeopleTable } from "@/components/people-table";
import type { PublicUser } from "@/db/people";
import { CreateUserDialog } from "./create-user-dialog";

interface PeoplePageClientProps {
  users: PublicUser[];
  batches: { number: number }[];
}

export default function PeoplePageClient({
  users,
  batches,
}: PeoplePageClientProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const handleSuccess = React.useCallback(() => {
    router.refresh();

    toast.success("Creating user...", {
      description:
        "It may take a few minutes for the user to appear in the list.",
    });
  }, [router]);

  return (
    <>
      <PeopleTable data={users} onCreateUserClick={() => setOpen(true)} />
      <CreateUserDialog
        open={open}
        onOpenChange={setOpen}
        batches={batches}
        onSuccess={handleSuccess}
      />
    </>
  );
}
