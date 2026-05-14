import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  billingDetailFromMembershipInput,
  membershipFlowIdempotencyKey,
  membershipFlowMetadata,
  membershipSubscriptionStartDate,
  prefilledCustomerFromMembershipInput,
  subscriptionIdempotencyKey,
} from "./membership-flow-helpers";
import type { MembershipFlowInput } from "./types";

const input: MembershipFlowInput = {
  userId: "usr_123",
  email: "member@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  address: {
    street: "1 Infinite Loop",
    city: "Berlin",
    zip: "10115",
    country: "Germany",
  },
  returnUrl: "https://cockpit.example.com/membership/payment-return",
  exitUrl: "https://cockpit.example.com/membership",
  localSessionId: "mps_123",
};

describe("membership GoCardless flow helpers", () => {
  it("builds stable idempotency keys from user and local session", () => {
    assert.equal(
      membershipFlowIdempotencyKey("usr_123", "mps_123"),
      "membership-payment:usr_123:mps_123",
    );
  });

  it("builds subscription metadata for webhook correlation", () => {
    assert.deepEqual(membershipFlowMetadata(input), {
      start_cockpit_session: "mps_123",
      start_cockpit_user_email: "member@example.com",
      start_cockpit_user_id: "usr_123",
    });
  });

  it("builds prefilled customer details for billing request flows", () => {
    assert.deepEqual(prefilledCustomerFromMembershipInput(input), {
      given_name: "Ada",
      family_name: "Lovelace",
      email: "member@example.com",
      address_line1: "1 Infinite Loop",
      city: "Berlin",
      postal_code: "10115",
      country_code: "DE",
    });
  });

  it("builds billing detail for collectCustomerDetails including region", () => {
    const inputWithState = {
      ...input,
      address: { ...input.address, state: "BE" },
    };
    assert.deepEqual(billingDetailFromMembershipInput(inputWithState), {
      address_line1: "1 Infinite Loop",
      city: "Berlin",
      region: "BE",
      postal_code: "10115",
      country_code: "DE",
    });
  });

  it("omits empty values from billing detail", () => {
    const sparse = { ...input, address: { country: "Germany" } };
    assert.deepEqual(billingDetailFromMembershipInput(sparse), {
      country_code: "DE",
    });
  });

  it("builds subscription idempotency key with start date", () => {
    assert.equal(
      subscriptionIdempotencyKey("mp_123", "2026-01-01"),
      "membership-subscription:mp_123:2026-01-01",
    );
  });

  it("builds subscription idempotency key without start date", () => {
    assert.equal(
      subscriptionIdempotencyKey("mp_123", null),
      "membership-subscription:mp_123:no-date",
    );
  });

  it("derives the first subscription charge date after paid-through coverage", () => {
    assert.equal(
      membershipSubscriptionStartDate(
        new Date("2026-09-30T23:59:59.999Z"),
        new Date("2026-04-29T10:00:00.000Z"),
      ),
      "2026-10-01",
    );
  });

  it("omits a delayed subscription charge date without paid-through coverage", () => {
    assert.equal(
      membershipSubscriptionStartDate(
        null,
        new Date("2026-04-29T10:00:00.000Z"),
      ),
      null,
    );
  });

  it("omits a delayed subscription charge date for expired coverage", () => {
    assert.equal(
      membershipSubscriptionStartDate(
        new Date("2026-01-01T23:59:59.999Z"),
        new Date("2026-04-29T10:00:00.000Z"),
      ),
      null,
    );
  });
});
