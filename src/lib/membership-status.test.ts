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
    birthDate: null,
    personalEmail: "ada.personal@example.com",
    batchNumber: 1,
    phone: "+491234567890",
    status: "onboarding",
    department: null,
    legalMembershipState: "not_member",
    gocardlessMandateId: null,
    gocardlessCustomerId: null,
    ...overrides,
  };
}

describe("getStructuredMembershipState", () => {
  it("surfaces the user legal membership state directly", () => {
    assert.equal(
      getStructuredMembershipState(user(), { status: "pending" }).legal,
      "not_member",
    );
    assert.equal(
      getStructuredMembershipState(
        user({ legalMembershipState: "active_member" }),
        { status: "pending" },
      ).legal,
      "active_member",
    );
  });

  it("keeps incomplete normal onboarding users away from payment setup", () => {
    const state = getStructuredMembershipState(user({ personalEmail: "" }), {
      status: "pending",
    });

    assert.equal(state.profile, "incomplete");
    assert.equal(state.payment, "pending");
    assert.equal(state.nextAction, "complete_profile");
    assert.equal(state.paymentSetupAllowed, false);
  });

  it("lets completed onboarding users with payment rows set up payment", () => {
    const state = getStructuredMembershipState(
      user({ legalMembershipState: "active_member" }),
      { status: "pending" },
    );

    assert.equal(state.profile, "complete");
    assert.equal(state.payment, "pending");
    assert.equal(state.nextAction, "set_up_payment");
    assert.equal(state.paymentSetupAllowed, true);
  });

  it("blocks payment setup for completed-profile users whose legal admission has not finished", () => {
    const state = getStructuredMembershipState(
      user({ legalMembershipState: "not_member" }),
      { status: "pending" },
    );

    assert.equal(state.profile, "complete");
    assert.equal(state.payment, "pending");
    assert.equal(state.paymentSetupAllowed, false);
  });

  it("represents checkout-started payments as processing", () => {
    const state = getStructuredMembershipState(
      user({
        status: "supporting_alumni",
        legalMembershipState: "active_member",
      }),
      { status: "checkout_started" },
    );

    assert.equal(state.profile, "complete");
    assert.equal(state.operational, "supporting_alumni");
    assert.equal(state.payment, "processing");
    assert.equal(state.nextAction, "set_up_payment");
    assert.equal(state.paymentSetupAllowed, true);
  });

  it("does not treat a member without a payment row as active", () => {
    const state = getStructuredMembershipState(
      user({ status: "member", legalMembershipState: "active_member" }),
      null,
    );

    assert.equal(state.payment, "not_started");
    assert.equal(state.nextAction, "set_up_payment");
    assert.equal(state.paymentSetupAllowed, true);
  });

  it("keeps alumni without payment as not required", () => {
    const state = getStructuredMembershipState(
      user({ status: "alumni" }),
      null,
    );

    assert.equal(state.payment, "not_required");
    assert.equal(state.nextAction, "none");
    assert.equal(state.paymentSetupAllowed, false);
  });

  it("marks active membership_payment rows as active with no next action", () => {
    const state = getStructuredMembershipState(
      user({ status: "member", legalMembershipState: "active_member" }),
      { status: "active" },
    );

    assert.equal(state.payment, "active");
    assert.equal(state.nextAction, "none");
    assert.equal(state.paymentSetupAllowed, false);
  });

  describe("legalMembershipState gate on paymentSetupAllowed", () => {
    it("blocks payment setup when legalMembershipState is not_member even if status is member", () => {
      const state = getStructuredMembershipState(
        user({ status: "member", legalMembershipState: "not_member" }),
        { status: "pending" },
      );

      assert.equal(state.paymentSetupAllowed, false);
    });

    it("allows payment setup when legalMembershipState is active_member and payment is not_started", () => {
      const state = getStructuredMembershipState(
        user({ status: "member", legalMembershipState: "active_member" }),
        null,
      );

      assert.equal(state.payment, "not_started");
      assert.equal(state.paymentSetupAllowed, true);
    });

    it("allows payment setup for supporting_alumni with active_member legal state and pending payment", () => {
      const state = getStructuredMembershipState(
        user({
          status: "supporting_alumni",
          legalMembershipState: "active_member",
        }),
        { status: "pending" },
      );

      assert.equal(state.payment, "pending");
      assert.equal(state.paymentSetupAllowed, true);
    });
  });
});
