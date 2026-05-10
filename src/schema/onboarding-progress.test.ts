import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { User } from "@/db/schema/auth";
import { getOnboardingProgress } from "./onboarding-progress";

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
    street: null,
    state: null,
    city: null,
    zip: null,
    country: null,
    birthDate: null,
    personalEmail: "ada.personal@example.com",
    batchNumber: 1,
    phone: "+491234567890",
    status: "onboarding",
    department: null,
    legalMembershipState: "not_member",
    ...overrides,
  };
}

describe("getOnboardingProgress", () => {
  // AE2: Onboarding user with personal email and phone but no address is profile-complete.
  it("AE2: onboarding user with personal email and phone but no address is completed", () => {
    assert.equal(
      getOnboardingProgress(
        user({
          legalMembershipState: "not_member",
          street: null,
          city: null,
          state: null,
          zip: null,
          country: null,
        }),
      ),
      "completed",
    );
  });

  // AE3: Active legal Member with personal email and phone but no address is NOT profile-complete.
  it("AE3: active legal member without address is not completed", () => {
    assert.equal(
      getOnboardingProgress(
        user({
          legalMembershipState: "active_member",
          street: null,
          city: null,
          state: null,
          zip: null,
          country: null,
        }),
      ),
      "address",
    );
  });

  it("active legal member with full address is completed", () => {
    assert.equal(
      getOnboardingProgress(
        user({
          legalMembershipState: "active_member",
          street: "Example Street 1",
          city: "Berlin",
          state: "Berlin",
          zip: "10115",
          country: "DE",
        }),
      ),
      "completed",
    );
  });

  it("former member (supporting alumni) with full address is completed", () => {
    assert.equal(
      getOnboardingProgress(
        user({
          legalMembershipState: "former_member",
          status: "supporting_alumni",
          street: "Example Street 1",
          city: "Berlin",
          state: "Berlin",
          zip: "10115",
          country: "DE",
        }),
      ),
      "completed",
    );
  });

  it("former member without address is not completed", () => {
    assert.equal(
      getOnboardingProgress(
        user({
          legalMembershipState: "former_member",
          street: null,
          city: null,
          state: null,
          zip: null,
          country: null,
        }),
      ),
      "address",
    );
  });

  it("alumni with personal email and phone but no address is completed", () => {
    assert.equal(
      getOnboardingProgress(
        user({
          legalMembershipState: "not_member",
          status: "alumni",
          street: null,
          city: null,
          state: null,
          zip: null,
          country: null,
        }),
      ),
      "completed",
    );
  });

  it("operational member with legalMembershipState=not_member and no address is completed", () => {
    assert.equal(
      getOnboardingProgress(
        user({
          legalMembershipState: "not_member",
          status: "member",
          street: null,
          city: null,
          state: null,
          zip: null,
          country: null,
        }),
      ),
      "completed",
    );
  });

  it("missing phone blocks completion for not_member", () => {
    assert.equal(
      getOnboardingProgress(
        user({
          legalMembershipState: "not_member",
          phone: null,
        }),
      ),
      "master-data",
    );
  });

  it("missing phone blocks completion for active_member", () => {
    assert.equal(
      getOnboardingProgress(
        user({
          legalMembershipState: "active_member",
          phone: null,
          street: "Example Street 1",
          city: "Berlin",
          state: "Berlin",
          zip: "10115",
          country: "DE",
        }),
      ),
      "master-data",
    );
  });

  it("missing personalEmail blocks completion for not_member", () => {
    assert.equal(
      getOnboardingProgress(
        user({
          legalMembershipState: "not_member",
          personalEmail: "",
        }),
      ),
      "master-data",
    );
  });

  it("missing personalEmail blocks completion for active_member", () => {
    assert.equal(
      getOnboardingProgress(
        user({
          legalMembershipState: "active_member",
          personalEmail: "",
          street: "Example Street 1",
          city: "Berlin",
          state: "Berlin",
          zip: "10115",
          country: "DE",
        }),
      ),
      "master-data",
    );
  });

  it("missing personalEmail blocks completion for former_member", () => {
    assert.equal(
      getOnboardingProgress(
        user({
          legalMembershipState: "former_member",
          personalEmail: "",
          street: "Example Street 1",
          city: "Berlin",
          state: "Berlin",
          zip: "10115",
          country: "DE",
        }),
      ),
      "master-data",
    );
  });
});
