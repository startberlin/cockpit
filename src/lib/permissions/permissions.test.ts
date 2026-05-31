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
      evaluateAuth(authority({ grants: [{ grant: "admin" }] }), "users.create"),
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
        "user.view_details",
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
        "user.view_details",
        { targetDepartment: "growth" },
      ),
      false,
    );
  });

  it("gate check (no scope) allows any department head", () => {
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
        "user.view_details",
      ),
      true,
    );
  });

  it("allows legal officers to view member details in any department", () => {
    assert.equal(
      evaluateAuth(
        authority({
          positions: [{ position: "president", scope: "global" }],
        }),
        "user.view_details",
        { targetDepartment: "events" },
      ),
      true,
    );
  });

  it("allows legal officer positions to propose membership", () => {
    assert.equal(
      evaluateAuth(
        authority({
          positions: [{ position: "president", scope: "global" }],
        }),
        "user.membership.propose",
        { targetDepartment: "events" },
      ),
      true,
    );
  });

  it("does not let department heads vote on admission resolutions", () => {
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
        "membership.resolution.admission.vote",
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
        "group.members.manage",
        { isGroupMember: false, isGroupManager: false },
      ),
      false,
    );
  });

  it("allows admins to manage group members", () => {
    assert.equal(
      evaluateAuth(
        authority({ grants: [{ grant: "admin" }] }),
        "group.members.manage",
        { isGroupMember: false, isGroupManager: false },
      ),
      true,
    );
  });

  it("allows people admins to manage group members", () => {
    assert.equal(
      evaluateAuth(
        authority({ grants: [{ grant: "people_admin" }] }),
        "group.members.manage",
        { isGroupMember: false, isGroupManager: false },
      ),
      true,
    );
  });

  it("allows people admins to manage group managers", () => {
    assert.equal(
      evaluateAuth(
        authority({ grants: [{ grant: "people_admin" }] }),
        "group.managers.manage",
        { isGroupMember: false, isGroupManager: false },
      ),
      true,
    );
  });

  it("allows people admins to create groups", () => {
    assert.equal(
      evaluateAuth(
        authority({ grants: [{ grant: "people_admin" }] }),
        "groups.create",
      ),
      true,
    );
  });

  it("denies people admins from managing authority", () => {
    assert.equal(
      evaluateAuth(
        authority({ grants: [{ grant: "people_admin" }] }),
        "users.manage_authority",
      ),
      false,
    );
  });

  it("denies people admins from creating and importing users", () => {
    assert.equal(
      evaluateAuth(
        authority({ grants: [{ grant: "people_admin" }] }),
        "users.create",
      ),
      false,
    );
    assert.equal(
      evaluateAuth(
        authority({ grants: [{ grant: "people_admin" }] }),
        "users.import",
      ),
      false,
    );
  });

  it("denies ordinary group members from managing the group", () => {
    assert.equal(
      evaluateAuth(authority(), "group.members.manage", {
        isGroupMember: true,
        isGroupManager: false,
      }),
      false,
    );
  });

  it("allows group managers to manage group members", () => {
    assert.equal(
      evaluateAuth(authority(), "group.members.manage", {
        isGroupMember: true,
        isGroupManager: true,
      }),
      true,
    );
  });

  it("denies group managers from managing group managers", () => {
    assert.equal(
      evaluateAuth(authority(), "group.managers.manage", {
        isGroupMember: true,
        isGroupManager: true,
      }),
      false,
    );
  });

  it("allows admins to manage group managers", () => {
    assert.equal(
      evaluateAuth(
        authority({ grants: [{ grant: "admin" }] }),
        "group.managers.manage",
        { isGroupMember: false, isGroupManager: false },
      ),
      true,
    );
  });

  it("allows legal officers to export group members", () => {
    assert.equal(
      evaluateAuth(
        authority({
          positions: [{ position: "president", scope: "global" }],
        }),
        "group.export",
        { isGroupMember: false, isGroupManager: false },
      ),
      true,
    );
  });

  it("allows admins to export group members", () => {
    assert.equal(
      evaluateAuth(
        authority({ grants: [{ grant: "admin" }] }),
        "group.export",
        { isGroupMember: false, isGroupManager: false },
      ),
      true,
    );
  });

  it("allows people admins to export group members", () => {
    assert.equal(
      evaluateAuth(
        authority({ grants: [{ grant: "people_admin" }] }),
        "group.export",
        { isGroupMember: false, isGroupManager: false },
      ),
      true,
    );
  });

  it("denies plain group members from exporting", () => {
    assert.equal(
      evaluateAuth(authority(), "group.export", {
        isGroupMember: true,
        isGroupManager: false,
      }),
      false,
    );
  });

  it("allows group managers to export their group", () => {
    assert.equal(
      evaluateAuth(authority(), "group.export", {
        isGroupMember: true,
        isGroupManager: true,
      }),
      true,
    );
  });

  it("denies non-members from exporting", () => {
    assert.equal(
      evaluateAuth(authority(), "group.export", {
        isGroupMember: false,
        isGroupManager: false,
      }),
      false,
    );
  });

  it("allows members_group_exporter to export the members group", () => {
    assert.equal(
      evaluateAuth(
        authority({ grants: [{ grant: "members_group_exporter" }] }),
        "group.export",
        { isGroupMember: false, isGroupManager: false, groupId: "members" },
      ),
      true,
    );
  });

  it("denies members_group_exporter from exporting other groups", () => {
    assert.equal(
      evaluateAuth(
        authority({ grants: [{ grant: "members_group_exporter" }] }),
        "group.export",
        { isGroupMember: false, isGroupManager: false, groupId: "board" },
      ),
      false,
    );
  });

  it("denies members_group_exporter without a groupId", () => {
    assert.equal(
      evaluateAuth(
        authority({ grants: [{ grant: "members_group_exporter" }] }),
        "group.export",
        { isGroupMember: false, isGroupManager: false },
      ),
      false,
    );
  });

  it("allows global admins to manage batches", () => {
    assert.equal(
      evaluateAuth(
        authority({ grants: [{ grant: "admin" }] }),
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
    for (const status of ["onboarding", "alumni"] as const) {
      assert.equal(
        evaluateAuth(
          authority({
            status,
            grants: [{ grant: "admin" }],
          }),
          "group.members.manage",
          { isGroupMember: false, isGroupManager: false },
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
          grants: [{ grant: "admin" }],
        }),
        "group.members.manage",
        { isGroupMember: false, isGroupManager: false },
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
        authority({ grants: [{ grant: "finance_admin" }] }),
        "payments.manage",
      ),
      true,
    );
  });

  it("denies admin grant from managing payments", () => {
    assert.equal(
      evaluateAuth(
        authority({ grants: [{ grant: "admin" }] }),
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
          grants: [{ grant: "finance_admin" }],
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
          grants: [{ grant: "finance_admin" }],
        }),
        "payments.manage",
      ),
      false,
    );
  });

  describe("users.view_inactive", () => {
    it("allows admin grant", () => {
      assert.equal(
        evaluateAuth(
          authority({ grants: [{ grant: "admin" }] }),
          "users.view_inactive",
        ),
        true,
      );
    });

    it("allows super_admin grant", () => {
      assert.equal(
        evaluateAuth(
          authority({ grants: [{ grant: "super_admin" }] }),
          "users.view_inactive",
        ),
        true,
      );
    });

    it("allows finance_admin grant", () => {
      assert.equal(
        evaluateAuth(
          authority({ grants: [{ grant: "finance_admin" }] }),
          "users.view_inactive",
        ),
        true,
      );
    });

    it("allows president position (legal officer)", () => {
      assert.equal(
        evaluateAuth(
          authority({
            positions: [{ position: "president", scope: "global" }],
          }),
          "users.view_inactive",
        ),
        true,
      );
    });

    it("allows head_of_finance position (legal officer)", () => {
      assert.equal(
        evaluateAuth(
          authority({
            positions: [{ position: "head_of_finance", scope: "global" }],
          }),
          "users.view_inactive",
        ),
        true,
      );
    });

    it("denies plain member", () => {
      assert.equal(evaluateAuth(authority(), "users.view_inactive"), false);
    });

    it("denies people_admin grant", () => {
      assert.equal(
        evaluateAuth(
          authority({ grants: [{ grant: "people_admin" }] }),
          "users.view_inactive",
        ),
        false,
      );
    });

    it("denies department_head position", () => {
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
          "users.view_inactive",
        ),
        false,
      );
    });
  });

  describe("isUserScopedAction", () => {
    it('returns true for "user.view_details"', () => {
      const { isUserScopedAction } = require("./evaluate");
      assert.equal(isUserScopedAction("user.view_details"), true);
    });

    it('returns true for "user.payment.view"', () => {
      const { isUserScopedAction } = require("./evaluate");
      assert.equal(isUserScopedAction("user.payment.view"), true);
    });

    it('returns false for "users.view_inactive"', () => {
      const { isUserScopedAction } = require("./evaluate");
      assert.equal(isUserScopedAction("users.view_inactive"), false);
    });
  });

  describe("people_admin", () => {
    it("denies user.membership.propose", () => {
      assert.equal(
        evaluateAuth(
          authority({ grants: [{ grant: "people_admin" }] }),
          "user.membership.propose",
          { targetDepartment: "events" },
        ),
        false,
      );
    });

    it("allows user.view_details for any department", () => {
      assert.equal(
        evaluateAuth(
          authority({ grants: [{ grant: "people_admin" }] }),
          "user.view_details",
          { targetDepartment: "growth" },
        ),
        true,
      );
    });

    it("denies users.view_inactive", () => {
      assert.equal(
        evaluateAuth(
          authority({ grants: [{ grant: "people_admin" }] }),
          "users.view_inactive",
        ),
        false,
      );
    });

    it("allows group.members.manage for any group", () => {
      assert.equal(
        evaluateAuth(
          authority({ grants: [{ grant: "people_admin" }] }),
          "group.members.manage",
          { isGroupMember: false, isGroupManager: false },
        ),
        true,
      );
    });

    it("allows group.managers.manage for any group", () => {
      assert.equal(
        evaluateAuth(
          authority({ grants: [{ grant: "people_admin" }] }),
          "group.managers.manage",
          { isGroupMember: false, isGroupManager: false },
        ),
        true,
      );
    });

    it("allows groups.create", () => {
      assert.equal(
        evaluateAuth(
          authority({ grants: [{ grant: "people_admin" }] }),
          "groups.create",
        ),
        true,
      );
    });
  });

  describe("membership.resolution.admission", () => {
    it("allows legal officer to vote", () => {
      assert.equal(
        evaluateAuth(
          authority({
            positions: [{ position: "president", scope: "global" }],
          }),
          "membership.resolution.admission.vote",
        ),
        true,
      );
    });

    it("denies admin (non-officer) from voting", () => {
      assert.equal(
        evaluateAuth(
          authority({ grants: [{ grant: "admin" }] }),
          "membership.resolution.admission.vote",
        ),
        false,
      );
    });

    it("allows admin to view admission resolutions", () => {
      assert.equal(
        evaluateAuth(
          authority({ grants: [{ grant: "admin" }] }),
          "membership.resolution.admission.view",
        ),
        true,
      );
    });

    it("allows legal officer to view admission resolutions", () => {
      assert.equal(
        evaluateAuth(
          authority({
            positions: [{ position: "president", scope: "global" }],
          }),
          "membership.resolution.admission.view",
        ),
        true,
      );
    });

    it("allows department head to view admission resolutions", () => {
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
          "membership.resolution.admission.view",
        ),
        true,
      );
    });

    it("allows people_admin to view admission resolutions", () => {
      assert.equal(
        evaluateAuth(
          authority({ grants: [{ grant: "people_admin" }] }),
          "membership.resolution.admission.view",
        ),
        true,
      );
    });
  });

  describe("membership.transition.view", () => {
    it("allows people_admin", () => {
      assert.equal(
        evaluateAuth(
          authority({ grants: [{ grant: "people_admin" }] }),
          "membership.transition.view",
        ),
        true,
      );
    });

    it("allows legal officer", () => {
      assert.equal(
        evaluateAuth(
          authority({
            positions: [{ position: "president", scope: "global" }],
          }),
          "membership.transition.view",
        ),
        true,
      );
    });

    it("allows department head", () => {
      assert.equal(
        evaluateAuth(
          authority({
            positions: [
              {
                position: "department_head",
                scope: "department",
                department: "growth",
              },
            ],
          }),
          "membership.transition.view",
        ),
        true,
      );
    });

    it("allows plain admin to view transitions", () => {
      assert.equal(
        evaluateAuth(
          authority({ grants: [{ grant: "admin" }] }),
          "membership.transition.view",
        ),
        true,
      );
    });

    it("denies plain member", () => {
      assert.equal(
        evaluateAuth(authority(), "membership.transition.view"),
        false,
      );
    });

    it("allows department head scoped to their own department", () => {
      assert.equal(
        evaluateAuth(
          authority({
            positions: [
              {
                position: "department_head",
                scope: "department",
                department: "growth",
              },
            ],
          }),
          "membership.transition.view",
          { targetDepartment: "growth" },
        ),
        true,
      );
    });

    it("denies department head scoped to a different department", () => {
      assert.equal(
        evaluateAuth(
          authority({
            positions: [
              {
                position: "department_head",
                scope: "department",
                department: "growth",
              },
            ],
          }),
          "membership.transition.view",
          { targetDepartment: "events" },
        ),
        false,
      );
    });

    it("allows people_admin scoped to any department", () => {
      assert.equal(
        evaluateAuth(
          authority({ grants: [{ grant: "people_admin" }] }),
          "membership.transition.view",
          { targetDepartment: "events" },
        ),
        true,
      );
    });
  });

  describe("membership.cancellation.view", () => {
    it("allows people_admin", () => {
      assert.equal(
        evaluateAuth(
          authority({ grants: [{ grant: "people_admin" }] }),
          "membership.cancellation.view",
        ),
        true,
      );
    });

    it("allows legal officer", () => {
      assert.equal(
        evaluateAuth(
          authority({
            positions: [{ position: "president", scope: "global" }],
          }),
          "membership.cancellation.view",
        ),
        true,
      );
    });

    it("allows department head", () => {
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
          "membership.cancellation.view",
        ),
        true,
      );
    });

    it("allows plain admin to view cancellations", () => {
      assert.equal(
        evaluateAuth(
          authority({ grants: [{ grant: "admin" }] }),
          "membership.cancellation.view",
        ),
        true,
      );
    });

    it("allows department head scoped to their own department", () => {
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
          "membership.cancellation.view",
          { targetDepartment: "events" },
        ),
        true,
      );
    });

    it("denies department head scoped to a different department", () => {
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
          "membership.cancellation.view",
          { targetDepartment: "operations" },
        ),
        false,
      );
    });
  });

  describe("membership cancellation and transitions", () => {
    it("allows president to cancel any member", () => {
      assert.equal(
        evaluateAuth(
          authority({
            positions: [{ position: "president", scope: "global" }],
          }),
          "membership.cancel_member",
        ),
        true,
      );
    });

    it("denies regular member from cancelling another member", () => {
      assert.equal(
        evaluateAuth(authority(), "membership.cancel_member"),
        false,
      );
    });

    it("allows legal officer to decide on a transition in any department", () => {
      assert.equal(
        evaluateAuth(
          authority({
            positions: [{ position: "president", scope: "global" }],
          }),
          "membership.transition.decide",
          { targetDepartment: "events" },
        ),
        true,
      );
    });

    it("allows department head to decide on a transition in their own department", () => {
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
          "membership.transition.decide",
          { targetDepartment: "events" },
        ),
        true,
      );
    });

    it("denies department head from deciding on a transition in a different department", () => {
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
          "membership.transition.decide",
          { targetDepartment: "growth" },
        ),
        false,
      );
    });

    it("denies department head from deciding on a transition for a member with no department", () => {
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
          "membership.transition.decide",
          { targetDepartment: null },
        ),
        false,
      );
    });

    it("allows super_admin to decide on a transition in any department", () => {
      assert.equal(
        evaluateAuth(
          authority({ grants: [{ grant: "super_admin" }] }),
          "membership.transition.decide",
          { targetDepartment: "events" },
        ),
        true,
      );
    });

    it("denies regular member from deciding on a transition", () => {
      assert.equal(
        evaluateAuth(authority(), "membership.transition.decide", {
          targetDepartment: "events",
        }),
        false,
      );
    });

    it("allows legal officer to acknowledge a cancellation in any department", () => {
      assert.equal(
        evaluateAuth(
          authority({
            positions: [{ position: "president", scope: "global" }],
          }),
          "membership.cancellation.acknowledge",
          { targetDepartment: "events" },
        ),
        true,
      );
    });

    it("allows department head to acknowledge a cancellation in their own department", () => {
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
          "membership.cancellation.acknowledge",
          { targetDepartment: "events" },
        ),
        true,
      );
    });

    it("denies department head from acknowledging a cancellation in a different department", () => {
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
          "membership.cancellation.acknowledge",
          { targetDepartment: "growth" },
        ),
        false,
      );
    });

    it("allows super_admin to acknowledge a cancellation in any department", () => {
      assert.equal(
        evaluateAuth(
          authority({ grants: [{ grant: "super_admin" }] }),
          "membership.cancellation.acknowledge",
          { targetDepartment: "events" },
        ),
        true,
      );
    });

    it("denies regular member from acknowledging a cancellation", () => {
      assert.equal(
        evaluateAuth(authority(), "membership.cancellation.acknowledge", {
          targetDepartment: "events",
        }),
        false,
      );
    });
  });

  describe("user.department.change", () => {
    it("allows dept head for their own department", () => {
      assert.equal(
        evaluateAuth(
          authority({
            positions: [
              {
                position: "department_head",
                scope: "department",
                department: "operations",
              },
            ],
          }),
          "user.department.change",
          { targetDepartment: "operations" },
        ),
        true,
      );
    });

    it("denies dept head for a different department", () => {
      assert.equal(
        evaluateAuth(
          authority({
            positions: [
              {
                position: "department_head",
                scope: "department",
                department: "operations",
              },
            ],
          }),
          "user.department.change",
          { targetDepartment: "events" },
        ),
        false,
      );
    });

    it("denies dept head when targetDepartment is null", () => {
      assert.equal(
        evaluateAuth(
          authority({
            positions: [
              {
                position: "department_head",
                scope: "department",
                department: "operations",
              },
            ],
          }),
          "user.department.change",
          { targetDepartment: null },
        ),
        false,
      );
    });

    it("allows legal officer (president) for any department", () => {
      assert.equal(
        evaluateAuth(
          authority({
            positions: [{ position: "president", scope: "global" }],
          }),
          "user.department.change",
          { targetDepartment: "events" },
        ),
        true,
      );
    });

    it("allows legal officer when targetDepartment is null", () => {
      assert.equal(
        evaluateAuth(
          authority({
            positions: [{ position: "president", scope: "global" }],
          }),
          "user.department.change",
          { targetDepartment: null },
        ),
        true,
      );
    });

    it("allows people_admin for any department", () => {
      assert.equal(
        evaluateAuth(
          authority({ grants: [{ grant: "people_admin" }] }),
          "user.department.change",
          { targetDepartment: "operations" },
        ),
        true,
      );
    });

    it("denies finance_admin (no people_admin or legal role)", () => {
      assert.equal(
        evaluateAuth(
          authority({ grants: [{ grant: "finance_admin" }] }),
          "user.department.change",
          { targetDepartment: "events" },
        ),
        false,
      );
    });

    it("denies inactive user even with dept head position", () => {
      assert.equal(
        evaluateAuth(
          authority({
            status: "alumni",
            positions: [
              {
                position: "department_head",
                scope: "department",
                department: "operations",
              },
            ],
          }),
          "user.department.change",
          { targetDepartment: "operations" },
        ),
        false,
      );
    });
  });

  describe("user.personal_email.change", () => {
    it("allows admin grant", () => {
      assert.equal(
        evaluateAuth(
          authority({ grants: [{ grant: "admin" }] }),
          "user.personal_email.change",
        ),
        true,
      );
    });

    it("allows super_admin grant", () => {
      assert.equal(
        evaluateAuth(
          authority({ grants: [{ grant: "super_admin" }] }),
          "user.personal_email.change",
        ),
        true,
      );
    });

    it("denies people_admin only", () => {
      assert.equal(
        evaluateAuth(
          authority({ grants: [{ grant: "people_admin" }] }),
          "user.personal_email.change",
        ),
        false,
      );
    });

    it("denies department head only", () => {
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
          "user.personal_email.change",
        ),
        false,
      );
    });

    it("denies legal officer only", () => {
      assert.equal(
        evaluateAuth(
          authority({
            positions: [{ position: "president", scope: "global" }],
          }),
          "user.personal_email.change",
        ),
        false,
      );
    });

    it("denies inactive user with admin grant", () => {
      assert.equal(
        evaluateAuth(
          authority({ status: "alumni", grants: [{ grant: "admin" }] }),
          "user.personal_email.change",
        ),
        false,
      );
    });
  });

  describe("user.password.reset", () => {
    it("allows admin grant", () => {
      assert.equal(
        evaluateAuth(
          authority({ grants: [{ grant: "admin" }] }),
          "user.password.reset",
        ),
        true,
      );
    });

    it("allows super_admin grant", () => {
      assert.equal(
        evaluateAuth(
          authority({ grants: [{ grant: "super_admin" }] }),
          "user.password.reset",
        ),
        true,
      );
    });

    it("denies people_admin only", () => {
      assert.equal(
        evaluateAuth(
          authority({ grants: [{ grant: "people_admin" }] }),
          "user.password.reset",
        ),
        false,
      );
    });

    it("denies department head only", () => {
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
          "user.password.reset",
        ),
        false,
      );
    });

    it("denies legal officer only", () => {
      assert.equal(
        evaluateAuth(
          authority({
            positions: [{ position: "president", scope: "global" }],
          }),
          "user.password.reset",
        ),
        false,
      );
    });

    it("denies inactive user with admin grant", () => {
      assert.equal(
        evaluateAuth(
          authority({ status: "alumni", grants: [{ grant: "admin" }] }),
          "user.password.reset",
        ),
        false,
      );
    });
  });
});
