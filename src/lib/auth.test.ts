import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { user } from "@/db/schema/auth";
import { betterAuthUserAdditionalFields } from "@/db/schema/auth-fields";

describe("Better Auth user fields", () => {
  it("defines the expected set of server-owned additional fields", () => {
    assert.deepEqual(Object.keys(betterAuthUserAdditionalFields), [
      "firstName",
      "lastName",
      "street",
      "city",
      "state",
      "zip",
      "country",
      "phone",
      "personalEmail",
      "birthDate",
      "status",
      "legalMembershipState",
    ]);
  });

  it("marks server-owned additional fields as non-input", () => {
    for (const [fieldName, field] of Object.entries(
      betterAuthUserAdditionalFields,
    )) {
      assert.equal(
        field.input,
        false,
        `${fieldName} should not be accepted from Better Auth user input`,
      );
    }
  });

  it("only lists fields that exist on the user schema", () => {
    for (const fieldName of Object.keys(betterAuthUserAdditionalFields)) {
      assert.equal(
        fieldName in user,
        true,
        `${fieldName} should be a column on the Drizzle user table`,
      );
    }
  });

  it("does not define legacy roles on the user schema", () => {
    assert.equal("roles" in user, false);
    assert.equal("roles" in betterAuthUserAdditionalFields, false);
  });
});
