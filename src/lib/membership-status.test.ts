import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { User } from "@/db/schema/auth";
import { getMembershipViewState } from "./membership-status";

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
    roles: ["member"],
    department: null,
    ...overrides,
  };
}

describe("getMembershipViewState", () => {
  const now = new Date("2026-04-26T00:00:00.000Z");

  it("keeps users with missing profile details in profile onboarding", () => {
    assert.equal(
      getMembershipViewState(
        user({ street: null }),
        { status: "active", paidThroughAt: new Date("2027-01-01") },
        now,
      ),
      "profile_onboarding",
    );
  });

  it("keeps completed profile users without admin approval in profile onboarding", () => {
    assert.equal(getMembershipViewState(user(), null), "profile_onboarding");
  });

  it("marks admin-approved profile users as payment pending", () => {
    assert.equal(
      getMembershipViewState(user(), { status: "pending" }),
      "payment_pending",
    );
  });

  it("marks active payment users as full members", () => {
    assert.equal(
      getMembershipViewState(user(), { status: "active" }, now),
      "full_member",
    );
  });

  it("keeps delayed-start GoCardless subscriptions full members after coverage date passes", () => {
    assert.equal(
      getMembershipViewState(
        user({ status: "member" }),
        {
          status: "active",
          gocardlessSubscriptionId: "SB123",
          paidThroughAt: new Date("2026-01-01"),
        },
        now,
      ),
      "full_member",
    );
  });

  it("marks imported members as full members after subscription activation before profile completion", () => {
    assert.equal(
      getMembershipViewState(
        user({
          personalEmail: "",
          status: "member",
        }),
        {
          status: "active",
          gocardlessSubscriptionId: "SB123",
          paidThroughAt: new Date("2026-12-31"),
        },
        now,
      ),
      "full_member",
    );
  });

  it("marks expired manual coverage without a subscription as payment pending", () => {
    assert.equal(
      getMembershipViewState(
        user({ status: "member" }),
        { status: "active", paidThroughAt: new Date("2026-01-01") },
        now,
      ),
      "payment_pending",
    );
  });

  it("keeps imported users with future paid-through coverage payment pending until billing is set up", () => {
    assert.equal(
      getMembershipViewState(
        user({ status: "member" }),
        { status: "pending", paidThroughAt: new Date("2026-12-31") },
        now,
      ),
      "payment_pending",
    );
  });

  it("lets imported members start payment setup before profile completion", () => {
    assert.equal(
      getMembershipViewState(
        user({
          personalEmail: "",
          status: "member",
        }),
        { status: "pending", paidThroughAt: new Date("2026-12-31") },
        now,
      ),
      "payment_pending",
    );
  });

  it("lets imported supporting alumni start payment setup before profile completion", () => {
    assert.equal(
      getMembershipViewState(
        user({
          personalEmail: "",
          status: "supporting_alumni",
        }),
        { status: "pending", paidThroughAt: new Date("2026-12-31") },
        now,
      ),
      "payment_pending",
    );
  });

  it("keeps imported members in payment processing before profile completion after checkout starts", () => {
    assert.equal(
      getMembershipViewState(
        user({
          personalEmail: "",
          status: "member",
        }),
        { status: "checkout_started" },
        now,
      ),
      "payment_processing",
    );
  });

  it("keeps normal users with incomplete profiles in profile onboarding", () => {
    assert.equal(
      getMembershipViewState(
        user({ personalEmail: "" }),
        { status: "pending" },
        now,
      ),
      "profile_onboarding",
    );
  });

  it("does not show membership payment setup to imported alumni before profile completion", () => {
    assert.equal(
      getMembershipViewState(
        user({
          personalEmail: "",
          status: "alumni",
        }),
        null,
        now,
      ),
      "profile_onboarding",
    );
  });

  it("treats legacy member users without payment rows as full members", () => {
    assert.equal(
      getMembershipViewState(user({ status: "member" }), null),
      "full_member",
    );
  });

  it("marks checkout-started users as payment processing", () => {
    assert.equal(
      getMembershipViewState(user(), { status: "checkout_started" }),
      "payment_processing",
    );
  });
});
