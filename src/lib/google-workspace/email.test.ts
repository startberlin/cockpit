import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateCompanyEmail } from "./email";

describe("generateCompanyEmail", () => {
  it("generates start-berlin addresses from first and last name", () => {
    assert.equal(
      generateCompanyEmail("Ada", "Lovelace"),
      "ada.lovelace@start-berlin.com",
    );
  });

  it("normalizes German characters deterministically", () => {
    assert.equal(
      generateCompanyEmail("Jörg", "Müller"),
      "joerg.mueller@start-berlin.com",
    );
  });

  it("hyphenates multi-part names", () => {
    assert.equal(
      generateCompanyEmail("Mark Use", "Müller Schmidt"),
      "mark-use.muller-schmidt@start-berlin.com",
    );
  });
});
