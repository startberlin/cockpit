import assert from "node:assert";
import { describe, it } from "node:test";
import type { BoardVoteValue } from "./board-resolution-rules";
import { computeVoteOutcome } from "./board-resolution-rules";

describe("computeVoteOutcome", () => {
  it("returns approved for 2 yes votes", () => {
    const votes: BoardVoteValue[] = ["yes", "yes"];
    assert.strictEqual(computeVoteOutcome(votes), "approved");
  });

  it("returns approved for 3 yes votes", () => {
    const votes: BoardVoteValue[] = ["yes", "yes", "yes"];
    assert.strictEqual(computeVoteOutcome(votes), "approved");
  });

  it("returns manual_followup for any procedure_objection (even with 2 yes)", () => {
    const votes: BoardVoteValue[] = ["yes", "yes", "procedure_objection"];
    assert.strictEqual(computeVoteOutcome(votes), "manual_followup");
  });

  it("returns manual_followup for procedure_objection alone", () => {
    const votes: BoardVoteValue[] = ["procedure_objection"];
    assert.strictEqual(computeVoteOutcome(votes), "manual_followup");
  });

  it("returns pending for 1 yes, 1 abstain, 1 no", () => {
    const votes: BoardVoteValue[] = ["yes", "abstain", "no"];
    assert.strictEqual(computeVoteOutcome(votes), "pending");
  });

  it("returns approved for 2 yes and 1 abstain", () => {
    const votes: BoardVoteValue[] = ["yes", "yes", "abstain"];
    assert.strictEqual(computeVoteOutcome(votes), "approved");
  });

  it("returns pending for empty votes", () => {
    const votes: BoardVoteValue[] = [];
    assert.strictEqual(computeVoteOutcome(votes), "pending");
  });

  it("returns pending for 1 vote (yes)", () => {
    const votes: BoardVoteValue[] = ["yes"];
    assert.strictEqual(computeVoteOutcome(votes), "pending");
  });
});
