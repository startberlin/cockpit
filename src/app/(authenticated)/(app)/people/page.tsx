import { all } from "better-all";
import db from "@/db";
import { getAllUserPublicData } from "@/db/people";
import { getPendingBoardActionsForUser } from "@/db/people-actions";
import { batch } from "@/db/schema/batch";
import { getCurrentUser } from "@/db/user";
import { createMetadata } from "@/lib/metadata";
import PeoplePageClient from "./page-client";

export const metadata = createMetadata({
  title: "Cockpit",
  description: "Manage START Berlin members.",
});

export default async function Home() {
  const currentUser = await getCurrentUser();

  const { users, batches, pendingActions } = await all({
    users: getAllUserPublicData,
    batches: async () => db.select().from(batch).orderBy(batch.number),
    pendingActions: async () =>
      currentUser
        ? getPendingBoardActionsForUser(currentUser.id)
        : Promise.resolve([]),
  });

  if (!users.length) {
    return <p>No members found</p>;
  }

  return (
    <PeoplePageClient
      users={users}
      batches={batches}
      pendingActions={pendingActions}
      hasPendingActions={pendingActions.length > 0}
    />
  );
}
