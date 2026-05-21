import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OrgChartUser } from "@/db/people";
import type { Department } from "@/db/schema/auth";
import { applyFilters, buildOrgChart } from "@/lib/org-chart";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeUser(
  overrides: Partial<OrgChartUser> & Pick<OrgChartUser, "id">,
): OrgChartUser {
  return {
    firstName: "First",
    lastName: "Last",
    image: null,
    department: null,
    batchNumber: null,
    status: "member",
    positions: [],
    ...overrides,
  };
}

const president = makeUser({
  id: "usr_president",
  firstName: "Alice",
  batchNumber: 1,
  positions: [{ position: "president", scope: "global", department: null }],
});

const vp = makeUser({
  id: "usr_vp",
  firstName: "Bob",
  batchNumber: 2,
  positions: [
    { position: "vice_president", scope: "global", department: null },
  ],
});

const hof = makeUser({
  id: "usr_hof",
  firstName: "Carol",
  batchNumber: 1,
  positions: [
    { position: "head_of_finance", scope: "global", department: null },
  ],
});

const eventsHead = makeUser({
  id: "usr_events_head",
  firstName: "Dana",
  batchNumber: 3,
  department: "events",
  positions: [
    {
      position: "department_head",
      scope: "department",
      department: "events",
    },
  ],
});

const eventsMember1 = makeUser({
  id: "usr_events_m1",
  firstName: "Evan",
  batchNumber: 3,
  department: "events",
});

const eventsMember2 = makeUser({
  id: "usr_events_m2",
  firstName: "Faye",
  batchNumber: 5,
  department: "events",
});

const growthHead = makeUser({
  id: "usr_growth_head",
  firstName: "Grace",
  batchNumber: 4,
  department: "growth",
  positions: [
    {
      position: "department_head",
      scope: "department",
      department: "growth",
    },
  ],
});

const growthMember = makeUser({
  id: "usr_growth_m1",
  firstName: "Hal",
  batchNumber: 4,
  department: "growth",
});

// ─── buildOrgChart ────────────────────────────────────────────────────────────

describe("buildOrgChart", () => {
  it("places president, VP, and HoF as officer nodes at y=0", () => {
    const { nodes } = buildOrgChart([president, vp, hof]);
    const officers = nodes.filter((n) => n.type === "officer");
    assert.equal(officers.length, 3);
    for (const node of officers) {
      assert.equal(node.position.y, 0);
    }
    assert.ok(officers.find((n) => n.id === "officer-president"));
    assert.ok(officers.find((n) => n.id === "officer-vice_president"));
    assert.ok(officers.find((n) => n.id === "officer-head_of_finance"));
  });

  it("produces one dept header node per department in DEPARTMENT_IDS", () => {
    const { nodes } = buildOrgChart([]);
    const headers = nodes.filter((n) => n.type === "deptHeader");
    const DEPARTMENT_IDS = [
      "partnerships",
      "operations",
      "community",
      "growth",
      "events",
    ] as const;
    assert.equal(headers.length, DEPARTMENT_IDS.length);
    for (const deptId of DEPARTMENT_IDS) {
      assert.ok(
        headers.find((n) => n.id === `dept-header-${deptId}`),
        `missing dept header for ${deptId}`,
      );
    }
  });

  it("places dept head as deptHead node with role badge data", () => {
    const { nodes } = buildOrgChart([eventsHead]);
    const head = nodes.find((n) => n.id === "dept-head-events");
    assert.ok(head);
    assert.equal(head.type, "deptHead");
    assert.equal(head.data.userId, "usr_events_head");
    assert.equal(head.data.roleLabel, "Department Head");
    assert.equal(head.data.departmentId, "events");
  });

  it("places department members as member nodes below dept head", () => {
    const { nodes } = buildOrgChart([eventsHead, eventsMember1, eventsMember2]);
    const members = nodes.filter((n) => n.type === "member");
    assert.equal(members.length, 2);
    assert.ok(members.find((n) => n.data.userId === "usr_events_m1"));
    assert.ok(members.find((n) => n.data.userId === "usr_events_m2"));
    const deptHead = nodes.find((n) => n.id === "dept-head-events");
    assert.ok(deptHead, "dept-head-events node should exist");
    for (const m of members) {
      assert.ok(m.position.y > deptHead.position.y);
    }
  });

  it("creates edges from dept head to each member", () => {
    const { edges } = buildOrgChart([eventsHead, eventsMember1, eventsMember2]);
    const eventEdges = edges.filter((e) => e.source === "dept-head-events");
    assert.equal(eventEdges.length, 2);
    const targets = new Set(eventEdges.map((e) => e.target));
    assert.ok(targets.has("member-usr_events_m1"));
    assert.ok(targets.has("member-usr_events_m2"));
  });

  it("excludes global officers from dept sections even when user.department is set", () => {
    const presidentWithDept = makeUser({
      id: "usr_president",
      department: "events",
      positions: [{ position: "president", scope: "global", department: null }],
    });
    const { nodes } = buildOrgChart([presidentWithDept]);
    const officerNode = nodes.find((n) => n.id === "officer-president");
    assert.ok(officerNode);
    const memberNode = nodes.find(
      (n) => n.type === "member" && n.data.userId === "usr_president",
    );
    assert.equal(memberNode, undefined);
  });

  it("excludes users with no department and no position", () => {
    const nobody = makeUser({ id: "usr_nobody", department: null });
    const { nodes } = buildOrgChart([nobody]);
    const personNodes = nodes.filter(
      (n) =>
        n.type === "member" || n.type === "officer" || n.type === "deptHead",
    );
    assert.equal(personNodes.length, 0);
  });

  it("produces no dept head node when no head is assigned to a dept", () => {
    const { nodes } = buildOrgChart([]);
    const eventsHead = nodes.find((n) => n.id === "dept-head-events");
    assert.equal(eventsHead, undefined);
  });

  it("produces dept header but no edges when dept has a head but no members", () => {
    const { nodes, edges } = buildOrgChart([eventsHead]);
    const header = nodes.find((n) => n.id === "dept-header-events");
    assert.ok(header);
    const eventsEdges = edges.filter(
      (e) => e.source.includes("events") || e.target.includes("events"),
    );
    assert.equal(eventsEdges.length, 0);
  });

  it("produces no edges when dept has members but no head", () => {
    const { nodes, edges } = buildOrgChart([eventsMember1]);
    const memberNode = nodes.find((n) => n.data.userId === "usr_events_m1");
    assert.ok(memberNode);
    assert.equal(edges.length, 0);
  });

  it("does not duplicate dept head as a member node", () => {
    const { nodes } = buildOrgChart([eventsHead, eventsMember1]);
    const memberNodes = nodes.filter((n) => n.type === "member");
    assert.ok(!memberNodes.find((n) => n.data.userId === "usr_events_head"));
  });

  it("attaches role badge to officer nodes", () => {
    const { nodes } = buildOrgChart([president, vp, hof]);
    const p = nodes.find((n) => n.id === "officer-president");
    const v = nodes.find((n) => n.id === "officer-vice_president");
    const h = nodes.find((n) => n.id === "officer-head_of_finance");
    assert.equal(p?.data.roleLabel, "President");
    assert.equal(v?.data.roleLabel, "Vice President");
    assert.equal(h?.data.roleLabel, "Head of Finance");
  });

  it("stores departmentId on member nodes for collapse filtering", () => {
    const { nodes } = buildOrgChart([eventsMember1]);
    const member = nodes.find((n) => n.data.userId === "usr_events_m1");
    assert.equal(member?.data.departmentId, "events");
  });
});

// ─── applyFilters ─────────────────────────────────────────────────────────────

describe("applyFilters", () => {
  const allUsers = [
    president,
    vp,
    hof,
    eventsHead,
    eventsMember1,
    eventsMember2,
    growthHead,
    growthMember,
  ];

  function chart() {
    return buildOrgChart(allUsers);
  }

  it("with no filters returns all nodes and edges", () => {
    const { nodes, edges } = chart();
    const { nodes: fn, edges: fe } = applyFilters(nodes, edges, {
      batchFilter: null,
      collapsedDepts: new Set(),
    });
    assert.equal(fn.length, nodes.length);
    assert.equal(fe.length, edges.length);
  });

  it("dept header nodes are always visible regardless of batch filter", () => {
    const { nodes, edges } = chart();
    const { nodes: fn } = applyFilters(nodes, edges, {
      batchFilter: 99,
      collapsedDepts: new Set(),
    });
    const headers = fn.filter((n) => n.type === "deptHeader");
    const DEPT_COUNT = 5;
    assert.equal(headers.length, DEPT_COUNT);
  });

  it("officer nodes are always visible regardless of batch filter", () => {
    const { nodes, edges } = chart();
    const { nodes: fn } = applyFilters(nodes, edges, {
      batchFilter: 99,
      collapsedDepts: new Set(),
    });
    const officers = fn.filter((n) => n.type === "officer");
    assert.equal(officers.length, 3);
  });

  it("batch filter hides dept head cards that do not match", () => {
    const { nodes, edges } = chart();
    // eventsHead is batch 3, growthHead is batch 4
    const { nodes: fn } = applyFilters(nodes, edges, {
      batchFilter: 3,
      collapsedDepts: new Set(),
    });
    const eventsHeadNode = fn.find((n) => n.id === "dept-head-events");
    const growthHeadNode = fn.find((n) => n.id === "dept-head-growth");
    assert.ok(eventsHeadNode, "events head (batch 3) should be visible");
    assert.equal(
      growthHeadNode,
      undefined,
      "growth head (batch 4) should be hidden",
    );
  });

  it("batch filter hides member cards that do not match", () => {
    const { nodes, edges } = chart();
    // eventsMember1 batch=3, eventsMember2 batch=5
    const { nodes: fn } = applyFilters(nodes, edges, {
      batchFilter: 3,
      collapsedDepts: new Set(),
    });
    assert.ok(
      fn.find((n) => n.data.userId === "usr_events_m1"),
      "batch 3 member visible",
    );
    assert.equal(
      fn.find((n) => n.data.userId === "usr_events_m2"),
      undefined,
      "batch 5 member hidden",
    );
  });

  it("batch filter removes edges whose source is filtered out", () => {
    const { nodes, edges } = chart();
    // growthHead is batch 4; filter to batch 3 removes growthHead → no growth edges
    const { edges: fe } = applyFilters(nodes, edges, {
      batchFilter: 3,
      collapsedDepts: new Set(),
    });
    const growthEdges = fe.filter((e) => e.source === "dept-head-growth");
    assert.equal(growthEdges.length, 0);
  });

  it("batch filter removes edges whose target is filtered out", () => {
    const { nodes, edges } = chart();
    // eventsMember2 is batch 5; filter to batch 3 → edge to member2 gone
    const { edges: fe } = applyFilters(nodes, edges, {
      batchFilter: 3,
      collapsedDepts: new Set(),
    });
    const toMember2 = fe.find((e) => e.target === "member-usr_events_m2");
    assert.equal(toMember2, undefined);
  });

  it("collapsedDepts hides member nodes for the collapsed dept", () => {
    const { nodes, edges } = chart();
    const { nodes: fn } = applyFilters(nodes, edges, {
      batchFilter: null,
      collapsedDepts: new Set(["events"] as Department[]),
    });
    const eventsMembers = fn.filter(
      (n) => n.type === "member" && n.data.departmentId === "events",
    );
    assert.equal(eventsMembers.length, 0);
  });

  it("collapsedDepts keeps dept header and dept head visible", () => {
    const { nodes, edges } = chart();
    const { nodes: fn } = applyFilters(nodes, edges, {
      batchFilter: null,
      collapsedDepts: new Set(["events"] as Department[]),
    });
    assert.ok(fn.find((n) => n.id === "dept-header-events"));
    assert.ok(fn.find((n) => n.id === "dept-head-events"));
  });

  it("collapsedDepts removes edges to hidden member nodes", () => {
    const { nodes, edges } = chart();
    const { edges: fe } = applyFilters(nodes, edges, {
      batchFilter: null,
      collapsedDepts: new Set(["events"] as Department[]),
    });
    const eventsEdges = fe.filter((e) => e.source === "dept-head-events");
    assert.equal(eventsEdges.length, 0);
  });

  it("combining batch filter and collapsed dept hides members if either condition applies", () => {
    const { nodes, edges } = chart();
    // batch 3 and events collapsed: eventsMember1 (batch 3) hidden by collapse, eventsMember2 (batch 5) hidden by batch
    const { nodes: fn } = applyFilters(nodes, edges, {
      batchFilter: 3,
      collapsedDepts: new Set(["events"] as Department[]),
    });
    const eventsMembers = fn.filter(
      (n) => n.type === "member" && n.data.departmentId === "events",
    );
    assert.equal(eventsMembers.length, 0);
  });

  it("uncollapsed dept in same run still shows its members", () => {
    const { nodes, edges } = chart();
    // collapse events only; growth members should still appear
    const { nodes: fn } = applyFilters(nodes, edges, {
      batchFilter: null,
      collapsedDepts: new Set(["events"] as Department[]),
    });
    const growthMembers = fn.filter(
      (n) => n.type === "member" && n.data.departmentId === "growth",
    );
    assert.equal(growthMembers.length, 1);
  });
});
