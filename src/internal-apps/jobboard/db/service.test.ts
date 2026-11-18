import assert from "node:assert/strict";
import test from "node:test";
import type { PublicJob } from "../lib/contracts";
import {
  aggregateRetentionCutoff,
  effectiveJobStatus,
  publicSnapshot,
} from "./service";

const now = new Date("2026-09-14T12:00:00.000Z");

test("aggregate retention clamps the 13-month cutoff at the end of February", () => {
  assert.equal(
    aggregateRetentionCutoff(new Date("2026-03-31T12:00:00Z")),
    "2025-02-28",
  );
  assert.equal(
    aggregateRetentionCutoff(new Date("2025-03-31T12:00:00Z")),
    "2024-02-29",
  );
});

test("aggregate retention follows the UTC day across year and timezone boundaries", () => {
  assert.equal(
    aggregateRetentionCutoff(new Date("2026-01-31T12:00:00Z")),
    "2024-12-31",
  );
  assert.equal(
    aggregateRetentionCutoff(new Date("2026-03-31T23:30:00-07:00")),
    "2025-03-01",
  );
});
const snapshot: PublicJob = {
  id: "jbj_public",
  slug: "engineer-jbjpublic",
  status: "active",
  publishedAt: "2026-09-01T12:00:00.000Z",
  expiresAt: "2026-11-01T12:00:00.000Z",
  company: {
    id: "jbc_public",
    name: "Public Company",
    website: "https://example.com",
    description: "Approved company profile.",
  },
  content: {
    title: "Software Engineer",
    description: "Build useful software with our small engineering team.",
    employmentType: "full_time",
    seniority: "all",
    locations: ["Berlin"],
    countryCodes: ["DE"],
    remoteMode: "hybrid",
    languages: ["English"],
    applyUrl: "https://example.com/apply",
    salaryStatus: "not_disclosed",
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: "EUR",
    salaryPeriod: "year",
    weeklyHours: 40,
    internshipDurationMonths: null,
  },
};

test("expiry is enforced at read time without requiring cron execution", () => {
  assert.equal(effectiveJobStatus("published", now, now), "expired");
  assert.equal(
    effectiveJobStatus("published", new Date(now.getTime() + 1), now),
    "published",
  );
  assert.equal(effectiveJobStatus("published", null, now), "expired");
  assert.equal(effectiveJobStatus("paused", now, now), "paused");
});

test("closed public representations retain only the previously approved snapshot", () => {
  const result = publicSnapshot(
    {
      published: snapshot,
      status: "paused",
      expiresAt: new Date(snapshot.expiresAt),
    },
    now,
  );
  assert.equal(result?.status, "closed");
  assert.equal(result?.content.title, snapshot.content.title);
  assert.equal(snapshot.status, "active");
  assert.equal(
    publicSnapshot({ published: null, status: "draft", expiresAt: null }, now),
    null,
  );
});

test("public projection strips private company columns even from a contaminated stored value", () => {
  const contaminated = {
    ...snapshot,
    company: {
      ...snapshot.company,
      contacts: [{ email: "private@example.com" }],
      notes: "private",
      terms: "private",
    },
    internalNotes: "private",
  };
  const result = publicSnapshot(
    {
      published: contaminated,
      status: "published",
      expiresAt: new Date(snapshot.expiresAt),
    },
    now,
  );
  assert.deepEqual(Object.keys(result ?? {}).sort(), [
    "company",
    "content",
    "expiresAt",
    "id",
    "publishedAt",
    "slug",
    "status",
  ]);
  assert.deepEqual(Object.keys(result?.company ?? {}).sort(), [
    "description",
    "id",
    "name",
    "website",
  ]);
  assert.doesNotMatch(JSON.stringify(result), /private/);
});
