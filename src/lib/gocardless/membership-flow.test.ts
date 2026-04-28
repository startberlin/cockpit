import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  membershipFlowIdempotencyKey,
  membershipFlowMetadata,
  prefilledCustomerFromMembershipInput,
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
    country: "DE",
  },
  returnUrl: "https://cockpit.example.com/membership/payment-return",
  exitUrl: "https://cockpit.example.com/membership",
  localSessionId: "mps_123",
};

describe("membership GoCardless flow helpers", () => {
  it("builds stable idempotency keys from user and local session", () => {
    assert.equal(
      membershipFlowIdempotencyKey(input),
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
});
