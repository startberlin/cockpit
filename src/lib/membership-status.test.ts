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
  it("keeps users with missing profile details in profile onboarding", () => {
    assert.equal(
      getMembershipViewState(user({ street: null }), { status: "active" }),
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
      getMembershipViewState(user(), { status: "active" }),
      "full_member",
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
