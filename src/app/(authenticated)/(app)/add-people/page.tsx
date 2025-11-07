import AddPeopleFormClient from "@/components/AddPeopleFormClient";
import db from "@/db";
import { batch } from "@/db/schema/batch";
import { department } from "@/db/schema/department";

export const dynamic = "force-dynamic";

export default async function AddPeoplePage() {
  const batches = await db.select().from(batch).orderBy(batch.number);
  const departments = await db
    .select()
    .from(department)
    .orderBy(department.name);

  return <AddPeopleFormClient batches={batches} departments={departments} />;
}
