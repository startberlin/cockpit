import db from "@/db";
import { getAllUserPublicData } from "@/db/people";
import { batch } from "@/db/schema/batch";
import { department } from "@/db/schema/department";
import { createMetadata } from "@/lib/metadata";
import PeoplePageClient from "./page-client";

export const metadata = createMetadata({
  title: "Cockpit",
  description: "Manage your membership, get access to software and more.",
});

export default async function Home() {
  const users = await getAllUserPublicData();

  if (!users.data) {
    return <p>No users found</p>;
  }

  const [batches, departments] = await Promise.all([
    db.select().from(batch).orderBy(batch.number),
    db.select().from(department).orderBy(department.name),
  ]);

  return (
    <PeoplePageClient
      users={users.data}
      batches={batches}
      departments={departments}
    />
  );
}
