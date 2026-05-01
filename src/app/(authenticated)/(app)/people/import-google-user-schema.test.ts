import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  importGoogleWorkspaceUserSchema,
  normalizeImportedDepartment,
} from "./import-google-user-schema";

const baseInput = {
  googleWorkspaceId: "google_123",
  firstName: "Ada",
  lastName: "Lovelace",
  batchNumber: 1,
  paidThroughAt: "",
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

  it("rejects member imports without a department", () => {
    const result = importGoogleWorkspaceUserSchema.safeParse({
      ...baseInput,
      status: "member",
    });

    assert.equal(result.success, false);
  });

  it("accepts supporting alumni imports without a department", () => {
    const result = importGoogleWorkspaceUserSchema.safeParse({
      ...baseInput,
      status: "supporting_alumni",
    });

    assert.equal(result.success, true);
  });

  it("accepts alumni imports without a department", () => {
    const result = importGoogleWorkspaceUserSchema.safeParse({
      ...baseInput,
      status: "alumni",
    });

    assert.equal(result.success, true);
  });

  it("rejects onboarding status for imports", () => {
    const result = importGoogleWorkspaceUserSchema.safeParse({
      ...baseInput,
      status: "onboarding",
      department: "operations",
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
});
