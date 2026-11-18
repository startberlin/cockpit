import { createSearchParamsCache, type SearchParams } from "nuqs/server";
import { requireAppAccess } from "@/lib/apps/server";
import { createMetadata } from "@/lib/metadata";
import { PageHeader } from "../components/page-header";
import { SubmissionList } from "../components/submission-list";
import { submissionListParams } from "../lib/list-params";
import { service } from "../lib/service";

export const metadata = createMetadata({
  title: "Job submissions",
  description: "Review incoming employer submissions.",
});
const query = createSearchParamsCache(submissionListParams);
export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAppAccess("jobboard");
  const result = await service.listSubmissionSummaries(
    await query.parse(searchParams),
  );
  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6">
      <PageHeader title="Submissions" />
      <SubmissionList {...result} />
    </div>
  );
}
