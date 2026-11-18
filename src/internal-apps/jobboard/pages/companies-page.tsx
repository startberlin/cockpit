import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { createSearchParamsCache, type SearchParams } from "nuqs/server";
import { Button } from "@/components/ui/button";
import { requireAppAccess } from "@/lib/apps/server";
import { createMetadata } from "@/lib/metadata";
import { CompanyList } from "../components/company-list";
import { PageHeader } from "../components/page-header";
import { listParams } from "../lib/list-params";
import { service } from "../lib/service";

export const metadata = createMetadata({
  title: "Companies",
  description: "Company profiles and private recruiting contacts.",
});
const query = createSearchParamsCache(listParams);
export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAppAccess("jobboard");
  const result = await service.listCompanySummaries(
    await query.parse(searchParams),
  );
  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6">
      <PageHeader title="Companies">
        <Button asChild>
          <Link href="/jobboard/companies/new">
            <PlusIcon aria-hidden="true" /> Add company
          </Link>
        </Button>
      </PageHeader>
      <CompanyList {...result} />
    </div>
  );
}
