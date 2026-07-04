import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { paymentProposalsFingerprint } from "./payment-proposals-fingerprint";

const proposal = (over: {
  userName?: string;
  activationDate?: string;
  amount?: number;
}) => ({
  userName: "Anna Müller",
  activationDate: "2026-05-01",
  amount: 4000,
  ...over,
});

describe("paymentProposalsFingerprint", () => {
  it("is stable for the same proposal set regardless of order", () => {
    const a = [
      proposal({ userName: "Anna Müller" }),
      proposal({ userName: "Ben Schmidt" }),
    ];
    const b = [
      proposal({ userName: "Ben Schmidt" }),
      proposal({ userName: "Anna Müller" }),
    ];
    assert.equal(
      paymentProposalsFingerprint(a),
      paymentProposalsFingerprint(b),
    );
  });

  it("ignores the internal id — recreated proposals with identical content match", () => {
    // The email never shows the proposal id, so a proposal recreated with the
    // same member/date/amount must not count as changed content.
    const before = [proposal({})];
    const recreated = [proposal({})];
    assert.equal(
      paymentProposalsFingerprint(before),
      paymentProposalsFingerprint(recreated),
    );
  });

  it("changes when a proposal is added", () => {
    const before = [proposal({ userName: "Anna Müller" })];
    const after = [
      proposal({ userName: "Anna Müller" }),
      proposal({ userName: "Ben Schmidt" }),
    ];
    assert.notEqual(
      paymentProposalsFingerprint(before),
      paymentProposalsFingerprint(after),
    );
  });

  it("changes when a proposal is removed", () => {
    const before = [
      proposal({ userName: "Anna Müller" }),
      proposal({ userName: "Ben Schmidt" }),
    ];
    const after = [proposal({ userName: "Anna Müller" })];
    assert.notEqual(
      paymentProposalsFingerprint(before),
      paymentProposalsFingerprint(after),
    );
  });

  it("changes when visible proposal data changes", () => {
    const base = [proposal({ amount: 4000 })];
    const differentAmount = [proposal({ amount: 5000 })];
    const differentDate = [proposal({ activationDate: "2026-06-01" })];
    assert.notEqual(
      paymentProposalsFingerprint(base),
      paymentProposalsFingerprint(differentAmount),
    );
    assert.notEqual(
      paymentProposalsFingerprint(base),
      paymentProposalsFingerprint(differentDate),
    );
  });
});
