import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { createSearchParamsCache, type SearchParams } from "nuqs/server";
import { Button } from "@/components/ui/button";
import { requireAppAccess } from "@/lib/apps/server";
import { createMetadata } from "@/lib/metadata";
import { JobList } from "../components/job-list";
import { PageHeader } from "../components/page-header";
import { jobListParams } from "../lib/list-params";
import { service } from "../lib/service";

export const metadata = createMetadata({
  title: "Jobs",
  description: "Manage draft and published opportunities.",
});
const query = createSearchParamsCache(jobListParams);
export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAppAccess("jobboard");
  const result = await service.listJobSummaries(
    await query.parse(searchParams),
  );
  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6">
      <PageHeader title="Jobs">
        <Button asChild>
          <Link href="/jobboard/jobs/new">
            <PlusIcon aria-hidden="true" /> Add job
          </Link>
        </Button>
      </PageHeader>
      <JobList {...result} />
    </div>
  );
}
