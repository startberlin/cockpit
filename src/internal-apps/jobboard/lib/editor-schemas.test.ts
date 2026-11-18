import assert from "node:assert/strict";
import test from "node:test";
import type { JobContent } from "./contracts";
import {
  editorValidationMessage,
  saveCompanySchema,
  saveJobSchema,
} from "./editor-schemas";

const company = {
  name: "Test company",
  website: "https://example.com",
  description: "",
  contacts: [],
};
const content: JobContent = {
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
  weeklyHours: null,
  internshipDurationMonths: null,
};

test("company creation needs no version, but updates require the version the editor loaded", () => {
  assert.equal(saveCompanySchema.safeParse(company).success, true);
  assert.equal(
    saveCompanySchema.safeParse({ ...company, id: "jbc_test" }).success,
    false,
  );
  const update = {
    ...company,
    id: "jbc_test",
    expectedUpdatedAt: "2026-09-29T12:00:00.000Z",
  };
  assert.equal(saveCompanySchema.safeParse(update).success, true);
  assert.equal(
    saveCompanySchema.safeParse({ ...update, updatedAt: new Date() }).success,
    false,
  );
});

test("draft updates cannot omit their version or supply a nonpositive version", () => {
  const job = { companyId: "jbc_test", content };
  assert.equal(saveJobSchema.safeParse(job).success, true);
  assert.equal(
    saveJobSchema.safeParse({ ...job, id: "jbj_test" }).success,
    false,
  );
  const update = { ...job, id: "jbj_test", expectedDraftVersion: 1 };
  assert.equal(saveJobSchema.safeParse(update).success, true);
  assert.equal(
    saveJobSchema.safeParse({ ...update, expectedDraftVersion: 0 }).success,
    false,
  );
  assert.equal(
    saveJobSchema.safeParse({ ...update, status: "published" }).success,
    false,
  );
});

test("draft editor gives actionable validation feedback for required fields", () => {
  const result = saveJobSchema.safeParse(
    { companyId: "", content: { ...content, description: "", locations: [] } },
    { error: editorValidationMessage },
  );
  assert.ok(!result.success);
  const messages = new Map(
    result.error.issues.map((issue) => [issue.path.join("."), issue.message]),
  );
  assert.equal(messages.get("companyId"), "Choose the company for this job.");
  assert.equal(
    messages.get("content.description"),
    "Enter at least 40 characters.",
  );
  assert.equal(messages.get("content.locations"), "Enter at least one value.");
});
