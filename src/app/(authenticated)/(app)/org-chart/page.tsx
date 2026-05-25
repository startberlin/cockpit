import { getOrgChartData } from "@/db/people";
import { createMetadata } from "@/lib/metadata";
import OrgChartPageClient from "./page-client";

export const metadata = createMetadata({
  title: "Org chart",
  description: "START Berlin organisation structure.",
});

export default async function OrgChartPage() {
  const users = await getOrgChartData();

  return (
    <>
      <div className="mx-auto w-full max-w-4xl p-6 pb-4">
        <h1 className="text-xl font-semibold">Org chart</h1>
        <p className="text-muted-foreground text-sm mt-1">
          START Berlin organisation structure.
        </p>
      </div>
      <OrgChartPageClient users={users} />
    </>
  );
}
