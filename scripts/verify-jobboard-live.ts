import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  jobboardAudit,
  jobboardCompany,
  jobboardJob,
  jobboardMetricDaily,
  jobboardMetricReceipt,
  jobboardRevision,
  jobboardSubmission,
} from "../src/internal-apps/jobboard/db/schema";
import { createJobboardService } from "../src/internal-apps/jobboard/db/service";
import { addJobboardUtmParameters } from "../src/internal-apps/jobboard/lib/application-url";
import {
  jobContentSchema,
  type SubmissionInput,
} from "../src/internal-apps/jobboard/lib/contracts";

const database = new URL(process.env.JOBBOARD_TEST_DATABASE_URL ?? "");
const publicOrigin = new URL(
  process.env.JOBBOARD_PUBLIC_URL ?? "http://localhost:3012",
);
const cockpitOrigin = new URL(
  process.env.BETTER_AUTH_URL ?? "http://localhost:3011",
);
for (const url of [database, publicOrigin, cockpitOrigin]) {
  if (!["localhost", "127.0.0.1"].includes(url.hostname))
    throw new Error("Live verification only runs against localhost.");
}
if (database.pathname !== "/jobboard_test")
  throw new Error("Use the isolated jobboard_test database.");
const pool = new Pool({ connectionString: database.href, max: 2 });
const db = drizzle(pool);
const service = createJobboardService(db);
const actor = { id: null, name: "Local HTTP verification" };
const headers = {
  accept: "text/html",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36",
};
let companyId = "";
let jobId = "";
let submissionId = "";
let eventId = "";
let checks = 0;
function check(condition: unknown, message: string): asserts condition {
  assert.ok(condition, message);
  checks++;
}

async function main() {
  const company = await service.saveCompany(
    {
      name: `HTTP QA ${randomUUID().slice(0, 8)}`,
      website: "https://example.com",
      description: "Fictional local verification company.",
      contacts: [
        {
          name: "Private QA",
          email: "private-qa@example.test",
          role: "Hiring",
          phone: "",
          notes: "PRIVATE_HTTP_CONTACT",
        },
      ],
      notes: "PRIVATE_HTTP_NOTE",
      terms: "PRIVATE_HTTP_TERMS",
    },
    actor,
  );
  companyId = company.id;
  const content = jobContentSchema.parse({
    title: "HTTP Verification Engineer",
    description:
      "A fictional role used only to verify local jobboard behaviour. This is not a real vacancy.",
    employmentType: "full_time",
    seniority: "mid",
    locations: ["Berlin"],
    countryCodes: ["DE"],
    remoteMode: "hybrid",
    languages: ["English"],
    applyUrl: addJobboardUtmParameters(
      "https://example.com/apply?ats_ref=test%20ref&utm_source=partner#application",
    ),
    salaryStatus: "not_disclosed",
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: "EUR",
    salaryPeriod: "year",
    weeklyHours: 40,
    internshipDurationMonths: null,
  });
  let job = await service.saveJob(
    { companyId, content, notes: "PRIVATE_HTTP_JOB" },
    actor,
  );
  jobId = job.id;
  const readHeaders = {
    authorization: `Bearer ${process.env.JOBBOARD_READ_API_KEY}`,
  };
  const privateResponse = await fetch(
    new URL(`/api/jobboard/v1/jobs/${jobId}`, cockpitOrigin),
    { headers: readHeaders },
  );
  check(
    privateResponse.status === 404,
    "Drafts must not be publicly readable.",
  );
  job = await service.publishJob(
    {
      id: jobId,
      reviewToken: job.reviewToken,
      reviewed: true,
      reviewNotes:
        "Local HTTP test: reviewed fictional job and public company details.",
      expiresAt: new Date(Date.now() + 60 * 86_400_000).toISOString(),
    },
    actor,
  );
  const path = `/jobs/${jobId}/${job.published?.slug}`;
  const detail = await fetch(new URL(path, publicOrigin), { headers });
  const html = await detail.text();
  check(detail.ok, "Public job detail must load.");
  check(
    html.includes(content.title),
    "Public detail contains the approved title.",
  );
  check(
    !/PRIVATE_HTTP_|private-qa@example/.test(html),
    "Private contact and notes must not leak to HTML.",
  );
  check(
    !detail.headers.has("set-cookie"),
    "Public detail must not set a cookie.",
  );
  check(
    html.includes("application/ld+json") && html.includes("JobPosting"),
    "Active eligible role has JobPosting markup.",
  );

  await service.saveJob(
    {
      id: jobId,
      expectedDraftVersion: job.draftVersion,
      companyId,
      content: { ...content, title: "UNAPPROVED_HTTP_TITLE" },
      notes: "PRIVATE_HTTP_JOB",
    },
    actor,
  );
  const unchanged = await (
    await fetch(new URL(path, publicOrigin), { headers })
  ).text();
  check(
    unchanged.includes(content.title) &&
      !unchanged.includes("UNAPPROVED_HTTP_TITLE"),
    "Saving a draft must not change public content.",
  );
  const apply = await fetch(
    new URL(`/apply/${jobId}?source=website`, publicOrigin),
    { headers, redirect: "manual" },
  );
  check(
    apply.status === 303 && apply.headers.get("location") === content.applyUrl,
    "Active apply preserves the approved UTM values, ATS parameters and fragment.",
  );
  check(!apply.headers.has("set-cookie"), "Apply must not set a cookie.");
  const share = await fetch(new URL(`/share/${jobId}/whatsapp`, publicOrigin), {
    headers,
    redirect: "manual",
  });
  check(
    share.status === 303 &&
      new URL(share.headers.get("location") ?? "").hostname === "wa.me",
    "WhatsApp sharing uses its fixed destination.",
  );

  const submission: SubmissionInput = {
    requestId: randomUUID(),
    company: {
      name: company.name,
      website: company.website,
      description: company.description,
    },
    contact: {
      name: "QA contact",
      email: "qa@example.test",
      role: "Hiring",
      phone: "",
      notes: "",
    },
    job: content,
    permissionToPublish: true,
  };
  const submit = async (origin: string) =>
    fetch(new URL("/api/submissions", publicOrigin), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin,
        "sec-fetch-site": "same-origin",
      },
      body: JSON.stringify(submission),
    });
  check(
    (await submit("https://unrelated.example")).status === 403,
    "Foreign-origin submissions are rejected.",
  );
  const received = await submit(publicOrigin.origin);
  check(received.status === 202, "Employer submission is accepted for review.");
  const receipt = await received.json();
  submissionId = receipt.id;
  const retry = await submit(publicOrigin.origin);
  check(
    retry.status === 202 && (await retry.json()).id === submissionId,
    "Submission retry retains the original receipt.",
  );
  const pending = (await service.listSubmissions()).find(
    (entry) => entry.id === submissionId,
  );
  check(
    pending?.status === "pending_review" && !pending.jobId,
    "Public submissions never publish automatically.",
  );

  eventId = randomUUID();
  const event = {
    eventId,
    occurredAt: new Date().toISOString(),
    type: "detail_request",
    jobId,
    surface: "standalone",
    source: "unknown",
  };
  const metrics = () =>
    fetch(new URL("/api/jobboard/v1/metrics", cockpitOrigin), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.JOBBOARD_METRICS_API_KEY}`,
      },
      body: JSON.stringify({ events: [event] }),
    });
  const first = await metrics();
  const second = await metrics();
  check(
    first.status === 202 && (await first.json()).accepted === 1,
    "First metrics event is counted.",
  );
  check(
    second.status === 202 && (await second.json()).accepted === 0,
    "Metrics retry is not counted twice.",
  );

  await service.setJobStatus(jobId, "paused", actor);
  const paused = await fetch(new URL(path, publicOrigin), { headers });
  check(
    paused.status === 404 && !(await paused.text()).includes(content.title),
    "A paused listing is hidden even at the original public URL.",
  );
  await service.setJobStatus(jobId, "closed", actor);
  const closed = await fetch(new URL(path, publicOrigin), { headers });
  const closedHtml = await closed.text();
  check(
    closed.ok && closedHtml.includes(content.title),
    "Existing URLs retain the closed approved description.",
  );
  check(
    !closedHtml.includes('"@type":"JobPosting"'),
    "Closed roles do not advertise active JobPosting markup.",
  );
  const blocked = await fetch(new URL(`/apply/${jobId}`, publicOrigin), {
    headers,
    redirect: "manual",
  });
  check(
    blocked.headers.get("location") !== content.applyUrl,
    "Closed role cannot redirect to employer application.",
  );
  const listing = await fetch(new URL("/", publicOrigin), { headers });
  check(
    !(await listing.text()).includes(content.title),
    "Inactive role is absent from the public board.",
  );
  const widget = await fetch(new URL("/embed/jobs", publicOrigin), { headers });
  check(
    widget.ok && widget.headers.get("x-robots-tag")?.includes("noindex"),
    "Widget is available and excluded from indexing.",
  );
  check(!widget.headers.has("set-cookie"), "Widget must not set a cookie.");
  check(
    widget.headers.get("content-security-policy")?.includes("frame-ancestors"),
    "Widget has an explicit embedding boundary.",
  );
  console.log(
    `${checks} live checks passed against both applications. No external application or share destination was followed.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await delay(2500);
    if (submissionId) {
      await db
        .delete(jobboardSubmission)
        .where(eq(jobboardSubmission.id, submissionId));
      await db
        .delete(jobboardAudit)
        .where(eq(jobboardAudit.entityId, submissionId));
    }
    if (jobId) {
      await db
        .delete(jobboardRevision)
        .where(eq(jobboardRevision.jobId, jobId));
      await db.delete(jobboardAudit).where(eq(jobboardAudit.entityId, jobId));
      await db
        .delete(jobboardMetricDaily)
        .where(eq(jobboardMetricDaily.jobId, jobId));
      await db.delete(jobboardJob).where(eq(jobboardJob.id, jobId));
    }
    if (companyId) {
      await db.delete(jobboardCompany).where(eq(jobboardCompany.id, companyId));
      await db
        .delete(jobboardAudit)
        .where(eq(jobboardAudit.entityId, companyId));
    }
    if (eventId)
      await db
        .delete(jobboardMetricReceipt)
        .where(eq(jobboardMetricReceipt.eventId, eventId));
    await pool.end();
  });
