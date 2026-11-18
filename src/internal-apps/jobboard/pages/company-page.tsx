import { ExternalLinkIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { requireAppAccess } from "@/lib/apps/server";
import { createMetadata } from "@/lib/metadata";
import { ActivityLog } from "../components/activity-log";
import { CompanyForm } from "../components/company-form";
import { DeleteCompany } from "../components/delete-company";
import { PageHeader } from "../components/page-header";
import { JobboardError, service } from "../lib/service";

export const metadata = createMetadata({
  title: "Edit company",
  description: "Manage a public profile and private company records.",
});
export default async function CompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAppAccess("jobboard");
  const { id } = await params;
  const company = await service.getCompany(id).catch((error: unknown) => {
    if (error instanceof JobboardError && error.code === "not_found")
      notFound();
    throw error;
  });
  const [activity, jobCount] = await Promise.all([
    service.getAudit({ entityId: id }),
    service.getCompanyJobCount(id),
  ]);
  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-6">
      <PageHeader
        title={company.name}
        back={{ href: "/jobboard/companies", label: "Back to companies" }}
      >
        <Button variant="outline" asChild>
          <a href={company.website} target="_blank" rel="noopener noreferrer">
            Website <ExternalLinkIcon aria-hidden="true" />
          </a>
        </Button>
      </PageHeader>
      <CompanyForm
        key={`${company.id}-${company.updatedAt.toISOString()}`}
        company={{
          ...company,
          expectedUpdatedAt: company.updatedAt.toISOString(),
        }}
      />
      <ActivityLog entries={activity} />
      <DeleteCompany id={company.id} name={company.name} jobCount={jobCount} />
    </div>
  );
}
