import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { JobContent } from "../lib/contracts";
import { JobPreview } from "./job-preview";

const content: JobContent = {
  title: "Network role",
  description: "A role with <script>alert('x')</script> in employer text.",
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
  weeklyHours: null,
  internshipDurationMonths: null,
};

test("employer text is escaped rather than rendered as markup", () => {
  const html = renderToStaticMarkup(
    <JobPreview content={content} company="<img src=x>" />,
  );
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&lt;img src=x&gt;"));
  assert.ok(!html.includes("<script>"));
});

test("unsaved invalid application URLs do not become clickable preview links", () => {
  for (const applyUrl of [
    "javascript:alert(1)",
    "https://localhost/admin",
    "https://user:password@example.com",
    "",
  ]) {
    const html = renderToStaticMarkup(
      <JobPreview content={{ ...content, applyUrl }} company="Example" />,
    );
    assert.ok(!html.includes("href="));
  }
  const html = renderToStaticMarkup(
    <JobPreview content={content} company="Example" />,
  );
  assert.ok(html.includes('href="https://example.com/apply"'));
  assert.ok(html.includes('rel="noopener noreferrer"'));
});

test("the preview distinguishes undisclosed compensation from an unpaid role", () => {
  const undisclosed = renderToStaticMarkup(
    <JobPreview content={content} company="Example" />,
  );
  const unpaid = renderToStaticMarkup(
    <JobPreview
      content={{ ...content, salaryStatus: "unpaid" }}
      company="Example"
    />,
  );
  assert.ok(undisclosed.includes("Not disclosed"));
  assert.ok(!undisclosed.includes(">Unpaid<"));
  assert.ok(unpaid.includes(">Unpaid<"));
});

test("incomplete live drafts use placeholders instead of undefined salary values", () => {
  const html = renderToStaticMarkup(
    <JobPreview
      content={{
        ...content,
        title: "",
        description: "",
        locations: [],
        countryCodes: [],
        languages: [],
        salaryStatus: "disclosed",
      }}
      company=""
    />,
  );
  assert.ok(html.includes("Job title"));
  assert.ok(html.includes("Company name"));
  assert.ok(html.includes("Add a salary amount"));
  assert.ok(!html.includes("undefined"));
  assert.ok(!html.includes("NaN"));
});

test("company preview fields preserve escaping and URL safety", () => {
  const html = renderToStaticMarkup(
    <JobPreview
      content={{ ...content, applyUrl: "" }}
      company="Employer"
      companyDescription="<img src=x onerror=alert(1)>"
      companyWebsite="javascript:alert(1)"
    />,
  );
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes("<img"));
  assert.ok(!html.includes("href="));
});

test("irrelevant internship duration is omitted and international currency is preserved", () => {
  const html = renderToStaticMarkup(
    <JobPreview
      content={{
        ...content,
        employmentType: "full_time",
        internshipDurationMonths: 6,
        salaryStatus: "disclosed",
        salaryCurrency: "PLN",
        salaryMin: 10000,
        salaryMax: 15000,
        salaryPeriod: "month",
      }}
      company="Employer"
    />,
  );
  assert.ok(!html.includes("Internship duration"));
  assert.ok(html.includes("PLN 10,000 to 15,000 / month"));
});
