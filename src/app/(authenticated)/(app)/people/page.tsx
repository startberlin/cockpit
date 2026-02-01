import { all } from "better-all";
import db from "@/db";
import { getAllUserPublicData } from "@/db/people";
import { batch } from "@/db/schema/batch";
import { createMetadata } from "@/lib/metadata";
import PeoplePageClient from "./page-client";

export const metadata = createMetadata({
  title: "Cockpit",
  description: "Manage your membership, get access to software and more.",
});

export default async function Home() {
  const { users, batches } = await all({
    users: getAllUserPublicData,
    batches: async () => db.select().from(batch).orderBy(batch.number),
  });

  if (!users.data) {
    return <p>No users found</p>;
  }

  return <PeoplePageClient users={users.data} batches={batches} />;
}
