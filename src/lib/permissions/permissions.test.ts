import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateAuth, getBoardRosterSetup, type UserAuthority } from "./index";

function authority(overrides: Partial<UserAuthority> = {}): UserAuthority {
  return {
    userId: "usr_test",
    status: "member",
    department: "events",
    positions: [],
    grants: [],
    ...overrides,
  };
}

describe("permissions", () => {
  it("allows global admins to perform admin-listed actions", () => {
    assert.equal(
      evaluateAuth(
        authority({ grants: [{ grant: "admin", scope: "global" }] }),
        "users.create",
      ),
      true,
    );
  });

  it("allows department heads to act within their department", () => {
    assert.equal(
      evaluateAuth(
        authority({
          positions: [
            {
              position: "department_head",
              scope: "department",
              department: "events",
            },
          ],
        }),
        "users.view_details",
        { targetDepartment: "events" },
      ),
      true,
    );
  });

  it("denies department heads outside their department", () => {
    assert.equal(
      evaluateAuth(
        authority({
          positions: [
            {
              position: "department_head",
              scope: "department",
              department: "events",
            },
          ],
        }),
        "users.view_details",
        { targetDepartment: "growth" },
      ),
      false,
    );
  });

  it("fails closed when scoped permissions are missing target context", () => {
    assert.equal(
      evaluateAuth(
        authority({
          positions: [
            {
              position: "department_head",
              scope: "department",
              department: "events",
            },
          ],
        }),
        "users.view_details",
        undefined as unknown as { targetDepartment: null },
      ),
      false,
    );
  });

  it("does not grant user management from legal officer position alone", () => {
    assert.equal(
      evaluateAuth(
        authority({
          positions: [{ position: "president", scope: "global" }],
        }),
        "users.view_details",
        { targetDepartment: "events" },
      ),
      false,
    );
  });

  it("allows legal officer positions to propose membership", () => {
    assert.equal(
      evaluateAuth(
        authority({
          positions: [{ position: "president", scope: "global" }],
        }),
        "membership.propose",
        { targetDepartment: "events" },
      ),
      true,
    );
  });

  it("allows people admins to view all groups", () => {
    assert.equal(
      evaluateAuth(
        authority({ grants: [{ grant: "people_admin", scope: "global" }] }),
        "groups.view_all",
      ),
      true,
    );
  });

  it("denies department heads from viewing all groups", () => {
    assert.equal(
      evaluateAuth(
        authority({
          positions: [
            {
              position: "department_head",
              scope: "department",
              department: "events",
            },
          ],
        }),
        "groups.view_all",
      ),
      false,
    );
  });

  it("does not let department heads vote on legal membership resolutions", () => {
    assert.equal(
      evaluateAuth(
        authority({
          positions: [
            {
              position: "department_head",
              scope: "department",
              department: "events",
            },
          ],
        }),
        "membership.vote_resolution",
      ),
      false,
    );
  });

  it("does not allow legal officers to manage group members", () => {
    assert.equal(
      evaluateAuth(
        authority({
          positions: [{ position: "president", scope: "global" }],
        }),
        "groups.manage_members",
        { isGroupMember: false },
      ),
      false,
    );
  });

  it("allows admins to manage group members", () => {
    assert.equal(
      evaluateAuth(
        authority({ grants: [{ grant: "admin", scope: "global" }] }),
        "groups.manage_members",
        { isGroupMember: false },
      ),
      true,
    );
  });

  it("allows people admins to manage group members", () => {
    assert.equal(
      evaluateAuth(
        authority({ grants: [{ grant: "people_admin", scope: "global" }] }),
        "groups.manage_members",
        { isGroupMember: false },
      ),
      true,
    );
  });

  it("denies ordinary group members from managing the group", () => {
    assert.equal(
      evaluateAuth(authority(), "groups.manage_members", {
        isGroupMember: true,
      }),
      false,
    );
  });

  it("allows admins to export group members", () => {
    assert.equal(
      evaluateAuth(
        authority({ grants: [{ grant: "admin", scope: "global" }] }),
        "groups.export",
        { isGroupMember: false },
      ),
      true,
    );
  });

  it("allows people admins to export group members", () => {
    assert.equal(
      evaluateAuth(
        authority({ grants: [{ grant: "people_admin", scope: "global" }] }),
        "groups.export",
        { isGroupMember: false },
      ),
      true,
    );
  });

  it("allows group members to export their group", () => {
    assert.equal(
      evaluateAuth(authority(), "groups.export", { isGroupMember: true }),
      true,
    );
  });

  it("denies non-members from exporting", () => {
    assert.equal(
      evaluateAuth(authority(), "groups.export", { isGroupMember: false }),
      false,
    );
  });

  it("allows global admins to manage batches", () => {
    assert.equal(
      evaluateAuth(
        authority({ grants: [{ grant: "admin", scope: "global" }] }),
        "batches.manage",
      ),
      true,
    );
  });

  it("denies non-admins from managing batches", () => {
    assert.equal(
      evaluateAuth(
        authority({
          positions: [{ position: "president", scope: "global" }],
        }),
        "batches.manage",
      ),
      false,
    );
  });

  it("denies ordinary permissions for inactive statuses even with grants", () => {
    for (const status of [
      "onboarding",
      "supporting_alumni",
      "alumni",
    ] as const) {
      assert.equal(
        evaluateAuth(
          authority({
            status,
            grants: [{ grant: "admin", scope: "global" }],
          }),
          "groups.manage_members",
          { isGroupMember: false },
        ),
        false,
      );
    }
  });

  it("allows ordinary permissions for active members with grants", () => {
    assert.equal(
      evaluateAuth(
        authority({
          status: "member",
          grants: [{ grant: "admin", scope: "global" }],
        }),
        "groups.manage_members",
        { isGroupMember: false },
      ),
      true,
    );
  });

  it("validates exactly three board members and required officer functions", () => {
    const setup = getBoardRosterSetup([
      authority({
        userId: "usr_president",
        positions: [{ position: "president", scope: "global" }],
      }),
      authority({
        userId: "usr_vp",
        positions: [{ position: "vice_president", scope: "global" }],
      }),
      authority({
        userId: "usr_finance",
        positions: [{ position: "head_of_finance", scope: "global" }],
      }),
    ]);

    assert.deepEqual(setup, {
      ok: true,
      legalOfficerIds: ["usr_president", "usr_vp", "usr_finance"],
      officers: {
        presidentId: "usr_president",
        vicePresidentId: "usr_vp",
        headOfFinanceId: "usr_finance",
      },
    });
  });

  it("rejects board roster setup when officer functions are incomplete", () => {
    assert.deepEqual(getBoardRosterSetup([]), {
      ok: false,
      reason: "missing_officer_function",
      missing: ["president", "vice_president", "head_of_finance"],
    });
  });

  it("rejects board roster setup with duplicate legal officer functions", () => {
    assert.deepEqual(
      getBoardRosterSetup([
        authority({
          userId: "usr_one",
          positions: [{ position: "president", scope: "global" }],
        }),
        authority({
          userId: "usr_two",
          positions: [{ position: "vice_president", scope: "global" }],
        }),
        authority({
          userId: "usr_three",
          positions: [{ position: "head_of_finance", scope: "global" }],
        }),
        authority({
          userId: "usr_four",
          positions: [
            { position: "president", scope: "global" },
            { position: "head_of_finance", scope: "global" },
          ],
        }),
      ]),
      {
        ok: false,
        reason: "duplicate_officer_function",
        duplicate: ["president", "head_of_finance"],
      },
    );
  });

  it("rejects board roster setup with duplicate officer functions", () => {
    const setup = getBoardRosterSetup([
      authority({
        userId: "usr_one",
        positions: [{ position: "president", scope: "global" }],
      }),
      authority({
        userId: "usr_two",
        positions: [
          { position: "president", scope: "global" },
          { position: "vice_president", scope: "global" },
        ],
      }),
      authority({
        userId: "usr_three",
        positions: [{ position: "head_of_finance", scope: "global" }],
      }),
    ]);

    assert.deepEqual(setup, {
      ok: false,
      reason: "duplicate_officer_function",
      duplicate: ["president"],
    });
  });

  it("rejects board roster setup with overlapping officer holders", () => {
    const setup = getBoardRosterSetup([
      authority({
        userId: "usr_one",
        positions: [
          { position: "president", scope: "global" },
          { position: "vice_president", scope: "global" },
        ],
      }),
      authority({
        userId: "usr_two",
        positions: [{ position: "head_of_finance", scope: "global" }],
      }),
      authority({
        userId: "usr_three",
        positions: [],
      }),
    ]);

    assert.deepEqual(setup, {
      ok: false,
      reason: "overlapping_officer_function",
      officerIds: ["usr_one", "usr_one", "usr_two"],
    });
  });

  it("allows head_of_finance position to manage payments", () => {
    assert.equal(
      evaluateAuth(
        authority({
          positions: [{ position: "head_of_finance", scope: "global" }],
        }),
        "payments.manage",
      ),
      true,
    );
  });

  it("allows finance_admin grant to manage payments", () => {
    assert.equal(
      evaluateAuth(
        authority({ grants: [{ grant: "finance_admin", scope: "global" }] }),
        "payments.manage",
      ),
      true,
    );
  });

  it("denies admin grant from managing payments", () => {
    assert.equal(
      evaluateAuth(
        authority({ grants: [{ grant: "admin", scope: "global" }] }),
        "payments.manage",
      ),
      false,
    );
  });

  it("allows both head_of_finance and finance_admin to manage payments", () => {
    assert.equal(
      evaluateAuth(
        authority({
          positions: [{ position: "head_of_finance", scope: "global" }],
          grants: [{ grant: "finance_admin", scope: "global" }],
        }),
        "payments.manage",
      ),
      true,
    );
  });

  it("denies vice_president position from managing payments", () => {
    assert.equal(
      evaluateAuth(
        authority({
          positions: [{ position: "vice_president", scope: "global" }],
        }),
        "payments.manage",
      ),
      false,
    );
  });

  it("denies inactive member with finance_admin grant from managing payments", () => {
    assert.equal(
      evaluateAuth(
        authority({
          status: "alumni",
          grants: [{ grant: "finance_admin", scope: "global" }],
        }),
        "payments.manage",
      ),
      false,
    );
  });
});
