import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterLegalMembers, isLegalMember } from "./legal-privileges";

describe("isLegalMember", () => {
  it("returns true for active_member", () => {
    assert.ok(isLegalMember({ legalMembershipState: "active_member" }));
  });

  it("returns false for not_member (covers AE1 and AE8)", () => {
    // AE1: pending admission tenure does not grant legal voting eligibility
    // AE8: operational Member with not_member legal state is excluded
    assert.equal(isLegalMember({ legalMembershipState: "not_member" }), false);
  });

  it("returns false for former_member", () => {
    assert.equal(
      isLegalMember({ legalMembershipState: "former_member" }),
      false,
    );
  });

  it("Supporting Alumni with active_member state is eligible (happy path)", () => {
    assert.ok(isLegalMember({ legalMembershipState: "active_member" }));
  });
});

describe("filterLegalMembers", () => {
  it("returns only active_member subjects", () => {
    const subjects = [
      { id: "1", legalMembershipState: "active_member" as const },
      { id: "2", legalMembershipState: "not_member" as const },
      { id: "3", legalMembershipState: "former_member" as const },
      { id: "4", legalMembershipState: "active_member" as const },
    ];

    const result = filterLegalMembers(subjects);
    assert.equal(result.length, 2);
    assert.ok(result.every((s) => s.legalMembershipState === "active_member"));
  });

  it("returns empty array when no active members", () => {
    const subjects = [
      { legalMembershipState: "not_member" as const },
      { legalMembershipState: "former_member" as const },
    ];
    assert.deepEqual(filterLegalMembers(subjects), []);
  });
});
