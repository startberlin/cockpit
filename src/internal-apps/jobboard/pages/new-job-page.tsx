import { requireAppAccess } from "@/lib/apps/server";
import { createMetadata } from "@/lib/metadata";
import { can } from "@/lib/permissions/server";
import { JobForm } from "../components/job-form";
import { EmptyState, PageHeader } from "../components/page-header";
import { service } from "../lib/service";

export const metadata = createMetadata({
  title: "Add job",
  description: "Create a new job draft.",
});
export default async function NewJobPage() {
  await requireAppAccess("jobboard");
  const [companies, canPublish] = await Promise.all([
    service.listCompanyOptions(),
    can("apps.jobboard.publish"),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Add job"
        back={{ href: "/jobboard/jobs", label: "Back to jobs" }}
      />
      {companies.length ? (
        <JobForm companies={companies} canPublish={canPublish} />
      ) : (
        <EmptyState
          title="Add the employer first"
          description="Create a company before adding its first job."
          href="/jobboard/companies/new"
          action="Add company"
        />
      )}
    </div>
  );
}
