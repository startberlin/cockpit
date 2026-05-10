import assert from "node:assert";
import { describe, it } from "node:test";
import type { BoardVoteValue } from "./board-resolution-rules";
import {
  computeResolutionRoles,
  computeVoteOutcome,
} from "./board-resolution-rules";

describe("computeVoteOutcome", () => {
  it("returns approved for 2 yes votes", () => {
    const votes: BoardVoteValue[] = ["yes", "yes"];
    assert.strictEqual(computeVoteOutcome(votes), "approved");
  });

  it("returns approved for 3 yes votes", () => {
    const votes: BoardVoteValue[] = ["yes", "yes", "yes"];
    assert.strictEqual(computeVoteOutcome(votes), "approved");
  });

  it("returns pending for 1 yes, 1 no", () => {
    const votes: BoardVoteValue[] = ["yes", "no"];
    assert.strictEqual(computeVoteOutcome(votes), "pending");
  });

  it("returns pending for empty votes", () => {
    const votes: BoardVoteValue[] = [];
    assert.strictEqual(computeVoteOutcome(votes), "pending");
  });

  it("returns pending for 1 vote (yes)", () => {
    const votes: BoardVoteValue[] = ["yes"];
    assert.strictEqual(computeVoteOutcome(votes), "pending");
  });

  it("returns pending for 3 no votes", () => {
    const votes: BoardVoteValue[] = ["no", "no", "no"];
    assert.strictEqual(computeVoteOutcome(votes), "pending");
  });
});

const president = {
  userId: "u_president",
  officerFunction: "president" as const,
};
const vicePresident = {
  userId: "u_vp",
  officerFunction: "vice_president" as const,
};
const headOfFinance = {
  userId: "u_hof",
  officerFunction: "head_of_finance" as const,
};
const allParticipants = [president, vicePresident, headOfFinance];

describe("computeResolutionRoles", () => {
  it("President + VP → President = Sitzungsleiter, VP = Protokollführer", () => {
    const votes = [
      { voterUserId: "u_president", value: "yes" as const },
      { voterUserId: "u_vp", value: "yes" as const },
    ];
    const result = computeResolutionRoles(allParticipants, votes);
    assert.ok(result !== null);
    assert.strictEqual(result.sitzungsleiter.officerFunction, "president");
    assert.strictEqual(
      result.protokollfuehrer.officerFunction,
      "vice_president",
    );
  });

  it("VP + HoF → VP = Sitzungsleiter, HoF = Protokollführer", () => {
    const votes = [
      { voterUserId: "u_vp", value: "yes" as const },
      { voterUserId: "u_hof", value: "yes" as const },
    ];
    const result = computeResolutionRoles(allParticipants, votes);
    assert.ok(result !== null);
    assert.strictEqual(result.sitzungsleiter.officerFunction, "vice_president");
    assert.strictEqual(
      result.protokollfuehrer.officerFunction,
      "head_of_finance",
    );
  });

  it("President + HoF → President = Sitzungsleiter, HoF = Protokollführer", () => {
    const votes = [
      { voterUserId: "u_president", value: "yes" as const },
      { voterUserId: "u_hof", value: "yes" as const },
    ];
    const result = computeResolutionRoles(allParticipants, votes);
    assert.ok(result !== null);
    assert.strictEqual(result.sitzungsleiter.officerFunction, "president");
    assert.strictEqual(
      result.protokollfuehrer.officerFunction,
      "head_of_finance",
    );
  });

  it("all three voted yes → President = Sitzungsleiter, VP = Protokollführer", () => {
    const votes = [
      { voterUserId: "u_president", value: "yes" as const },
      { voterUserId: "u_vp", value: "yes" as const },
      { voterUserId: "u_hof", value: "yes" as const },
    ];
    const result = computeResolutionRoles(allParticipants, votes);
    assert.ok(result !== null);
    assert.strictEqual(result.sitzungsleiter.officerFunction, "president");
    assert.strictEqual(
      result.protokollfuehrer.officerFunction,
      "vice_president",
    );
  });

  it("fewer than 2 yes votes → returns null", () => {
    const votes = [{ voterUserId: "u_president", value: "yes" as const }];
    assert.strictEqual(computeResolutionRoles(allParticipants, votes), null);
    assert.strictEqual(computeResolutionRoles(allParticipants, []), null);
  });

  it("unmatched voter userId → ignored, returns null if < 2 matched", () => {
    const votes = [
      { voterUserId: "u_unknown", value: "yes" as const },
      { voterUserId: "u_president", value: "yes" as const },
    ];
    assert.strictEqual(computeResolutionRoles([president], votes), null);
  });
});
