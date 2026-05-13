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
    birthDate: "1990-01-15",
    memberSinceDate: null,
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

describe("getOnboardingProgress", () => {
  it("user with personal email, phone, and birthDate is completed", () => {
    assert.equal(getOnboardingProgress(user()), "completed");
  });

  it("completed regardless of address presence", () => {
    assert.equal(
      getOnboardingProgress(
        user({
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

  it("completed for active_member without address", () => {
    assert.equal(
      getOnboardingProgress(
        user({
          legalMembershipState: "active_member",
          street: null,
          city: null,
        }),
      ),
      "completed",
    );
  });

  it("completed for former_member without address", () => {
    assert.equal(
      getOnboardingProgress(
        user({
          legalMembershipState: "former_member",
          street: null,
          city: null,
        }),
      ),
      "completed",
    );
  });

  it("missing phone blocks completion", () => {
    assert.equal(getOnboardingProgress(user({ phone: null })), "master-data");
  });

  it("missing personalEmail blocks completion", () => {
    assert.equal(
      getOnboardingProgress(user({ personalEmail: "" })),
      "master-data",
    );
  });

  it("missing birthDate blocks completion", () => {
    assert.equal(
      getOnboardingProgress(user({ birthDate: null })),
      "master-data",
    );
  });

  it("missing phone blocks completion for active_member", () => {
    assert.equal(
      getOnboardingProgress(
        user({ legalMembershipState: "active_member", phone: null }),
      ),
      "master-data",
    );
  });

  it("missing personalEmail blocks completion for former_member", () => {
    assert.equal(
      getOnboardingProgress(
        user({ legalMembershipState: "former_member", personalEmail: "" }),
      ),
      "master-data",
    );
  });
});
