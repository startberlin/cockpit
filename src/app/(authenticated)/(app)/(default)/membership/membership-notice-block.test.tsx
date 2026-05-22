import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { StructuredMembershipState } from "@/lib/membership-status";
import { deriveMembershipNotice } from "./membership-notice-state";

function state(
  overrides: Partial<
    Pick<StructuredMembershipState, "payment" | "mandateCancelled">
  > = {},
): Pick<StructuredMembershipState, "payment" | "mandateCancelled"> {
  return {
    payment: "not_started",
    mandateCancelled: false,
    ...overrides,
  };
}

describe("deriveMembershipNotice", () => {
  it("AE4: application_pending + no payment → membership notice (not payment)", () => {
    const notice = deriveMembershipNotice(
      state({ payment: "not_started" }),
      "application_pending",
      "onboarding",
    );
    assert.equal(notice, "application_pending");
  });

  it("AE6: alumni → alumni notice regardless of legalMembership state", () => {
    assert.equal(
      deriveMembershipNotice(state({ payment: "active" }), "active", "alumni"),
      "alumni",
    );
    assert.equal(deriveMembershipNotice(state(), null, "alumni"), "alumni");
  });

  it("active + mandate active → null (no notice)", () => {
    assert.equal(
      deriveMembershipNotice(
        state({ payment: "active", mandateCancelled: false }),
        "active",
        "member",
      ),
      null,
    );
  });

  it("active + mandateCancelled → payment_cancelled", () => {
    assert.equal(
      deriveMembershipNotice(
        state({ payment: "not_started", mandateCancelled: true }),
        "active",
        "member",
      ),
      "payment_cancelled",
    );
  });

  it("active + no customer id + no mandate → payment_not_started", () => {
    assert.equal(
      deriveMembershipNotice(
        state({ payment: "not_started", mandateCancelled: false }),
        "active",
        "member",
      ),
      "payment_not_started",
    );
  });

  it("membership_reconfirmation_pending + no payment → reconfirmation notice (not payment)", () => {
    assert.equal(
      deriveMembershipNotice(
        state({ payment: "not_started" }),
        "membership_reconfirmation_pending",
        "member",
      ),
      "membership_reconfirmation_pending",
    );
  });

  it("processing → null (no notice)", () => {
    assert.equal(
      deriveMembershipNotice(state(), "processing", "onboarding"),
      null,
    );
  });

  it("manual_followup → manual_followup notice", () => {
    assert.equal(
      deriveMembershipNotice(state(), "manual_followup", "onboarding"),
      "manual_followup",
    );
  });

  it("cancelled → null (no notice)", () => {
    assert.equal(deriveMembershipNotice(state(), "cancelled", "member"), null);
  });

  it("onboarding / no membership → null", () => {
    assert.equal(deriveMembershipNotice(state(), null, "onboarding"), null);
  });

  it("null legalMembership → null", () => {
    assert.equal(deriveMembershipNotice(state(), null, "member"), null);
  });

  it("pending transition → transition_pending notice overrides payment notices", () => {
    const pendingTransition = {
      id: "mtr_test",
      userId: "usr_test",
      type: "cancellation" as const,
      status: "pending" as const,
      reason: null,
      keepPersonalEmail: null,
      personalEmailForNotification: null,
      requestedAt: new Date(),
      decidedAt: null,
      decidedByUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    assert.equal(
      deriveMembershipNotice(
        state({ payment: "not_started", mandateCancelled: false }),
        "active",
        "member",
        pendingTransition,
      ),
      "transition_pending",
    );
  });

  it("no pending transition → still derives payment notice", () => {
    assert.equal(
      deriveMembershipNotice(
        state({ payment: "not_started", mandateCancelled: false }),
        "active",
        "member",
        null,
      ),
      "payment_not_started",
    );
  });
});
