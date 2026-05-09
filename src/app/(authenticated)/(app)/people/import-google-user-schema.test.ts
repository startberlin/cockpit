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
  paidThroughAt: "",
};

describe("importGoogleWorkspaceUserSchema", () => {
  it("accepts member imports with a department and documentsVerified", () => {
    const result = importGoogleWorkspaceUserSchema.safeParse({
      ...baseInput,
      status: "member",
      department: "operations",
      documentsVerified: true,
    });

    assert.equal(result.success, true);
  });

  it("accepts member imports with documentsVerified false (starts admission)", () => {
    const result = importGoogleWorkspaceUserSchema.safeParse({
      ...baseInput,
      status: "member",
      department: "operations",
      documentsVerified: false,
    });

    assert.equal(result.success, true);
  });

  it("rejects member imports without a department", () => {
    const result = importGoogleWorkspaceUserSchema.safeParse({
      ...baseInput,
      status: "member",
      documentsVerified: true,
    });

    assert.equal(result.success, false);
  });

  it("rejects member imports without documentsVerified", () => {
    const result = importGoogleWorkspaceUserSchema.safeParse({
      ...baseInput,
      status: "member",
      department: "operations",
    });

    assert.equal(result.success, false);
  });

  it("accepts supporting alumni imports without a department when documentsVerified is set", () => {
    const result = importGoogleWorkspaceUserSchema.safeParse({
      ...baseInput,
      status: "supporting_alumni",
      documentsVerified: false,
    });

    assert.equal(result.success, true);
  });

  it("rejects supporting alumni imports without documentsVerified", () => {
    const result = importGoogleWorkspaceUserSchema.safeParse({
      ...baseInput,
      status: "supporting_alumni",
    });

    assert.equal(result.success, false);
  });

  it("accepts alumni imports without a department or documentsVerified", () => {
    const result = importGoogleWorkspaceUserSchema.safeParse({
      ...baseInput,
      status: "alumni",
    });

    assert.equal(result.success, true);
  });

  it("accepts onboarding imports without a department or documentsVerified", () => {
    const result = importGoogleWorkspaceUserSchema.safeParse({
      ...baseInput,
      status: "onboarding",
      department: "operations",
      documentsVerified: true,
    });

    assert.equal(result.success, true);
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
