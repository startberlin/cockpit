import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  SystemGroupPositionRow,
  SystemGroupUser,
  UserPosition,
} from "./system-groups";
import {
  getAllSystemGroupSlugs,
  getMembersOfSystemGroup,
  getSystemGroupBySlug,
  getSystemGroupsForUser,
  isSystemGroupSlug,
} from "./system-groups";

const BATCHES = [{ number: 7 }, { number: 3 }, { number: 99 }];

function user(overrides: Partial<SystemGroupUser> = {}): SystemGroupUser {
  return {
    id: "usr_1",
    status: "member",
    department: null,
    batchNumber: null,
    ...overrides,
  };
}

function position(
  position: UserPosition["position"],
  department: UserPosition["department"] = null,
): UserPosition {
  return { position, scope: "global", department };
}

function positionRow(
  userId: string,
  pos: UserPosition["position"],
  department: UserPosition["department"] = null,
): SystemGroupPositionRow {
  return { userId, position: pos, scope: "global", department };
}

function slugs(groups: { slug: string }[]): string[] {
  return groups.map((g) => g.slug).sort();
}

describe("getSystemGroupsForUser", () => {
  it("member with batch and department gets correct groups", () => {
    const u = user({
      status: "member",
      department: "partnerships",
      batchNumber: 7,
    });
    const result = slugs(getSystemGroupsForUser(u, [], BATCHES));
    assert.deepEqual(
      result,
      ["batch-7", "members", "partnerships-members"].sort(),
    );
  });

  it("supporting_alumni with batch and no department gets batch and members", () => {
    const u = user({
      status: "supporting_alumni",
      department: null,
      batchNumber: 3,
    });
    const result = slugs(getSystemGroupsForUser(u, [], BATCHES));
    assert.deepEqual(result, ["batch-3", "members"].sort());
  });

  it("president with no batch and no department gets board, legal-board, members", () => {
    const u = user({ status: "member", department: null, batchNumber: null });
    const positions = [position("president")];
    const result = slugs(getSystemGroupsForUser(u, positions, BATCHES));
    assert.deepEqual(result, ["board", "legal-board", "members"].sort());
  });

  it("department_head for events gets board, events, events-members, members", () => {
    const u = user({
      status: "member",
      department: "events",
      batchNumber: null,
    });
    const positions = [position("department_head", "events")];
    const result = slugs(getSystemGroupsForUser(u, positions, BATCHES));
    assert.deepEqual(
      result,
      ["board", "events", "events-members", "members"].sort(),
    );
  });

  it("vice_president gets board, legal-board, members", () => {
    const u = user({ status: "member", department: null, batchNumber: null });
    const positions = [position("vice_president")];
    const result = slugs(getSystemGroupsForUser(u, positions, BATCHES));
    assert.deepEqual(result, ["board", "legal-board", "members"].sort());
  });

  it("head_of_finance gets board, legal-board, members", () => {
    const u = user({ status: "member", department: null, batchNumber: null });
    const positions = [position("head_of_finance")];
    const result = slugs(getSystemGroupsForUser(u, positions, BATCHES));
    assert.deepEqual(result, ["board", "legal-board", "members"].sort());
  });

  it("onboarding member gets onboarding-members and members", () => {
    const u = user({
      status: "onboarding",
      department: null,
      batchNumber: null,
    });
    const result = slugs(getSystemGroupsForUser(u, [], BATCHES));
    assert.deepEqual(result, ["members", "onboarding-members"].sort());
  });

  it("cancelled user gets no groups", () => {
    const u = user({
      status: "cancelled",
      department: "operations",
      batchNumber: 7,
    });
    const result = getSystemGroupsForUser(u, [], BATCHES);
    assert.equal(result.length, 0);
  });

  it("alumni user gets no groups", () => {
    const u = user({ status: "alumni", department: "people", batchNumber: 3 });
    const result = getSystemGroupsForUser(u, [], BATCHES);
    assert.equal(result.length, 0);
  });

  it("user with null batchNumber gets no batch group", () => {
    const u = user({ status: "member", department: null, batchNumber: null });
    const result = getSystemGroupsForUser(u, [], BATCHES);
    assert.ok(!result.some((g) => g.slug.startsWith("batch-")));
  });
});

describe("getMembersOfSystemGroup", () => {
  it("returns empty array for unknown slug", () => {
    const result = getMembersOfSystemGroup("nonexistent", [user()], []);
    assert.deepEqual(result, []);
  });

  it("returns empty array when no users", () => {
    const result = getMembersOfSystemGroup("members", [], []);
    assert.deepEqual(result, []);
  });

  it("filters members@ group correctly", () => {
    const u1 = user({ id: "u1", status: "member" });
    const u2 = user({ id: "u2", status: "cancelled" });
    const u3 = user({ id: "u3", status: "supporting_alumni" });
    const result = getMembersOfSystemGroup("members", [u1, u2, u3], []);
    assert.deepEqual(result.map((u) => u.id).sort(), ["u1", "u3"]);
  });

  it("filters board@ group using positions", () => {
    const u1 = user({ id: "u1", status: "member" });
    const u2 = user({ id: "u2", status: "member" });
    const positions: SystemGroupPositionRow[] = [
      positionRow("u1", "president"),
    ];
    const result = getMembersOfSystemGroup("board", [u1, u2], positions);
    assert.deepEqual(
      result.map((u) => u.id),
      ["u1"],
    );
  });

  it("filters legal-board@ to only president/vp/finance", () => {
    const u1 = user({ id: "u1", status: "member" });
    const u2 = user({ id: "u2", status: "member" });
    const u3 = user({ id: "u3", status: "member" });
    const positions: SystemGroupPositionRow[] = [
      positionRow("u1", "president"),
      positionRow("u2", "department_head", "events"),
      positionRow("u3", "head_of_finance"),
    ];
    const result = getMembersOfSystemGroup(
      "legal-board",
      [u1, u2, u3],
      positions,
    );
    assert.deepEqual(result.map((u) => u.id).sort(), ["u1", "u3"]);
  });

  it("filters batch group by batchNumber and status", () => {
    const u1 = user({ id: "u1", status: "member", batchNumber: 7 });
    const u2 = user({ id: "u2", status: "cancelled", batchNumber: 7 });
    const u3 = user({ id: "u3", status: "member", batchNumber: 3 });
    const result = getMembersOfSystemGroup("batch-7", [u1, u2, u3], []);
    assert.deepEqual(
      result.map((u) => u.id),
      ["u1"],
    );
  });

  it("filters dept-members group by department and status", () => {
    const u1 = user({ id: "u1", status: "member", department: "growth" });
    const u2 = user({ id: "u2", status: "alumni", department: "growth" });
    const u3 = user({ id: "u3", status: "member", department: "people" });
    const result = getMembersOfSystemGroup("growth-members", [u1, u2, u3], []);
    assert.deepEqual(
      result.map((u) => u.id),
      ["u1"],
    );
  });
});

describe("isSystemGroupSlug", () => {
  it("recognises static group slugs", () => {
    assert.ok(isSystemGroupSlug("members", []));
    assert.ok(isSystemGroupSlug("board", []));
    assert.ok(isSystemGroupSlug("legal-board", []));
    assert.ok(isSystemGroupSlug("onboarding-members", []));
  });

  it("recognises department group slugs", () => {
    assert.ok(isSystemGroupSlug("partnerships", []));
    assert.ok(isSystemGroupSlug("events-members", []));
  });

  it("recognises batch slugs when batch is in list", () => {
    assert.ok(isSystemGroupSlug("batch-99", [{ number: 99 }]));
  });

  it("rejects batch slug not in batch list", () => {
    assert.ok(!isSystemGroupSlug("batch-99", []));
  });

  it("rejects unknown slugs", () => {
    assert.ok(!isSystemGroupSlug("it", []));
    assert.ok(!isSystemGroupSlug("finance", []));
    assert.ok(!isSystemGroupSlug("unknown-group", []));
  });
});

describe("getSystemGroupBySlug", () => {
  it("returns metadata for a static group", () => {
    const group = getSystemGroupBySlug("members");
    assert.equal(group?.slug, "members");
    assert.equal(group?.googleGroupEmail, "members@start-berlin.com");
  });

  it("returns metadata for a batch group without batches list", () => {
    const group = getSystemGroupBySlug("batch-42");
    assert.equal(group?.slug, "batch-42");
    assert.equal(group?.googleGroupEmail, "batch-42@start-berlin.com");
  });

  it("returns undefined for unknown slug", () => {
    assert.equal(getSystemGroupBySlug("nonexistent"), undefined);
  });
});

describe("getAllSystemGroupSlugs", () => {
  it("includes static, department, and batch slugs", () => {
    const slugs = getAllSystemGroupSlugs([{ number: 1 }, { number: 2 }]);
    assert.ok(slugs.includes("members"));
    assert.ok(slugs.includes("board"));
    assert.ok(slugs.includes("partnerships"));
    assert.ok(slugs.includes("events-members"));
    assert.ok(slugs.includes("batch-1"));
    assert.ok(slugs.includes("batch-2"));
    assert.ok(!slugs.includes("batch-3"));
  });
});
