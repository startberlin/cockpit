import type { MetricTotals } from "./service";

type JobMetrics = MetricTotals & { jobId: string; title: string };
export const JOB_METRICS_PAGE_SIZE = 10;

export function selectJobMetrics(
  jobs: JobMetrics[],
  metric: keyof MetricTotals,
  query: string,
  requestedPage: number,
) {
  const hasJobMetric =
    metric !== "boardRequests" && metric !== "widgetRequests";
  const rankingMetric = hasJobMetric ? metric : "jobViews";
  const ranked = [...jobs].sort(
    (a, b) =>
      b[rankingMetric] - a[rankingMetric] ||
      a.title.localeCompare(b.title) ||
      a.jobId.localeCompare(b.jobId),
  );
  const term = query.trim().toLocaleLowerCase();
  const filtered = ranked.filter((job) =>
    job.title.toLocaleLowerCase().includes(term),
  );
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / JOB_METRICS_PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, requestedPage));
  return {
    hasJobMetric,
    topJobs: hasJobMetric
      ? ranked.filter((job) => job[metric] > 0).slice(0, 6)
      : [],
    pageJobs: filtered.slice(
      (page - 1) * JOB_METRICS_PAGE_SIZE,
      page * JOB_METRICS_PAGE_SIZE,
    ),
    total,
    pages,
    page,
  };
}
