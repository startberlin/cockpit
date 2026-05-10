import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stepMasterDataSchema } from "./[step]/onboarding-validation";

describe("stepMasterDataSchema", () => {
  const valid = {
    personalEmail: "ada@example.com",
    phone: "+491234567890",
    birthDate: "1990-01-15",
  };

  it("accepts valid data", () => {
    assert.equal(stepMasterDataSchema.safeParse(valid).success, true);
  });

  it("rejects an invalid email", () => {
    assert.equal(
      stepMasterDataSchema.safeParse({
        ...valid,
        personalEmail: "not-an-email",
      }).success,
      false,
    );
  });

  it("rejects an invalid phone number", () => {
    assert.equal(
      stepMasterDataSchema.safeParse({ ...valid, phone: "12345" }).success,
      false,
    );
  });

  it("rejects a missing birthDate", () => {
    assert.equal(
      stepMasterDataSchema.safeParse({ ...valid, birthDate: "" }).success,
      false,
    );
  });

  it("rejects an invalid birthDate format", () => {
    assert.equal(
      stepMasterDataSchema.safeParse({ ...valid, birthDate: "15-01-1990" })
        .success,
      false,
    );
  });
});
