import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PositionAssignment, UserAuthority } from "@/lib/authority/model";
import { DEPARTMENT_IDS } from "@/lib/departments";
import { evaluateAuth, isJobboardNotificationRecipient } from "./evaluate";

const member: UserAuthority = {
  userId: "usr_test",
  status: "member",
  department: "events",
  positions: [],
  grants: [],
};

type Case = [string, Partial<UserAuthority>, boolean, boolean, boolean];
const cases: Case[] = [
  ["ordinary member", {}, false, false, false],
  ["Partnerships member", { department: "partnerships" }, true, false, false],
  [
    "delegated Jobboard editor",
    { grants: [{ grant: "jobboard_editor" }] },
    true,
    false,
    false,
  ],
  [
    "finance admin",
    { grants: [{ grant: "finance_admin" }] },
    false,
    false,
    false,
  ],
  [
    "people admin",
    { grants: [{ grant: "people_admin" }] },
    false,
    false,
    false,
  ],
  [
    "group exporter",
    { grants: [{ grant: "members_group_exporter" }] },
    false,
    false,
    false,
  ],
  ["Cockpit admin", { grants: [{ grant: "admin" }] }, true, true, false],
  [
    "Cockpit super admin",
    { grants: [{ grant: "super_admin" }] },
    true,
    true,
    false,
  ],
];
for (const position of ["department_head", "department_co_lead"] as const) {
  for (const department of DEPARTMENT_IDS) {
    const positions: PositionAssignment[] = [
      { position, scope: "department", department },
    ];
    const isPartnershipsLead = department === "partnerships";
    cases.push(
      [
        `${department} ${position} with Events membership`,
        { positions },
        isPartnershipsLead,
        isPartnershipsLead,
        true,
      ],
      [
        `${department} ${position} with Partnerships membership`,
        { department: "partnerships", positions },
        true,
        isPartnershipsLead,
        true,
      ],
    );
  }
}
for (const position of [
  "president",
  "vice_president",
  "head_of_finance",
] as const) {
  const positions: PositionAssignment[] = [{ position, scope: "global" }];
  cases.push(
    [position, { positions }, false, false, true],
    [
      `${position} with editor grant`,
      { positions, grants: [{ grant: "jobboard_editor" }] },
      true,
      false,
      true,
    ],
  );
}

describe("Jobboard authority", () => {
  for (const [label, authority, editor, publisher, notified] of cases) {
    it(`enforces editor, publisher and notification scopes for ${label}`, () => {
      for (const status of [
        "member",
        "supporting_alumni",
        "onboarding",
        "alumni",
        "cancelled",
      ] as const) {
        const user = { ...member, ...authority, status };
        const active = status === "member" || status === "supporting_alumni";
        assert.equal(
          evaluateAuth(user, "apps.jobboard.access"),
          active && editor,
          status,
        );
        assert.equal(
          evaluateAuth(user, "apps.jobboard.publish"),
          active && publisher,
          status,
        );
        assert.equal(
          isJobboardNotificationRecipient(user),
          active && notified,
          status,
        );
      }
    });
  }

  it("does not extend editor access to member administration", () => {
    const editor: UserAuthority = {
      ...member,
      grants: [{ grant: "jobboard_editor" }],
    };
    assert.equal(evaluateAuth(editor, "users.manage_authority"), false);
    assert.equal(evaluateAuth(editor, "payments.manage"), false);
  });
});
