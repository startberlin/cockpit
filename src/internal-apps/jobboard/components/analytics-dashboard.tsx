"use client";

import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
} from "lucide-react";
import Link from "next/link";
import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  JOB_METRICS_PAGE_SIZE,
  selectJobMetrics,
} from "../lib/analytics-display";
import type { MetricTotals, service } from "../lib/service";
import { ContextHelp } from "./context-help";
import { EmptyState } from "./page-header";

type Analytics = Awaited<ReturnType<typeof service.getAnalytics>>;
const jobMetrics = ["jobViews", "applyClicks", "shareClicks"] as const;
const metricKeys = [...jobMetrics, "boardRequests", "widgetRequests"] as const;
const metrics: {
  key: keyof MetricTotals;
  label: string;
  description: string;
}[] = [
  {
    key: "boardRequests",
    label: "Board requests",
    description: "Requests for the full jobboard.",
  },
  {
    key: "widgetRequests",
    label: "Widget requests",
    description: "Requests for the website widget.",
  },
  {
    key: "jobViews",
    label: "Job page requests",
    description: "Requests for individual job pages.",
  },
  {
    key: "applyClicks",
    label: "Apply redirects",
    description:
      "Redirects to employer applications. Completed applications are not measured.",
  },
  {
    key: "shareClicks",
    label: "Share redirects",
    description:
      "Redirects to WhatsApp or LinkedIn. Completed shares are not measured.",
  },
];
const sourceLabels: Record<string, string> = {
  direct: "Direct",
  website: "START website",
  widget: "Website widget",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  newsletter: "Newsletter",
  unknown: "Unknown",
};
const zeros: MetricTotals = {
  boardRequests: 0,
  widgetRequests: 0,
  jobViews: 0,
  applyClicks: 0,
  shareClicks: 0,
};
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const numberFormat = new Intl.NumberFormat("en-GB");
const compactNumberFormat = new Intl.NumberFormat("en-GB", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function dateLabel(value: string) {
  return dateFormat.format(new Date(`${value}T00:00:00Z`));
}

function Ranking({
  rows,
  label,
}: {
  rows: { id: string; label: string; value: number; href?: string }[];
  label: string;
}) {
  const max = rows[0]?.value ?? 0;
  if (!rows.length)
    return (
      <p className="py-8 text-sm text-muted-foreground">
        No {label.toLowerCase()} in this period.
      </p>
    );
  return (
    <ol className="space-y-4" aria-label={label}>
      {rows.map((row) => (
        <li key={row.id}>
          <div className="mb-2 flex items-baseline justify-between gap-4 text-sm">
            {row.href ? (
              <Link
                href={row.href}
                className="min-w-0 break-words font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-brand"
              >
                {row.label}
              </Link>
            ) : (
              <span className="min-w-0 break-words">{row.label}</span>
            )}
            <span className="shrink-0 tabular-nums">
              {numberFormat.format(row.value)}
            </span>
          </div>
          <div className="h-2 bg-muted" aria-hidden="true">
            <div
              className="h-full bg-brand"
              style={{ width: `${max ? (row.value / max) * 100 : 0}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function AnalyticsDashboard({
  analytics,
  days,
}: {
  analytics: Analytics;
  days: number;
}) {
  const [{ metric, jobQuery, jobPage }, setFilters] = useQueryStates({
    metric: parseAsStringLiteral(metricKeys).withDefault("jobViews"),
    jobQuery: parseAsString.withDefault(""),
    jobPage: parseAsInteger.withDefault(1),
  });
  const [allJobsOpen, setAllJobsOpen] = useState(
    Boolean(jobQuery || jobPage > 1),
  );
  const selectedLabel =
    metrics.find((item) => item.key === metric)?.label ?? "Job page requests";
  const dailyMap = new Map(analytics.daily.map((day) => [day.date, day]));
  const daily = Array.from({ length: days }, (_, index) => {
    const date = new Date(`${analytics.from}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    return { date: key, ...(dailyMap.get(key) ?? zeros) };
  });
  const { hasJobMetric, topJobs, pageJobs, total, pages, page } =
    selectJobMetrics(analytics.jobs, metric, jobQuery, jobPage);
  const sources = [...analytics.sources]
    .filter((source) => source[metric] > 0)
    .sort((a, b) => b[metric] - a[metric]);
  const hasActivity = metrics.some(({ key }) => analytics.totals[key] > 0);
  const chartConfig = {
    [metric]: { label: selectedLabel, color: "var(--brand)" },
  };

  return (
    <div className="@container/analytics min-w-0 space-y-6">
      <div className="grid grid-cols-2 gap-3 @min-[32rem]/analytics:grid-cols-3 @min-[55rem]/analytics:grid-cols-5">
        {metrics.map(({ key, label, description }) => (
          <div
            key={key}
            className="min-w-0 space-y-3 rounded-xl border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                {label}
              </p>
              <ContextHelp label={`About ${label.toLowerCase()}`}>
                {description}
              </ContextHelp>
            </div>
            <p className="text-3xl font-semibold tracking-tight tabular-nums">
              {numberFormat.format(analytics.totals[key])}
            </p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>Request counts</span>
          <ContextHelp label="How analytics are counted">
            Counts are not unique people. Some automated traffic may remain.
            Apply and share redirects do not confirm completed actions.
          </ContextHelp>
        </div>
        {hasActivity ? (
          <div className="flex items-center gap-3">
            <Label htmlFor="analytics-metric" className="sr-only">
              Chart metric
            </Label>
            <NativeSelect
              id="analytics-metric"
              className="h-11 bg-card"
              value={metric}
              onChange={(event) =>
                void setFilters({
                  metric: event.target.value as keyof MetricTotals,
                  jobPage: null,
                })
              }
            >
              {metrics.map((item) => (
                <NativeSelectOption key={item.key} value={item.key}>
                  {item.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ) : null}
      </div>
      {!hasActivity ? (
        <EmptyState
          title="No activity yet"
          description="Try a longer period or check the connection in Settings."
          href="/jobboard/settings"
          action="View settings"
        />
      ) : (
        <>
          <section
            className="min-w-0 rounded-xl border bg-card p-4 sm:p-5"
            aria-labelledby="analytics-trend-heading"
          >
            <h2
              id="analytics-trend-heading"
              className="mb-5 text-base font-semibold"
            >
              Daily activity
            </h2>
            <ChartContainer
              config={chartConfig}
              className="h-56 w-full aspect-auto sm:h-64"
            >
              <LineChart
                accessibilityLayer
                data={daily}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                aria-label={`${selectedLabel} per day in UTC`}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  minTickGap={40}
                  tickFormatter={dateLabel}
                />
                <YAxis
                  width={38}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  tickFormatter={(value: number) =>
                    compactNumberFormat.format(value)
                  }
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => dateLabel(String(value))}
                    />
                  }
                />
                <Line
                  type="linear"
                  dataKey={metric}
                  stroke={`var(--color-${metric})`}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ChartContainer>
          </section>
          <div
            className={`grid min-w-0 gap-4 ${hasJobMetric ? "@min-[44rem]/analytics:grid-cols-2" : ""}`}
          >
            {hasJobMetric ? (
              <section
                className="min-w-0 rounded-xl border bg-card p-4 sm:p-5"
                aria-labelledby="analytics-jobs-heading"
              >
                <h2
                  id="analytics-jobs-heading"
                  className="mb-5 text-base font-semibold"
                >
                  Top jobs
                </h2>
                <Ranking
                  label={selectedLabel}
                  rows={topJobs.map((job) => ({
                    id: job.jobId,
                    label: job.title,
                    value: job[metric],
                    href: `/jobboard/jobs/${job.jobId}`,
                  }))}
                />
              </section>
            ) : null}
            <section
              className="min-w-0 rounded-xl border bg-card p-4 sm:p-5"
              aria-labelledby="analytics-sources-heading"
            >
              <div className="mb-5 flex items-center gap-1">
                <h2
                  id="analytics-sources-heading"
                  className="text-base font-semibold"
                >
                  Sources
                </h2>
                {metric === "shareClicks" ? (
                  <ContextHelp label="About sharing sources">
                    For share redirects, the source is the chosen sharing
                    channel.
                  </ContextHelp>
                ) : null}
              </div>
              <Ranking
                label={selectedLabel}
                rows={sources.map((source) => ({
                  id: source.source,
                  label: sourceLabels[source.source] ?? source.source,
                  value: source[metric],
                }))}
              />
            </section>
          </div>
          <details
            className="group min-w-0 rounded-xl border bg-card"
            open={allJobsOpen}
            onToggle={(event) => setAllJobsOpen(event.currentTarget.open)}
          >
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 p-4 focus-visible:outline-2 focus-visible:outline-brand sm:p-5 [&::-webkit-details-marker]:hidden">
              <span className="text-sm font-semibold">
                All job metrics{" "}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {analytics.jobs.length}
                </span>
              </span>
              <ChevronDownIcon
                className="size-4 text-muted-foreground group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="border-t p-4 sm:p-5">
              <Label className="sr-only" htmlFor="analytics-job-search">
                Search job metrics
              </Label>
              <div className="relative max-w-md">
                <SearchIcon
                  className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="analytics-job-search"
                  type="search"
                  autoComplete="off"
                  placeholder="Search jobs"
                  className="h-11 pl-9"
                  value={jobQuery}
                  onChange={(event) =>
                    void setFilters({
                      jobQuery: event.target.value,
                      jobPage: null,
                    })
                  }
                />
              </div>
              {pageJobs.length ? (
                <ul className="mt-4 divide-y">
                  {pageJobs.map((job) => (
                    <li
                      key={job.jobId}
                      className="grid min-w-0 gap-2 py-4 @min-[40rem]/analytics:grid-cols-[minmax(0,1fr)_auto] @min-[40rem]/analytics:items-center @min-[40rem]/analytics:gap-6"
                    >
                      <Link
                        href={`/jobboard/jobs/${job.jobId}`}
                        className="min-w-0 break-words text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-brand"
                      >
                        {job.title}
                      </Link>
                      <dl className="grid grid-cols-3 gap-4 text-xs @min-[40rem]/analytics:min-w-64">
                        {jobMetrics.map((key) => (
                          <div key={key}>
                            <dt className="text-muted-foreground">
                              {key === "jobViews"
                                ? "Page requests"
                                : key === "applyClicks"
                                  ? "Apply redirects"
                                  : "Share redirects"}
                            </dt>
                            <dd className="mt-1 tabular-nums">
                              {numberFormat.format(job[key])}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-6 text-sm text-muted-foreground">
                  No matching jobs.
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {total
                    ? `${(page - 1) * JOB_METRICS_PAGE_SIZE + 1}-${Math.min(page * JOB_METRICS_PAGE_SIZE, total)} of ${total} jobs`
                    : "0 jobs"}
                </p>
                {pages > 1 ? (
                  <nav
                    className="flex items-center gap-2"
                    aria-label="Job metrics pages"
                  >
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-10"
                      aria-label="Previous jobs"
                      disabled={page === 1}
                      onClick={() => void setFilters({ jobPage: page - 1 })}
                    >
                      <ChevronLeftIcon aria-hidden="true" />
                    </Button>
                    <span className="text-xs tabular-nums">
                      {page} / {pages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-10"
                      aria-label="Next jobs"
                      disabled={page === pages}
                      onClick={() => void setFilters({ jobPage: page + 1 })}
                    >
                      <ChevronRightIcon aria-hidden="true" />
                    </Button>
                  </nav>
                ) : null}
              </div>
            </div>
          </details>
          <details className="group min-w-0 rounded-xl border bg-card">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 p-4 focus-visible:outline-2 focus-visible:outline-brand sm:p-5 [&::-webkit-details-marker]:hidden">
              <span className="text-sm font-semibold">Daily figures</span>
              <ChevronDownIcon
                className="size-4 text-muted-foreground group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <section
              aria-label="Daily figures, scroll horizontally for all metrics"
              // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to focus this horizontal scroll region.
              tabIndex={0}
              className="min-w-0 overflow-x-auto border-t focus-visible:outline-2 focus-visible:outline-brand [&_[data-slot=table-container]]:overflow-visible"
            >
              <Table
                className="min-w-[740px]"
                aria-label="Daily activity figures"
              >
                <TableCaption className="sr-only">
                  Daily request counts in UTC, most recent first
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4">Date (UTC)</TableHead>
                    {metrics.map((item) => (
                      <TableHead
                        key={item.key}
                        className="px-4 text-right text-xs"
                      >
                        {item.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...daily].reverse().map((day) => (
                    <TableRow key={day.date}>
                      <TableCell className="px-4 py-3">
                        {dateLabel(day.date)}
                      </TableCell>
                      {metrics.map((item) => (
                        <TableCell
                          key={item.key}
                          className="px-4 text-right tabular-nums"
                        >
                          {numberFormat.format(day[item.key])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          </details>
        </>
      )}
    </div>
  );
}
