import {
  ArrowRightIcon,
  Building2Icon,
  CalendarClockIcon,
  CircleCheckIcon,
  ClipboardListIcon,
  FilePenLineIcon,
  PlusIcon,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requireAppAccess } from "@/lib/apps/server";
import { createMetadata } from "@/lib/metadata";
import { EmptyState, PageHeader } from "../components/page-header";
import { formatDate } from "../components/status-badge";
import { service } from "../lib/service";

export const metadata = createMetadata({
  title: "Jobboard overview",
  description: "Manage START Berlin network opportunities.",
});
export default async function OverviewPage() {
  await requireAppAccess("jobboard");
  const overview = await service.getDashboard();
  return (
    <div className="@container/overview mx-auto w-full min-w-0 max-w-7xl space-y-7">
      <PageHeader title="Overview">
        <Button asChild>
          <Link href="/jobboard/jobs/new">
            <PlusIcon aria-hidden="true" /> Add job
          </Link>
        </Button>
      </PageHeader>
      <div className="grid grid-cols-2 gap-3 @min-[40rem]/overview:grid-cols-4">
        {[
          {
            label: "Published",
            value: overview.counts.published,
            href: "/jobboard/jobs?status=published",
            icon: CircleCheckIcon,
          },
          {
            label: "Drafts",
            value: overview.counts.draft,
            href: "/jobboard/jobs?status=draft",
            icon: FilePenLineIcon,
          },
          {
            label: "Awaiting review",
            value: overview.pendingSubmissions,
            href: "/jobboard/submissions",
            icon: ClipboardListIcon,
          },
          {
            label: "Companies",
            value: overview.activeCompanies,
            href: "/jobboard/companies",
            icon: Building2Icon,
          },
        ].map((metric) => (
          <Link
            key={metric.label}
            href={metric.href}
            className="min-w-0 space-y-3 rounded-xl border bg-card p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                {metric.label}
              </p>
              <metric.icon
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <p className="text-3xl font-semibold tracking-tight tabular-nums">
              {metric.value}
            </p>
          </Link>
        ))}
      </div>
      {overview.pendingSubmissions > 0 ? (
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">
              {overview.pendingSubmissions}{" "}
              {overview.pendingSubmissions === 1
                ? "submission needs"
                : "submissions need"}{" "}
              a decision
            </h2>
          </div>
          <Button className="min-h-11 shrink-0" variant="outline" asChild>
            <Link href="/jobboard/submissions">
              Review submissions <ArrowRightIcon aria-hidden="true" />
            </Link>
          </Button>
        </div>
      ) : null}
      <section className="min-w-0 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <CalendarClockIcon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />{" "}
              Expiring soon
            </h2>
            <p className="text-sm text-muted-foreground">Next 7 days</p>
          </div>
          <Link
            href="/jobboard/jobs?status=published&sort=expiry"
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-sm text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            All published jobs{" "}
            <ArrowRightIcon className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
        {overview.expiringJobs.length ? (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
            {overview.expiringJobs.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/jobboard/jobs/${job.id}`}
                  className="flex min-w-0 flex-col justify-between gap-3 p-5 text-sm focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand sm:flex-row"
                >
                  <span className="min-w-0 break-words font-medium">
                    {job.title}
                    <span className="block font-normal text-muted-foreground">
                      {job.companyName}
                    </span>
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    Expires {formatDate(job.expiresAt, "UTC")} (UTC)
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title={
              overview.counts.published
                ? "No renewals needed this week"
                : "No published roles yet"
            }
            description={
              overview.counts.published
                ? "No jobs expire in the next 7 days."
                : overview.activeCompanies
                  ? "Open a draft to review its details."
                  : "Add a company to create your first job."
            }
            icon={<CalendarClockIcon aria-hidden="true" />}
            href={
              overview.counts.published
                ? undefined
                : overview.activeCompanies
                  ? "/jobboard/jobs"
                  : "/jobboard/companies/new"
            }
            action={
              overview.counts.published
                ? undefined
                : overview.activeCompanies
                  ? "View jobs"
                  : "Add company"
            }
          />
        )}
      </section>
      <nav aria-label="Other job statuses" className="flex flex-wrap gap-2">
        {[
          {
            label: "Paused",
            count: overview.counts.paused,
            href: "/jobboard/jobs?status=paused",
          },
          {
            label: "Closed",
            count: overview.counts.closed,
            href: "/jobboard/jobs?status=closed",
          },
          {
            label: "Expired",
            count: overview.counts.expired,
            href: "/jobboard/jobs?status=expired",
          },
        ].map((item) => (
          <Button
            key={item.label}
            variant="outline"
            className="min-h-11"
            asChild
          >
            <Link href={item.href}>
              {item.label}
              <span className="tabular-nums text-muted-foreground">
                {item.count}
              </span>
            </Link>
          </Button>
        ))}
      </nav>
    </div>
  );
}
