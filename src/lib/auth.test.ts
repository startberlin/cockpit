import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { betterAuthUserAdditionalFields } from "@/db/schema/auth-fields";

describe("Better Auth user fields", () => {
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
});
