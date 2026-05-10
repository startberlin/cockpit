import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applicationAddressSchema,
  applicationDeclarationsSchema,
} from "./[step]/application-validation";

describe("applicationDeclarationsSchema", () => {
  const allTrue = {
    naturalPerson: true as const,
    legalCapacity: true as const,
    supportsPurpose: true as const,
    acceptsBylaws: true as const,
    acceptsPrivacyNotice: true as const,
    acknowledgesFee: true as const,
  };

  it("accepts an all-true object", () => {
    const result = applicationDeclarationsSchema.safeParse(allTrue);
    assert.equal(result.success, true);
  });

  it("rejects when any field is false", () => {
    const result = applicationDeclarationsSchema.safeParse({
      ...allTrue,
      naturalPerson: false,
    });
    assert.equal(result.success, false);
  });

  it("rejects when a field is missing", () => {
    const { naturalPerson: _, ...withoutNaturalPerson } = allTrue;
    const result =
      applicationDeclarationsSchema.safeParse(withoutNaturalPerson);
    assert.equal(result.success, false);
  });

  it("rejects when a field is a string instead of literal true", () => {
    const result = applicationDeclarationsSchema.safeParse({
      ...allTrue,
      legalCapacity: "true",
    });
    assert.equal(result.success, false);
  });
});

describe("applicationAddressSchema", () => {
  const validAddress = {
    street: "Hauptstraße 1",
    city: "Berlin",
    state: "Berlin",
    zip: "10115",
    country: "Germany",
  };

  it("accepts a valid address", () => {
    const result = applicationAddressSchema.safeParse(validAddress);
    assert.equal(result.success, true);
  });

  it("accepts a blank state", () => {
    const result = applicationAddressSchema.safeParse({
      ...validAddress,
      state: "",
    });
    assert.equal(result.success, true);
  });

  it("rejects an empty street", () => {
    const result = applicationAddressSchema.safeParse({
      ...validAddress,
      street: "",
    });
    assert.equal(result.success, false);
    if (!result.success) {
      const streetErrors = result.error.issues.filter((i) =>
        i.path.includes("street"),
      );
      assert.ok(streetErrors.length > 0, "Expected street error");
    }
  });

  it("rejects an empty city", () => {
    const result = applicationAddressSchema.safeParse({
      ...validAddress,
      city: "",
    });
    assert.equal(result.success, false);
  });

  it("rejects an empty zip", () => {
    const result = applicationAddressSchema.safeParse({
      ...validAddress,
      zip: "",
    });
    assert.equal(result.success, false);
  });

  it("rejects an empty country", () => {
    const result = applicationAddressSchema.safeParse({
      ...validAddress,
      country: "",
    });
    assert.equal(result.success, false);
  });
});
