import { requireAppAccess } from "@/lib/apps/server";
import { createMetadata } from "@/lib/metadata";
import { CompanyForm } from "../components/company-form";
import { PageHeader } from "../components/page-header";

export const metadata = createMetadata({
  title: "Add company",
  description: "Add an employer to the jobboard.",
});
export default async function NewCompanyPage() {
  await requireAppAccess("jobboard");
  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-6">
      <PageHeader
        title="Add company"
        back={{ href: "/jobboard/companies", label: "Back to companies" }}
      />
      <CompanyForm />
    </div>
  );
}
