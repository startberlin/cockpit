"use client";

import {
  ArrowUpDownIcon,
  BriefcaseBusinessIcon,
  ChevronRightIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { createSerializer, debounce, useQueryStates } from "nuqs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { jobStatuses } from "../lib/contracts";
import {
  jobFilterStatuses,
  jobListParams,
  jobSortOptions,
  type ListPagination as Pagination,
} from "../lib/list-params";
import { CompanyFavicon } from "./company-favicon";
import { ListCount, ListPagination } from "./list-pagination";
import { EmptyState } from "./page-header";
import { formatDate, StatusBadge } from "./status-badge";

const listUrl = createSerializer(jobListParams);

type JobRow = {
  id: string;
  title: string;
  companyId: string;
  companyName: string;
  status: string;
  expiresAt: Date | null;
  updatedAt: Date;
  hasUnpublishedChanges: boolean;
};
export function JobList({
  rows,
  counts,
  total,
  ...pagination
}: Pagination & {
  rows: JobRow[];
  total: number;
  counts: Record<string, number>;
}) {
  const [{ q, status, sort }, setFilters] = useQueryStates(jobListParams, {
    shallow: false,
  });
  const filtering = Boolean(q || status !== "all");
  const clear = () => void setFilters({ q: null, status: null, page: null });
  if (!total)
    return (
      <EmptyState
        title="Your first opportunity starts here"
        description="Add the first role as a draft for review."
        href="/jobboard/jobs/new"
        action="Add job"
        icon={<BriefcaseBusinessIcon aria-hidden="true" />}
      />
    );
  return (
    <div className="@container/jobs min-w-0 space-y-4">
      <div className="grid gap-4 rounded-xl border bg-card p-4 @min-[29rem]/jobs:grid-cols-[minmax(0,1fr)_180px] @min-[42rem]/jobs:grid-cols-[minmax(0,1fr)_180px_180px]">
        <div className="min-w-0 space-y-2">
          <Label htmlFor="job-search">Search jobs</Label>
          <div className="relative">
            <SearchIcon
              className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="job-search"
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
              placeholder="Job title or company"
            />
          </div>
        </div>
        <div className="space-y-2 [&_[data-slot=native-select-wrapper]]:w-full">
          <Label htmlFor="job-status">Status</Label>
          <NativeSelect
            id="job-status"
            className="h-11 bg-background"
            value={status}
            onChange={(event) =>
              void setFilters({
                page: null,
                status:
                  jobFilterStatuses.find(
                    (value) => value === event.target.value,
                  ) ?? "all",
              })
            }
          >
            <NativeSelectOption value="all">
              All statuses ({total})
            </NativeSelectOption>
            {jobStatuses.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {value[0].toUpperCase() + value.slice(1)} ({counts[value] ?? 0})
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2 @min-[29rem]/jobs:col-span-2 @min-[42rem]/jobs:col-span-1 [&_[data-slot=native-select-wrapper]]:w-full">
          <Label htmlFor="job-sort">
            <ArrowUpDownIcon className="size-3.5" aria-hidden="true" /> Sort by
          </Label>
          <NativeSelect
            id="job-sort"
            className="h-11 bg-background"
            value={sort}
            onChange={(event) =>
              void setFilters({
                page: null,
                sort:
                  jobSortOptions.find(
                    (value) => value === event.target.value,
                  ) ?? "updated",
              })
            }
          >
            <NativeSelectOption value="updated">
              Recently updated
            </NativeSelectOption>
            <NativeSelectOption value="expiry">Expiry date</NativeSelectOption>
            <NativeSelectOption value="title">Job title</NativeSelectOption>
          </NativeSelect>
        </div>
      </div>
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
        <ListCount {...pagination} total={total} singular="job" plural="jobs" />
        {filtering ? (
          <Button variant="ghost" size="sm" className="min-h-9" onClick={clear}>
            <XIcon aria-hidden="true" /> Clear filters
          </Button>
        ) : null}
      </div>
      {!rows.length ? (
        <EmptyState
          title="No jobs match your filters"
          description="Search another company or clear the filters to see every job."
        >
          <Button variant="outline" className="min-h-11" onClick={clear}>
            Clear filters
          </Button>
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
          <div className="hidden grid-cols-[minmax(0,1fr)_180px_130px_16px] gap-5 border-b bg-muted/30 px-5 py-3 text-xs font-medium text-muted-foreground @min-[42rem]/jobs:grid">
            <span>Role and company</span>
            <span>Publication</span>
            <span>Updated</span>
            <span className="sr-only">Open job</span>
          </div>
          <ul className="divide-y">
            {rows.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/jobboard/jobs/${job.id}`}
                  className="group grid min-w-0 grid-cols-[minmax(0,1fr)_16px] items-center gap-x-3 gap-y-3 px-4 py-5 transition-colors hover:bg-muted/35 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring sm:px-5 @min-[42rem]/jobs:grid-cols-[minmax(0,1fr)_180px_130px_16px] @min-[42rem]/jobs:gap-5"
                >
                  <div className="min-w-0 space-y-1.5">
                    <p className="break-words text-sm font-semibold leading-relaxed group-hover:underline group-hover:underline-offset-4">
                      {job.title}
                    </p>
                    <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                      <CompanyFavicon companyId={job.companyId} size={18} />
                      <span className="min-w-0 wrap-anywhere">
                        {job.companyName}
                      </span>
                    </p>
                  </div>
                  <ChevronRightIcon
                    className="col-start-2 row-start-1 size-4 text-muted-foreground @min-[42rem]/jobs:col-start-4"
                    aria-hidden="true"
                  />
                  <div className="col-span-2 flex flex-wrap items-center gap-2 @min-[42rem]/jobs:col-span-1 @min-[42rem]/jobs:col-start-2 @min-[42rem]/jobs:row-start-1 @min-[42rem]/jobs:flex-col @min-[42rem]/jobs:items-start">
                    <StatusBadge status={job.status} />
                    {job.hasUnpublishedChanges ? (
                      <Badge
                        variant="outline"
                        className="border-brand-accent/30 bg-brand-accent/10 text-brand"
                      >
                        Unpublished changes
                      </Badge>
                    ) : null}
                    {job.expiresAt ? (
                      <p className="w-full text-xs text-muted-foreground">
                        {job.status === "expired"
                          ? "Expired"
                          : job.status === "closed"
                            ? "End date"
                            : "Expires"}{" "}
                        {formatDate(job.expiresAt, "UTC")}
                      </p>
                    ) : null}
                  </div>
                  <p className="col-span-2 text-xs text-muted-foreground @min-[42rem]/jobs:col-span-1 @min-[42rem]/jobs:col-start-3 @min-[42rem]/jobs:row-start-1">
                    <span className="@min-[42rem]/jobs:sr-only">Updated </span>
                    {formatDate(job.updatedAt)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ListPagination
        {...pagination}
        hrefForPage={(page) =>
          listUrl("/jobboard/jobs", { page, q, status, sort })
        }
      />
      <p className="text-xs text-muted-foreground">
        Expiry dates use UTC. Edits stay in the draft until the next
        publication.
      </p>
    </div>
  );
}
