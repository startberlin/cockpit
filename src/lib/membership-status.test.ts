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
    birthDate: "1990-01-01",
    memberSinceDate: null,
    personalEmail: "ada.personal@example.com",
    batchNumber: 1,
    phone: "+491234567890",
    status: "onboarding",
    department: null,
    legalMembershipState: "not_member",
    gocardlessMandateId: null,
    gocardlessCustomerId: null,
    gocardlessSetupSessionId: null,
    role: "user",
    eventEmailPreference: "personal_email",
    ...overrides,
  };
}

describe("getStructuredMembershipState", () => {
  it("surfaces the user legal membership state directly", () => {
    assert.equal(getStructuredMembershipState(user()).legal, "not_member");
    assert.equal(
      getStructuredMembershipState(
        user({ legalMembershipState: "active_member" }),
      ).legal,
      "active_member",
    );
  });

  it("keeps incomplete normal onboarding users away from payment setup", () => {
    const state = getStructuredMembershipState(user({ personalEmail: "" }));

    assert.equal(state.profile, "incomplete");
    assert.equal(state.payment, "not_started");
    assert.equal(state.nextAction, "complete_profile");
    assert.equal(state.paymentSetupAllowed, false);
  });

  it("lets active_member users with complete profile set up payment", () => {
    const state = getStructuredMembershipState(
      user({ legalMembershipState: "active_member" }),
    );

    assert.equal(state.profile, "complete");
    assert.equal(state.payment, "not_started");
    assert.equal(state.nextAction, "set_up_payment");
    assert.equal(state.paymentSetupAllowed, true);
  });

  it("blocks payment setup for users whose legal admission has not finished", () => {
    const state = getStructuredMembershipState(
      user({ legalMembershipState: "not_member" }),
    );

    assert.equal(state.profile, "complete");
    assert.equal(state.payment, "not_started");
    assert.equal(state.paymentSetupAllowed, false);
  });

  it("marks users with a stored mandate as active", () => {
    const state = getStructuredMembershipState(
      user({
        status: "member",
        legalMembershipState: "active_member",
        gocardlessMandateId: "MD123",
      }),
    );

    assert.equal(state.payment, "active");
    assert.equal(state.nextAction, "none");
    assert.equal(state.paymentSetupAllowed, false);
  });

  it("does not treat a member without a mandate as active", () => {
    const state = getStructuredMembershipState(
      user({ status: "member", legalMembershipState: "active_member" }),
    );

    assert.equal(state.payment, "not_started");
    assert.equal(state.nextAction, "set_up_payment");
    assert.equal(state.paymentSetupAllowed, true);
  });

  it("keeps alumni without mandate as not_required", () => {
    const state = getStructuredMembershipState(user({ status: "alumni" }));

    assert.equal(state.payment, "not_required");
    assert.equal(state.nextAction, "none");
    assert.equal(state.paymentSetupAllowed, false);
  });

  describe("mandateCancelled", () => {
    it("is false when mandate is active", () => {
      const state = getStructuredMembershipState(
        user({ gocardlessMandateId: "MD123", gocardlessCustomerId: "CU123" }),
      );

      assert.equal(state.mandateCancelled, false);
      assert.equal(state.payment, "active");
    });

    it("is true when customer id is set but mandate id is null", () => {
      const state = getStructuredMembershipState(
        user({ gocardlessCustomerId: "CU123", gocardlessMandateId: null }),
      );

      assert.equal(state.mandateCancelled, true);
      assert.equal(state.payment, "not_started");
    });

    it("is false when neither customer id nor mandate id is set", () => {
      const state = getStructuredMembershipState(
        user({ gocardlessCustomerId: null, gocardlessMandateId: null }),
      );

      assert.equal(state.mandateCancelled, false);
      assert.equal(state.payment, "not_started");
    });

    it("is false for alumni regardless of customer id", () => {
      const state = getStructuredMembershipState(
        user({ status: "alumni", gocardlessCustomerId: "CU123" }),
      );

      assert.equal(state.mandateCancelled, false);
      assert.equal(state.payment, "not_required");
    });
  });

  describe("legalMembershipState gate on paymentSetupAllowed", () => {
    it("blocks payment setup when legalMembershipState is not_member even if status is member", () => {
      const state = getStructuredMembershipState(
        user({ status: "member", legalMembershipState: "not_member" }),
      );

      assert.equal(state.paymentSetupAllowed, false);
    });

    it("allows payment setup when legalMembershipState is active_member and no mandate", () => {
      const state = getStructuredMembershipState(
        user({ status: "member", legalMembershipState: "active_member" }),
      );

      assert.equal(state.payment, "not_started");
      assert.equal(state.paymentSetupAllowed, true);
    });

    it("allows payment setup for supporting_alumni with active_member legal state and no mandate", () => {
      const state = getStructuredMembershipState(
        user({
          status: "supporting_alumni",
          legalMembershipState: "active_member",
        }),
      );

      assert.equal(state.payment, "not_started");
      assert.equal(state.paymentSetupAllowed, true);
    });
  });
});
