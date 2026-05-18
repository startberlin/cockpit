import { all } from "better-all";
import db from "@/db";
import { getAllUserPublicData } from "@/db/people";
import { getPendingBoardActionsForUser } from "@/db/people-actions";
import { batch } from "@/db/schema/batch";
import { getCurrentUser } from "@/db/user";
import { createMetadata } from "@/lib/metadata";

import DirectoryPageClient from "./page-client";

export const metadata = createMetadata({
  title: "Directory",
  description: "Manage START Berlin members.",
});

interface DirectoryPageProps {
  searchParams: Promise<{ page?: string; q?: string }>;
}

export default async function DirectoryPage({
  searchParams,
}: DirectoryPageProps) {
  const currentUser = await getCurrentUser();
  const { page: pageParam, q: search = "" } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const usersPromise = getAllUserPublicData({ page, search });

  const { batches, pendingActions } = await all({
    batches: async () => db.select().from(batch).orderBy(batch.number),
    pendingActions: async () =>
      currentUser
        ? getPendingBoardActionsForUser(currentUser.id)
        : Promise.resolve([]),
  });

  return (
    <DirectoryPageClient
      usersPromise={usersPromise}
      batches={batches}
      pendingActions={pendingActions}
      initialSearch={search}
    />
  );
}
