import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { paymentProposalsFingerprint } from "./payment-proposals-fingerprint";

const proposal = (over: {
  id: string;
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
    const a = [proposal({ id: "mc_a" }), proposal({ id: "mc_b" })];
    const b = [proposal({ id: "mc_b" }), proposal({ id: "mc_a" })];
    assert.equal(
      paymentProposalsFingerprint(a),
      paymentProposalsFingerprint(b),
    );
  });

  it("changes when a proposal is added", () => {
    const before = [proposal({ id: "mc_a" })];
    const after = [proposal({ id: "mc_a" }), proposal({ id: "mc_b" })];
    assert.notEqual(
      paymentProposalsFingerprint(before),
      paymentProposalsFingerprint(after),
    );
  });

  it("changes when a proposal is removed", () => {
    const before = [proposal({ id: "mc_a" }), proposal({ id: "mc_b" })];
    const after = [proposal({ id: "mc_a" })];
    assert.notEqual(
      paymentProposalsFingerprint(before),
      paymentProposalsFingerprint(after),
    );
  });

  it("changes when visible proposal data changes", () => {
    const base = [proposal({ id: "mc_a", amount: 4000 })];
    const differentAmount = [proposal({ id: "mc_a", amount: 5000 })];
    const differentDate = [
      proposal({ id: "mc_a", activationDate: "2026-06-01" }),
    ];
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
