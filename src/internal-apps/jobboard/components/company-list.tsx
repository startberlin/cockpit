"use client";

import {
  Building2Icon,
  ChevronRightIcon,
  SearchIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { createSerializer, debounce, useQueryStates } from "nuqs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  listParams,
  type ListPagination as Pagination,
} from "../lib/list-params";
import { CompanyFavicon } from "./company-favicon";
import { ListCount, ListPagination } from "./list-pagination";
import { EmptyState } from "./page-header";

const listUrl = createSerializer(listParams);

type CompanyRow = {
  id: string;
  name: string;
  website: string;
  contactCount: number;
  jobCount: number;
};
function websiteLabel(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

export function CompanyList({
  rows,
  total,
  ...pagination
}: Pagination & { rows: CompanyRow[]; total: number }) {
  const [{ q }, setFilters] = useQueryStates(listParams, { shallow: false });
  const clear = () => void setFilters({ q: null, page: null });
  if (!total)
    return (
      <EmptyState
        title="No companies yet"
        description="Add a company to create its first job."
        href="/jobboard/companies/new"
        action="Add company"
        icon={<Building2Icon aria-hidden="true" />}
      />
    );
  return (
    <div className="min-w-0 space-y-4">
      <div className="space-y-2 rounded-xl border bg-card p-4">
        <Label htmlFor="company-search">Search companies</Label>
        <div className="relative max-w-lg">
          <SearchIcon
            className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="company-search"
            type="search"
            autoComplete="off"
            className="h-11 pl-9"
            value={q}
            onChange={(event) =>
              void setFilters(
                { q: event.target.value, page: null },
                { limitUrlUpdates: debounce(250) },
              )
            }
            placeholder="Company name or website"
          />
        </div>
      </div>
      <div className="flex min-h-9 items-center justify-between gap-3">
        <ListCount
          {...pagination}
          total={total}
          singular="company"
          plural="companies"
        />
        {q ? (
          <Button variant="ghost" size="sm" className="min-h-9" onClick={clear}>
            <XIcon aria-hidden="true" /> Clear search
          </Button>
        ) : null}
      </div>
      {rows.length ? (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
          {rows.map((company) => (
            <li key={company.id}>
              <Link
                href={`/jobboard/companies/${company.id}`}
                className="group flex min-w-0 items-center gap-4 px-4 py-5 transition-colors hover:bg-muted/35 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring sm:px-5"
              >
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border bg-card sm:size-11">
                  <CompanyFavicon companyId={company.id} size={26} />
                </span>
                <div className="min-w-0 flex-1 space-y-2 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:space-y-0">
                  <div className="min-w-0 space-y-1">
                    <p className="break-words text-sm font-semibold group-hover:underline group-hover:underline-offset-4">
                      {company.name}
                    </p>
                    <p className="break-all text-xs text-muted-foreground">
                      {websiteLabel(company.website)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-5 text-xs text-muted-foreground">
                    <span className="tabular-nums">
                      <strong className="font-medium text-foreground">
                        {company.jobCount}
                      </strong>{" "}
                      {company.jobCount === 1 ? "job" : "jobs"}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <UsersIcon className="size-3.5" aria-hidden="true" />
                      {company.contactCount
                        ? `${company.contactCount} ${company.contactCount === 1 ? "contact" : "contacts"}`
                        : "No contacts"}
                    </span>
                  </div>
                </div>
                <ChevronRightIcon
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No matching company"
          description="Try another name or website."
        >
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" className="min-h-11" onClick={clear}>
              Clear search
            </Button>
            <Button className="min-h-11" asChild>
              <Link href="/jobboard/companies/new">Add company</Link>
            </Button>
          </div>
        </EmptyState>
      )}
      <ListPagination
        {...pagination}
        hrefForPage={(page) => listUrl("/jobboard/companies", { page, q })}
      />
    </div>
  );
}
