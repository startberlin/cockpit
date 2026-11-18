import { notFound } from "next/navigation";
import { requireAppAccess } from "@/lib/apps/server";
import { createMetadata } from "@/lib/metadata";
import { can } from "@/lib/permissions/server";
import { ActivityLog } from "../components/activity-log";
import { JobForm } from "../components/job-form";
import { PageHeader } from "../components/page-header";
import { JobboardError, service } from "../lib/service";

export const metadata = createMetadata({
  title: "Edit job",
  description: "Review and manage a network opportunity.",
});
export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAppAccess("jobboard");
  const { id } = await params;
  const [job, activity, canPublish] = await Promise.all([
    service.getJob(id).catch((error: unknown) => {
      if (error instanceof JobboardError && error.code === "not_found")
        notFound();
      throw error;
    }),
    service.getAudit({ entityId: id }),
    can("apps.jobboard.publish"),
  ]);
  const companies = await service.listCompanyOptions("", job.companyId);
  return (
    <div className="space-y-6">
      <PageHeader
        title={job.title}
        description={job.companyName}
        back={{ href: "/jobboard/jobs", label: "Back to jobs" }}
      />
      <JobForm
        key={`${job.id}-${job.updatedAt.toISOString()}-${job.reviewToken}`}
        job={job}
        companies={companies}
        canPublish={canPublish}
      />
      <ActivityLog entries={activity} />
    </div>
  );
}
