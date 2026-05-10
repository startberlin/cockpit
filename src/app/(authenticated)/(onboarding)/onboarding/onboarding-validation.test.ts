import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stepAddressDataSchema } from "./[step]/onboarding-validation";

describe("stepAddressDataSchema", () => {
  const validAddress = {
    street: "Hauptstraße 1",
    city: "Berlin",
    state: "Berlin",
    zip: "10115",
    country: "Germany",
  };

  it("accepts a valid address", () => {
    const result = stepAddressDataSchema.safeParse(validAddress);
    assert.equal(result.success, true);
  });

  it("accepts a blank state", () => {
    const result = stepAddressDataSchema.safeParse({
      ...validAddress,
      state: "",
    });
    assert.equal(result.success, true);
  });

  it("rejects an empty street", () => {
    const result = stepAddressDataSchema.safeParse({
      ...validAddress,
      street: "",
    });
    assert.equal(result.success, false);
  });

  it("rejects an empty city", () => {
    const result = stepAddressDataSchema.safeParse({
      ...validAddress,
      city: "",
    });
    assert.equal(result.success, false);
  });

  it("rejects an empty zip", () => {
    const result = stepAddressDataSchema.safeParse({
      ...validAddress,
      zip: "",
    });
    assert.equal(result.success, false);
  });

  it("rejects an empty country", () => {
    const result = stepAddressDataSchema.safeParse({
      ...validAddress,
      country: "",
    });
    assert.equal(result.success, false);
  });
});
