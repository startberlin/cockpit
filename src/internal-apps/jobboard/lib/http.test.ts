import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/node-postgres";
import { createJobboardService } from "../db/service";
import { createJobboardHttp, readBoundedJson } from "./http";

const keys = {
  read: "r".repeat(40),
  submit: "s".repeat(40),
  metrics: "m".repeat(40),
};
const base = "http://localhost/api/jobboard/v1";

function fixture() {
  let calls = 0;
  const service = {
    async listPublicJobs() {
      calls++;
      return { jobs: [], nextCursor: null };
    },
    async getPublishedCompanyWebsite(): Promise<string | null> {
      calls++;
      return null;
    },
    async getPublicJob() {
      calls++;
      return null;
    },
    async submitJob() {
      calls++;
      return { id: "jbs_test", status: "pending_review" as const };
    },
    async recordMetrics() {
      calls++;
      return { accepted: 0 };
    },
    async consumeServiceBudget() {
      calls++;
    },
  };
  return {
    service,
    api: createJobboardHttp(service, () => keys),
    calls: () => calls,
  };
}

test("unauthenticated and cross-scope requests never reach the database", async () => {
  const { api, calls } = fixture();
  assert.equal((await api.jobs(new Request(`${base}/jobs`))).status, 401);
  assert.equal(
    (
      await api.jobs(
        new Request(`${base}/jobs`, {
          headers: { authorization: `Bearer ${keys.submit}` },
        }),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await api.submissions(
        new Request(`${base}/submissions`, {
          method: "POST",
          headers: { authorization: `Bearer ${keys.read}` },
        }),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await api.metrics(
        new Request(`${base}/metrics`, {
          method: "POST",
          headers: { authorization: `Bearer ${keys.submit}` },
        }),
      )
    ).status,
    401,
  );
  assert.equal(calls(), 0);
});

test("read responses are versioned and never browser-cacheable", async () => {
  const { api } = fixture();
  const response = await api.jobs(
    new Request(`${base}/jobs`, {
      headers: { authorization: `Bearer ${keys.read}` },
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    version: "1",
    jobs: [],
    nextCursor: null,
  });
});

test("public queries reject unbounded limits, unknown or repeated parameters", async () => {
  const { api, calls } = fixture();
  for (const query of [
    "limit=101",
    "limit=0",
    "includePrivate=true",
    "cursor=a&cursor=b",
    "employmentType=anything",
  ]) {
    const response = await api.jobs(
      new Request(`${base}/jobs?${query}`, {
        headers: { authorization: `Bearer ${keys.read}` },
      }),
    );
    assert.ok([400, 422].includes(response.status));
  }
  assert.equal(calls(), 0);
});

test("unpublished and malformed job identifiers have a safe missing response", async () => {
  const { api } = fixture();
  const request = new Request(`${base}/jobs/missing`, {
    headers: { authorization: `Bearer ${keys.read}` },
  });
  assert.equal((await api.job(request, "jbj_missing")).status, 404);
  assert.equal((await api.job(request, "../../../private")).status, 404);
});

test("JSON body limits are enforced even without Content-Length", async () => {
  const cases: Record<string, string>[] = [
    { "content-type": "application/json" },
    { "content-type": "application/json", "content-length": "2" },
  ];
  for (const headers of cases) {
    const request = new Request(`${base}/submissions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ value: "x".repeat(65_536) }),
    });
    await assert.rejects(
      readBoundedJson(request),
      (error: unknown) =>
        error instanceof Error && "status" in error && error.status === 413,
    );
  }
});

test("unsupported media and malformed JSON fail before any service mutation", async () => {
  const { api, calls } = fixture();
  const headers = { authorization: `Bearer ${keys.submit}` };
  assert.equal(
    (
      await api.submissions(
        new Request(`${base}/submissions`, {
          method: "POST",
          headers,
          body: "{}",
        }),
      )
    ).status,
    415,
  );
  assert.equal(
    (
      await api.submissions(
        new Request(`${base}/submissions`, {
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
          body: "{",
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await api.submissions(
        new Request(`${base}/submissions`, {
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify({ publish: true }),
        }),
      )
    ).status,
    422,
  );
  assert.equal(calls(), 0);
});

test("unknown database errors do not reveal SQL, credentials, or private values", async () => {
  const { service } = fixture();
  service.listPublicJobs = async () => {
    throw new Error("postgres password=secret contacts.private@example.com");
  };
  const api = createJobboardHttp(service, () => keys);
  const response = await api.jobs(
    new Request(`${base}/jobs`, {
      headers: { authorization: `Bearer ${keys.read}` },
    }),
  );
  assert.equal(response.status, 500);
  assert.doesNotMatch(await response.text(), /secret|postgres|contacts/);
});

test("the icon API checks the read credential and active listing before loading its company icon", async () => {
  const { api, service, calls } = fixture();
  const unused = async () => assert.fail("provider must not be called");
  const request = (token: string) =>
    new Request(`${base}/jobs/test/favicon`, {
      headers: { authorization: `Bearer ${token}` },
    });
  assert.equal(
    (await api.favicon(request(keys.submit), "test", unused)).status,
    401,
  );
  assert.equal(calls(), 0);
  assert.equal(
    (await api.favicon(request(keys.read), "test", unused)).status,
    404,
  );
  assert.equal(calls(), 1);
  service.getPublishedCompanyWebsite = async () =>
    "https://example.edu/careers";
  let host = "";
  const response = await api.favicon(
    request(keys.read),
    "test",
    async (value) => {
      host = value;
      return null;
    },
  );
  assert.equal(host, "example.edu");
  assert.equal(response.status, 404);
});

test("rate-limited writes report whole seconds until the shared minute resets", async () => {
  let now = new Date("2032-01-01T00:00:41.250Z");
  const budget = createJobboardService(drizzle.mock(), () => now);
  const { service } = fixture();
  // An oversized batch follows the same rate-limit error path without a database.
  service.consumeServiceBudget = () =>
    budget.consumeServiceBudget("metrics", 6001);
  const api = createJobboardHttp(service, () => keys);
  const request = () =>
    new Request(`${base}/metrics`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${keys.metrics}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        events: [
          {
            eventId: "190eb33b-d0ad-45bb-89cd-d2212f15cc38",
            occurredAt: now.toISOString(),
            type: "board_request",
            jobId: null,
            surface: "standalone",
            source: "direct",
          },
        ],
      }),
    });
  for (const [time, seconds] of [
    ["00:00:41.250", "19"],
    ["00:00:59.999", "1"],
    ["00:01:00.000", "60"],
  ]) {
    now = new Date(`2032-01-01T${time}Z`);
    const response = await api.metrics(request());
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("Retry-After"), seconds);
    assert.equal((await response.json()).error.code, "rate_limited");
  }
});
