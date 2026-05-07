import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { User } from "@/db/schema/auth";
import { getStructuredMembershipState } from "./membership-status";

function user(overrides: Partial<User> = {}): User {
  const now = new Date("2026-04-26T00:00:00.000Z");

  return {
    id: "usr_123",
    name: "Ada Lovelace",
    email: "ada@example.com",
    emailVerified: true,
    image: null,
    createdAt: now,
    updatedAt: now,
    firstName: "Ada",
    lastName: "Lovelace",
    street: "Example Street 1",
    state: "Berlin",
    city: "Berlin",
    zip: "10115",
    country: "DE",
    personalEmail: "ada.personal@example.com",
    batchNumber: 1,
    phone: "+491234567890",
    status: "onboarding",
    department: null,
    ...overrides,
  };
}

describe("getStructuredMembershipState", () => {
  const now = new Date("2026-04-26T00:00:00.000Z");

  it("keeps legal state explicit when it has not been loaded", () => {
    assert.deepEqual(
      getStructuredMembershipState(user(), { status: "pending" }, { now })
        .legal,
      {
        status: "unknown",
        source: "not_loaded",
      },
    );
  });

  it("keeps incomplete normal onboarding users away from payment setup", () => {
    const state = getStructuredMembershipState(
      user({ personalEmail: "" }),
      { status: "pending" },
      { now },
    );

    assert.equal(state.profile, "incomplete");
    assert.equal(state.payment, "pending");
    assert.equal(state.nextAction, "complete_profile");
    assert.equal(state.paymentSetupAllowed, false);
  });

  it("lets completed onboarding users with payment rows set up payment", () => {
    const state = getStructuredMembershipState(
      user(),
      { status: "pending" },
      { now },
    );

    assert.equal(state.profile, "complete");
    assert.equal(state.payment, "pending");
    assert.equal(state.nextAction, "set_up_payment");
    assert.equal(state.paymentSetupAllowed, true);
  });

  it("lets imported members continue payment setup before profile completion", () => {
    const state = getStructuredMembershipState(
      user({
        personalEmail: "",
        status: "member",
      }),
      { status: "pending", paidThroughAt: new Date("2026-12-31") },
      { now },
    );

    assert.equal(state.profile, "incomplete");
    assert.equal(state.payment, "covered_until_date");
    assert.equal(state.nextAction, "set_up_payment");
    assert.equal(state.paymentSetupAllowed, true);
  });

  it("represents checkout-started payments as processing", () => {
    const state = getStructuredMembershipState(
      user({ status: "supporting_alumni" }),
      { status: "checkout_started" },
      { now },
    );

    assert.equal(state.profile, "complete");
    assert.equal(state.operational, "supporting_alumni");
    assert.equal(state.payment, "processing");
    assert.equal(state.nextAction, "set_up_payment");
    assert.equal(state.paymentSetupAllowed, true);
  });

  it("does not treat a member without a payment row as active", () => {
    const state = getStructuredMembershipState(
      user({ status: "member" }),
      null,
      { now },
    );

    assert.equal(state.payment, "not_started");
    assert.equal(state.nextAction, "set_up_payment");
    assert.equal(state.paymentSetupAllowed, true);
  });

  it("keeps alumni without payment as not required", () => {
    const state = getStructuredMembershipState(
      user({ status: "alumni" }),
      null,
      { now },
    );

    assert.equal(state.payment, "not_required");
    assert.equal(state.nextAction, "none");
    assert.equal(state.paymentSetupAllowed, false);
  });

  it("marks active subscriptions as active with no next action", () => {
    const state = getStructuredMembershipState(
      user({ status: "member" }),
      {
        status: "active",
        gocardlessSubscriptionId: "SB123",
        paidThroughAt: new Date("2026-01-01"),
      },
      { now },
    );

    assert.equal(state.payment, "active");
    assert.equal(state.nextAction, "none");
    assert.equal(state.paymentSetupAllowed, false);
  });

  it("marks expired manual coverage without a subscription as pending", () => {
    const state = getStructuredMembershipState(
      user({ status: "member" }),
      { status: "active", paidThroughAt: new Date("2026-01-01") },
      { now },
    );

    assert.equal(state.payment, "pending");
    assert.equal(state.nextAction, "set_up_payment");
    assert.equal(state.paymentSetupAllowed, true);
  });
});
