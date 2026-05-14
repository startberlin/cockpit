import { all } from "better-all";
import db from "@/db";
import type { PublicUser } from "@/db/people";
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

export default async function DirectoryPage() {
  const currentUser = await getCurrentUser();
  const usersPromise: Promise<PublicUser[]> = getAllUserPublicData();

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
    />
  );
}
