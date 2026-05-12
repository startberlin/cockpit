import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  importGoogleWorkspaceUserSchema,
  normalizeImportedDepartment,
} from "./import-google-user-schema";

const baseInput = {
  googleWorkspaceUserId: "google_123",
  firstName: "Ada",
  lastName: "Lovelace",
  batchNumber: 1,
  paidThroughDate: "",
};

describe("importGoogleWorkspaceUserSchema", () => {
  it("accepts member imports with a department", () => {
    const result = importGoogleWorkspaceUserSchema.safeParse({
      ...baseInput,
      status: "member",
      department: "operations",
    });

    assert.equal(result.success, true);
  });

  it("accepts member imports without a department", () => {
    const result = importGoogleWorkspaceUserSchema.safeParse({
      ...baseInput,
      status: "member",
    });

    assert.equal(result.success, true);
  });

  it("accepts supporting alumni imports without a department", () => {
    const result = importGoogleWorkspaceUserSchema.safeParse({
      ...baseInput,
      status: "supporting_alumni",
    });

    assert.equal(result.success, true);
  });

  it("accepts alumni imports without a department or paidThroughDate", () => {
    const result = importGoogleWorkspaceUserSchema.safeParse({
      ...baseInput,
      status: "alumni",
    });

    assert.equal(result.success, true);
  });

  it("accepts onboarding imports", () => {
    const result = importGoogleWorkspaceUserSchema.safeParse({
      ...baseInput,
      status: "onboarding",
    });

    assert.equal(result.success, true);
  });

  it("accepts a valid ISO paidThroughDate for member imports", () => {
    const result = importGoogleWorkspaceUserSchema.safeParse({
      ...baseInput,
      status: "member",
      department: "operations",
      paidThroughDate: "2026-12-31",
    });

    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.paidThroughDate, "2026-12-31");
    }
  });

  it("rejects invalid date strings for paidThroughDate", () => {
    const result = importGoogleWorkspaceUserSchema.safeParse({
      ...baseInput,
      status: "member",
      department: "operations",
      paidThroughDate: "not-a-date",
    });

    assert.equal(result.success, false);
  });
});

describe("normalizeImportedDepartment", () => {
  it("keeps the department for member imports", () => {
    assert.equal(
      normalizeImportedDepartment("member", "operations"),
      "operations",
    );
  });

  it("drops stale department values for supporting alumni imports", () => {
    assert.equal(
      normalizeImportedDepartment("supporting_alumni", "operations"),
      null,
    );
  });

  it("drops stale department values for alumni imports", () => {
    assert.equal(normalizeImportedDepartment("alumni", "operations"), null);
  });

  it("drops stale department values for onboarding imports", () => {
    assert.equal(normalizeImportedDepartment("onboarding", "operations"), null);
  });
});
