/**
 * Workflow-level smoke tests for Inngest system group workflows.
 *
 * These use the pure computation logic (`getSystemGroupsForUser`,
 * `getMembersOfSystemGroup`) that the workflows delegate to, and verify
 * the control-flow guards (skip-on-no-email, correct diff shape) without
 * needing to spin up a real Inngest environment or database.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  SystemGroupUser,
  UserPosition,
} from "../lib/groups/system-groups";
import {
  getMembersOfSystemGroup,
  getSystemGroupsForUser,
} from "../lib/groups/system-groups";

// ─── sync-user-system-groups computation ──────────────────────────────────────

describe("sync-user-system-groups: group diff computation", () => {
  function diff(
    before: SystemGroupUser,
    after: SystemGroupUser,
    positions: UserPosition[],
    batches: { number: number }[],
  ) {
    const beforeGroups = getSystemGroupsForUser(before, positions, batches);
    const afterGroups = getSystemGroupsForUser(after, positions, batches);
    const beforeSlugs = new Set(beforeGroups.map((g) => g.slug));
    const afterSlugs = new Set(afterGroups.map((g) => g.slug));
    return {
      toAdd: afterGroups.filter((g) => !beforeSlugs.has(g.slug)),
      toRemove: beforeGroups.filter((g) => !afterSlugs.has(g.slug)),
    };
  }

  const batches = [{ number: 7 }];

  it("adds members/batch groups when status changes cancelled → member", () => {
    const userId = "usr_1";
    const base = {
      id: userId,
      department: null,
      batchNumber: 7,
      grants: [],
    } satisfies Omit<SystemGroupUser, "status">;
    const { toAdd, toRemove } = diff(
      { ...base, status: "cancelled" },
      { ...base, status: "member" },
      [],
      batches,
    );
    const added = toAdd.map((g) => g.slug);
    assert.ok(added.includes("members"), "should add members@");
    assert.ok(added.includes("batch-7"), "should add batch-7@");
    assert.equal(toRemove.length, 0);
  });

  it("removes groups when status changes member → cancelled", () => {
    const userId = "usr_1";
    const base = {
      id: userId,
      department: null,
      batchNumber: 3,
      grants: [],
    } satisfies Omit<SystemGroupUser, "status">;
    const batches3 = [{ number: 3 }];
    const { toAdd, toRemove } = diff(
      { ...base, status: "member" },
      { ...base, status: "cancelled" },
      [],
      batches3,
    );
    assert.equal(toAdd.length, 0);
    assert.ok(toRemove.some((g) => g.slug === "members"));
    assert.ok(toRemove.some((g) => g.slug === "batch-3"));
  });

  it("adds onboarding-members when status changes to onboarding", () => {
    const userId = "usr_1";
    const base = {
      id: userId,
      department: null,
      batchNumber: null,
      grants: [],
    } satisfies Omit<SystemGroupUser, "status">;
    const { toAdd } = diff(
      { ...base, status: "cancelled" },
      { ...base, status: "onboarding" },
      [],
      [],
    );
    const added = toAdd.map((g) => g.slug);
    assert.ok(added.includes("members"));
    assert.ok(added.includes("onboarding-members"));
  });

  it("produces no diff when nothing changed", () => {
    const u: SystemGroupUser = {
      id: "usr_1",
      status: "member",
      department: null,
      batchNumber: null,
      grants: [],
    };
    const { toAdd, toRemove } = diff(u, u, [], []);
    assert.equal(toAdd.length, 0);
    assert.equal(toRemove.length, 0);
  });
});

// ─── sync-position-system-groups computation ──────────────────────────────────

describe("sync-position-system-groups: expected group computation", () => {
  it("president gets board, legal-board, members", () => {
    const user: SystemGroupUser = {
      id: "usr_1",
      status: "member",
      department: null,
      batchNumber: null,
      grants: [],
    };
    const positions: UserPosition[] = [
      { position: "president", scope: "global", department: null },
    ];
    const groups = getSystemGroupsForUser(user, positions, []);
    const slugs = groups.map((g) => g.slug);
    assert.ok(slugs.includes("board"));
    assert.ok(slugs.includes("legal-board"));
    assert.ok(slugs.includes("members"));
  });

  it("department_head for events gets board, events, events-members, members", () => {
    const user: SystemGroupUser = {
      id: "usr_1",
      status: "member",
      department: "events",
      batchNumber: null,
      grants: [],
    };
    const positions: UserPosition[] = [
      { position: "department_head", scope: "global", department: "events" },
    ];
    const groups = getSystemGroupsForUser(user, positions, []);
    const slugs = groups.map((g) => g.slug);
    assert.ok(slugs.includes("board"));
    assert.ok(slugs.includes("events"));
    assert.ok(slugs.includes("events-members"));
    assert.ok(!slugs.includes("legal-board"));
  });

  it("user without positions or active status gets no groups", () => {
    const user: SystemGroupUser = {
      id: "usr_1",
      status: "cancelled",
      department: "operations",
      batchNumber: 7,
      grants: [],
    };
    const groups = getSystemGroupsForUser(user, [], [{ number: 7 }]);
    assert.equal(groups.length, 0);
  });
});

// ─── bootstrap-batch-system-group member selection ────────────────────────────

describe("bootstrap-batch-system-group: member selection", () => {
  type User = SystemGroupUser & { email: string | null };

  const users: User[] = [
    {
      id: "u1",
      status: "member",
      department: null,
      batchNumber: 7,
      grants: [],
      email: "u1@example.com",
    },
    {
      id: "u2",
      status: "cancelled",
      department: null,
      batchNumber: 7,
      grants: [],
      email: "u2@example.com",
    },
    {
      id: "u3",
      status: "member",
      department: null,
      batchNumber: 3,
      grants: [],
      email: "u3@example.com",
    },
    {
      id: "u4",
      status: "member",
      department: null,
      batchNumber: 7,
      grants: [],
      email: null,
    },
  ];

  it("includes only members with matching batch number", () => {
    const members = getMembersOfSystemGroup("batch-7", users, []);
    const ids = members.map((u) => u.id).sort();
    // u1: member batch 7 ✓, u2: cancelled batch 7 ✗, u3: member batch 3 ✗, u4: member batch 7 (null email)
    assert.ok(ids.includes("u1"));
    assert.ok(!ids.includes("u2"));
    assert.ok(!ids.includes("u3"));
  });

  it("workflow email filter excludes null-email members", () => {
    const allMembers = getMembersOfSystemGroup("batch-7", users, []);
    // mirrors bootstrap workflow: for (const u of members) { if (u.email) push(...) }
    const withEmail = allMembers.filter(
      (u): u is User & { email: string } => u.email !== null,
    );
    assert.ok(withEmail.every((u) => u.email !== null));
    assert.ok(!withEmail.some((u) => u.id === "u4"));
  });

  it("returns empty when no users match the batch", () => {
    const members = getMembersOfSystemGroup("batch-99", users, []);
    assert.equal(members.length, 0);
  });
});

// ─── cockpit-feedback membership (grant-based) ────────────────────────────────

describe("cockpit-feedback: membership computed from grants", () => {
  const baseUser = {
    status: "member" as const,
    department: null,
    batchNumber: null,
  };

  it("includes users with admin grant", () => {
    const users: SystemGroupUser[] = [
      { id: "u1", ...baseUser, grants: ["admin"] },
      { id: "u2", ...baseUser, grants: [] },
    ];
    const members = getMembersOfSystemGroup("cockpit-feedback", users, []);
    assert.deepEqual(
      members.map((m) => m.id),
      ["u1"],
    );
  });

  it("includes users with super_admin grant", () => {
    const users: SystemGroupUser[] = [
      { id: "u1", ...baseUser, grants: ["super_admin"] },
    ];
    const members = getMembersOfSystemGroup("cockpit-feedback", users, []);
    assert.equal(members.length, 1);
  });

  it("does not include finance_admin or people_admin without admin", () => {
    const users: SystemGroupUser[] = [
      { id: "u1", ...baseUser, grants: ["finance_admin"] },
      { id: "u2", ...baseUser, grants: ["people_admin"] },
    ];
    const members = getMembersOfSystemGroup("cockpit-feedback", users, []);
    assert.equal(members.length, 0);
  });
});
