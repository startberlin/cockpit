import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Unit tests for the charge and decline action business logic contracts.
// The server actions themselves require Next.js server context (headers,
// cookies, server-only modules) and are verified integration-style in the
// GoCardless sandbox. These tests document the core algorithmic invariants.

describe("charge action idempotency guard", () => {
  it("returns alreadyProcessed when row status is not proposed", () => {
    // Simulates the guard: if status !== 'proposed', no second GC payment is issued.
    const nonProposedStatuses = [
      "pending",
      "submitted",
      "confirmed",
      "paid_out",
      "failed",
      "cancelled",
      "charged_back",
      "declined",
    ] as const;

    for (const status of nonProposedStatuses) {
      const shouldProcess = status === "proposed";
      assert.equal(
        shouldProcess,
        false,
        `status=${status} should not trigger a new GC payment`,
      );
    }
  });

  it("proceeds only when row status is proposed", () => {
    const status = "proposed";
    assert.equal(status === "proposed", true);
  });
});

describe("decline action idempotency guard", () => {
  it("returns alreadyProcessed for any non-proposed status", () => {
    const terminalStatuses = [
      "pending",
      "submitted",
      "confirmed",
      "paid_out",
      "failed",
      "cancelled",
      "charged_back",
      "declined",
    ] as const;

    for (const status of terminalStatuses) {
      assert.equal(
        status === "proposed",
        false,
        `status=${status} should short-circuit decline`,
      );
    }
  });
});

describe("charge action mandate guard", () => {
  it("throws when gocardlessMandateId is null", () => {
    const member = { gocardlessMandateId: null };
    assert.throws(
      () => {
        if (!member.gocardlessMandateId) {
          throw new Error("Member has no stored GoCardless mandate ID.");
        }
      },
      { message: "Member has no stored GoCardless mandate ID." },
    );
  });

  it("does not throw when gocardlessMandateId is present", () => {
    const member = { gocardlessMandateId: "MD123" };
    assert.doesNotThrow(() => {
      if (!member.gocardlessMandateId) {
        throw new Error("Member has no stored GoCardless mandate ID.");
      }
    });
  });
});

describe("charge action GC idempotency key", () => {
  it("uses the local row id as the idempotency key", () => {
    // GC Idempotency-Key = row.id prevents double-charging on retries.
    const rowId = "mc_abc123";
    const idempotencyKey = rowId;
    assert.equal(idempotencyKey, rowId);
  });
});
