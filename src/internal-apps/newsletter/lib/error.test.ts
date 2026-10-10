import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseError } from "./error";

describe("action error messages", () => {
  it("reads both hook callback and unwrapped server errors", () => {
    assert.equal(
      parseError({ error: { serverError: "Access denied" } }),
      "Access denied",
    );
    assert.equal(parseError({ serverError: "Access denied" }), "Access denied");
  });
  it("finds nested field validation messages", () => {
    assert.equal(
      parseError({
        validationErrors: { recipients: { _errors: ["Enter a valid email"] } },
      }),
      "Enter a valid email",
    );
    assert.equal(
      parseError({
        error: {
          validationErrors: {
            _errors: [],
            blocks: { 0: { title: { _errors: ["Title required"] } } },
          },
        },
      }),
      "Title required",
    );
  });
  it("handles bound arguments and regular errors", () => {
    assert.equal(
      parseError({ bindArgsValidationErrors: [{ _errors: ["Missing id"] }] }),
      "Missing id",
    );
    assert.equal(parseError(new Error("Offline")), "Offline");
  });
  it("never shows serialized objects or missing values to the user", () => {
    for (const value of [{}, undefined, null, "", { message: {} }]) {
      assert.equal(
        parseError(value),
        "Something went wrong. Please try again.",
      );
    }
  });
});
