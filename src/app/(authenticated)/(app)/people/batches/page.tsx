import { redirect } from "next/navigation";
import db from "@/db";
import { batch } from "@/db/schema/batch";
import { createMetadata } from "@/lib/metadata";
import { can } from "@/lib/permissions/server";
import BatchesPageClient from "./page-client";

export const metadata = createMetadata({
  title: "Batches",
  description: "Manage START Berlin intake batches.",
});

export default async function BatchesPage() {
  if (!(await can("batches.manage"))) {
    redirect("/people/directory");
  }

  const batches = await db.select().from(batch).orderBy(batch.number);

  return <BatchesPageClient batches={batches} />;
}
