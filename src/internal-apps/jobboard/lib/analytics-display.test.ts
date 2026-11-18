import assert from "node:assert/strict";
import test from "node:test";
import { selectJobMetrics } from "./analytics-display";

const jobs = Array.from({ length: 33 }, (_, index) => ({
  jobId: `job-${index}`,
  title: `Engineer ${index}`,
  boardRequests: 0,
  widgetRequests: 0,
  jobViews: 33 - index,
  applyClicks: index,
  shareClicks: 0,
}));

test("large job sets have a six-job ranking for the selected metric", () => {
  const byViews = selectJobMetrics(jobs, "jobViews", "", 1);
  const byApply = selectJobMetrics(jobs, "applyClicks", "", 1);
  assert.deepEqual(
    byViews.topJobs.map((job) => job.jobId),
    ["job-0", "job-1", "job-2", "job-3", "job-4", "job-5"],
  );
  assert.deepEqual(
    byApply.topJobs.map((job) => job.jobId),
    ["job-32", "job-31", "job-30", "job-29", "job-28", "job-27"],
  );
  assert.equal(selectJobMetrics(jobs, "shareClicks", "", 1).topJobs.length, 0);
  assert.equal(jobs[0].jobId, "job-0");
});

test("all-job pages cover every job once with at most ten entries", () => {
  const results = [1, 2, 3, 4].map((page) =>
    selectJobMetrics(jobs, "jobViews", "", page),
  );
  assert.deepEqual(
    results.map((result) => result.pageJobs.length),
    [10, 10, 10, 3],
  );
  assert.equal(
    new Set(
      results.flatMap((result) => result.pageJobs.map((job) => job.jobId)),
    ).size,
    33,
  );
  assert.equal(results[0].total, 33);
  assert.equal(results[0].pages, 4);
  assert.equal(selectJobMetrics(jobs, "jobViews", "", 900).page, 4);
  assert.equal(selectJobMetrics(jobs, "jobViews", "", -10).page, 1);
});

test("search is normalized and a stale page clamps to available results", () => {
  const result = selectJobMetrics(jobs, "jobViews", "  eNGINEER 2  ", 4);
  assert.equal(result.total, 11);
  assert.equal(result.pages, 2);
  assert.equal(result.page, 2);
  assert.deepEqual(
    result.pageJobs.map((job) => job.jobId),
    ["job-29"],
  );
  const empty = selectJobMetrics(jobs, "jobViews", "No match", 4);
  assert.equal(empty.total, 0);
  assert.equal(empty.page, 1);
  assert.deepEqual(empty.pageJobs, []);
});

test("board and widget metrics cannot create per-job rankings", () => {
  for (const metric of ["boardRequests", "widgetRequests"] as const) {
    const result = selectJobMetrics(jobs, metric, "", 1);
    assert.equal(result.hasJobMetric, false);
    assert.deepEqual(result.topJobs, []);
    assert.equal(result.pageJobs.length, 10);
    assert.equal(result.total, 33);
  }
});
