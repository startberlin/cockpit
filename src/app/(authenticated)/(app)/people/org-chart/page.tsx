import db from "@/db";
import { getOrgChartData } from "@/db/people";
import { batch } from "@/db/schema/batch";
import { createMetadata } from "@/lib/metadata";

import OrgChartPageClient from "./page-client";

export const metadata = createMetadata({
  title: "Org Chart",
  description: "START Berlin organisation structure.",
});

export default async function OrgChartPage() {
  const [users, batches] = await Promise.all([
    getOrgChartData(),
    db.select({ number: batch.number }).from(batch).orderBy(batch.number),
  ]);

  return (
    <>
      <div className="pb-6">
        <h1 className="text-xl font-semibold">Org Chart</h1>
        <p className="text-muted-foreground text-sm mt-1">
          START Berlin organisation structure.
        </p>
      </div>
      <OrgChartPageClient users={users} batches={batches} />
    </>
  );
}
