import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

function LoadingFrame({
  label,
  children,
  className = "max-w-7xl",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto w-full min-w-0 space-y-6 ${className}`}
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-11 w-28" />
    </div>
  );
}

function RowsSkeleton() {
  return (
    <div className="divide-y overflow-hidden rounded-xl border bg-card">
      {[1, 2, 3, 4, 5].map((row) => (
        <div key={row} className="flex items-center justify-between gap-6 p-5">
          <div className="min-w-0 flex-1 space-y-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      ))}
    </div>
  );
}

export function JobsLoading() {
  return (
    <LoadingFrame label="Loading jobs" className="@container/jobs max-w-7xl">
      <HeaderSkeleton />
      <div className="grid gap-4 rounded-xl border bg-card p-4 @min-[29rem]/jobs:grid-cols-[minmax(0,1fr)_180px] @min-[42rem]/jobs:grid-cols-[minmax(0,1fr)_180px_180px]">
        {["search", "status", "sort"].map((field) => (
          <Skeleton key={field} className="h-16" />
        ))}
      </div>
      <Skeleton className="h-4 w-40" />
      <RowsSkeleton />
    </LoadingFrame>
  );
}

export function CompaniesLoading() {
  return (
    <LoadingFrame label="Loading companies">
      <HeaderSkeleton />
      <div className="rounded-xl border bg-card p-4">
        <Skeleton className="h-16 max-w-lg" />
      </div>
      <Skeleton className="h-4 w-40" />
      <RowsSkeleton />
    </LoadingFrame>
  );
}

export function SubmissionsLoading() {
  return (
    <LoadingFrame label="Loading submissions">
      <Skeleton className="h-8 w-40" />
      <div className="space-y-4 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((status) => (
            <Skeleton key={status} className="h-11 w-32" />
          ))}
        </div>
        <Skeleton className="h-16 max-w-lg" />
      </div>
      <Skeleton className="h-4 w-40" />
      <div className="space-y-3">
        {[1, 2, 3].map((row) => (
          <Skeleton key={row} className="h-32 rounded-xl" />
        ))}
      </div>
    </LoadingFrame>
  );
}

function JobEditorSkeleton() {
  return (
    <div className="@container/workspace min-w-0 rounded-lg border">
      <div className="flex flex-wrap justify-between gap-3 border-b p-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-60 max-w-full" />
      </div>
      <div className="flex flex-col @min-[58rem]/workspace:h-[calc(100dvh-16rem)] @min-[58rem]/workspace:min-h-[30rem]">
        <Skeleton className="m-3 h-9 shrink-0 @min-[58rem]/workspace:hidden" />
        <div className="grid min-h-0 min-w-0 flex-1 @min-[58rem]/workspace:grid-cols-2">
          <div className="space-y-5 p-4 sm:p-6">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
            <Skeleton className="h-40" />
          </div>
          <div className="hidden space-y-6 border-l bg-muted/35 p-6 @min-[58rem]/workspace:block">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-72" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function NewJobLoading() {
  return (
    <LoadingFrame label="Loading new job editor" className="">
      <Skeleton className="h-11 w-32" />
      <Skeleton className="h-8 w-40" />
      <JobEditorSkeleton />
    </LoadingFrame>
  );
}

export function JobLoading() {
  return (
    <LoadingFrame label="Loading job editor" className="">
      <Skeleton className="h-11 w-32" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-40" />
      </div>
      <JobEditorSkeleton />
      <Skeleton className="h-16 rounded-xl" />
    </LoadingFrame>
  );
}

function CompanyEditorSkeleton() {
  return (
    <div className="@container/company space-y-6 rounded-xl border bg-card p-5 sm:p-6">
      <Skeleton className="h-5 w-32" />
      <div className="grid gap-5 @min-[28rem]/company:grid-cols-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <Skeleton className="h-28" />
      <div className="flex justify-between gap-3 border-t pt-6">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-11 w-32" />
      </div>
      <Skeleton className="h-5 w-32" />
      <div className="grid gap-5 border-t pt-6 @min-[28rem]/company:grid-cols-2">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}

export function NewCompanyLoading() {
  return (
    <LoadingFrame label="Loading new company editor" className="max-w-4xl">
      <Skeleton className="h-11 w-32" />
      <Skeleton className="h-8 w-40" />
      <CompanyEditorSkeleton />
      <Skeleton className="ml-auto h-11 w-32" />
    </LoadingFrame>
  );
}

export function CompanyLoading() {
  return (
    <LoadingFrame label="Loading company editor" className="max-w-4xl">
      <Skeleton className="h-11 w-32" />
      <HeaderSkeleton />
      <CompanyEditorSkeleton />
      <Skeleton className="ml-auto h-11 w-32" />
      <Skeleton className="h-16 rounded-xl" />
      <Skeleton className="h-28 rounded-xl" />
    </LoadingFrame>
  );
}

export function AnalyticsLoading() {
  return (
    <LoadingFrame
      label="Loading analytics"
      className="@container/analytics max-w-7xl"
    >
      <HeaderSkeleton />
      <Skeleton className="h-4 w-60" />
      <div className="grid grid-cols-2 gap-3 @min-[32rem]/analytics:grid-cols-3 @min-[55rem]/analytics:grid-cols-5">
        {[1, 2, 3, 4, 5].map((metric) => (
          <Skeleton key={metric} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-11 w-44" />
      </div>
      <Skeleton className="h-72 rounded-xl" />
      <div className="grid gap-4 @min-[44rem]/analytics:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="h-14 rounded-xl" />
      <Skeleton className="h-14 rounded-xl" />
    </LoadingFrame>
  );
}

export function SettingsLoading() {
  return (
    <LoadingFrame label="Loading jobboard settings" className="max-w-4xl">
      <HeaderSkeleton />
      {[
        {
          id: "connections",
          rows: ["h-10", "h-10", "h-10", "h-20 sm:h-14", "h-24 sm:h-20"],
        },
        { id: "defaults", rows: ["h-10", "h-10", "h-10"] },
      ].map((section) => (
        <div
          key={section.id}
          className="space-y-4 rounded-xl border bg-card p-5 sm:p-6"
        >
          <Skeleton className="h-6 w-40" />
          {section.rows.map((height, row) => (
            <Skeleton key={row} className={height} />
          ))}
        </div>
      ))}
    </LoadingFrame>
  );
}
