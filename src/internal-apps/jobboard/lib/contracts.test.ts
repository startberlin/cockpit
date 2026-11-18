import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isSafePublicUrl,
  jobContentSchema,
  metricEventSchema,
  publicCompanySchema,
  publicJobSchema,
  submissionInputSchema,
} from "./contracts";

export const sampleJob = {
  title: "Founding Product Engineer",
  description:
    "Work with a small team building useful software. Own product decisions and deliver thoughtful customer experiences.",
  employmentType: "full_time" as const,
  seniority: "mid" as const,
  locations: ["Berlin"],
  countryCodes: ["DE"],
  remoteMode: "hybrid" as const,
  languages: ["English"],
  applyUrl: "https://example.com/careers/engineer",
  salaryStatus: "disclosed" as const,
  salaryMin: 65000,
  salaryMax: 85000,
  salaryCurrency: "EUR",
  salaryPeriod: "year" as const,
  weeklyHours: 40,
  internshipDurationMonths: null,
};

describe("Jobboard public contract", () => {
  it("rejects private destinations and executable URL schemes", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,test",
      "https://user:secret@example.com/",
      "http://localhost/",
      "http://127.0.0.1/",
      "http://2130706433/",
      "http://[::1]/",
      "http://service.internal/",
      "https://example.com\n/path",
    ])
      assert.equal(isSafePublicUrl(url), false, url);
    assert.equal(
      isSafePublicUrl("https://jobs.example.org/a?department=engineering"),
      true,
    );
  });
  it("distinguishes undisclosed and unpaid from a disclosed amount", () => {
    assert.equal(jobContentSchema.safeParse(sampleJob).success, true);
    assert.equal(
      jobContentSchema.safeParse({ ...sampleJob, salaryMax: 100 }).success,
      false,
    );
    assert.equal(
      jobContentSchema.safeParse({ ...sampleJob, salaryStatus: "unpaid" })
        .success,
      false,
    );
    assert.equal(
      jobContentSchema.safeParse({
        ...sampleJob,
        salaryStatus: "unpaid",
        salaryMin: null,
        salaryMax: null,
      }).success,
      true,
    );
    assert.equal(
      jobContentSchema.safeParse({
        ...sampleJob,
        salaryStatus: "not_disclosed",
        salaryMin: null,
        salaryMax: null,
      }).success,
      true,
    );
  });
  it("rejects internal properties in public company and job responses", () => {
    const company = {
      id: "jbc_fixture",
      name: "Example",
      website: "https://example.com",
      description: "A sample partner.",
    };
    assert.equal(
      publicCompanySchema.safeParse({ ...company, notes: "private" }).success,
      false,
    );
    const job = {
      id: "jbj_fixture",
      slug: "product-engineer",
      company,
      content: sampleJob,
      status: "active",
      publishedAt: "2026-09-14T10:00:00.000Z",
      expiresAt: "2026-11-13T10:00:00.000Z",
    };
    assert.equal(publicJobSchema.safeParse(job).success, true);
    assert.equal(
      publicJobSchema.safeParse({ ...job, reviewNotes: "private" }).success,
      false,
    );
  });
  it("requires permission to publish for external submissions", () => {
    const input = {
      requestId: "b60c3f30-0610-4cff-b741-8ee19f2e1ad5",
      company: {
        name: "Example",
        website: "https://example.com",
        description: "Example partner",
      },
      contact: {
        name: "Hiring team",
        email: "hiring@example.com",
        role: "",
        phone: "",
        notes: "",
      },
      job: sampleJob,
      permissionToPublish: true,
    };
    assert.equal(submissionInputSchema.safeParse(input).success, true);
    assert.equal(
      submissionInputSchema.safeParse({ ...input, permissionToPublish: false })
        .success,
      false,
    );
    assert.equal(
      submissionInputSchema.safeParse({ ...input, status: "published" })
        .success,
      false,
    );
  });
  it("restricts analytics to explicit anonymous dimensions", () => {
    const event = {
      eventId: "b60c3f30-0610-4cff-b741-8ee19f2e1ad5",
      occurredAt: "2026-09-14T10:00:00.000Z",
      type: "apply_redirect",
      jobId: "jbj_fixture",
      surface: "standalone",
      source: "website",
    };
    assert.equal(metricEventSchema.safeParse(event).success, true);
    for (const field of ["email", "ip", "userId", "referrer", "searchText"])
      assert.equal(
        metricEventSchema.safeParse({ ...event, [field]: "private" }).success,
        false,
      );
    assert.equal(
      metricEventSchema.safeParse({ ...event, jobId: null }).success,
      false,
    );
    assert.equal(
      metricEventSchema.safeParse({ ...event, source: "subscriber-123" })
        .success,
      false,
    );
  });
});
