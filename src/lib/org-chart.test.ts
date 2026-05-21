import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OrgChartUser } from "@/db/people";
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

  it("produces one deptPlaceholder node per department in DEPARTMENT_IDS", () => {
    const { nodes } = buildOrgChart([]);
    const placeholders = nodes.filter((n) => n.type === "deptPlaceholder");
    const DEPARTMENT_IDS = [
      "partnerships",
      "operations",
      "community",
      "growth",
      "events",
    ] as const;
    assert.equal(placeholders.length, DEPARTMENT_IDS.length);
    for (const deptId of DEPARTMENT_IDS) {
      assert.ok(
        placeholders.find((n) => n.id === `dept-placeholder-${deptId}`),
        `missing placeholder for ${deptId}`,
      );
    }
  });

  it("placeholder has hasHead=false when no head is assigned", () => {
    const { nodes } = buildOrgChart([]);
    const placeholder = nodes.find((n) => n.id === "dept-placeholder-events");
    assert.ok(placeholder);
    assert.equal(placeholder.data.hasHead, false);
  });

  it("placeholder has hasHead=true when a dept head is assigned", () => {
    const { nodes } = buildOrgChart([eventsHead]);
    const placeholder = nodes.find((n) => n.id === "dept-placeholder-events");
    assert.ok(placeholder);
    assert.equal(placeholder.data.hasHead, true);
  });

  it("places dept head as deptHead node with correct role label", () => {
    const { nodes } = buildOrgChart([eventsHead]);
    const head = nodes.find((n) => n.id === "dept-head-events");
    assert.ok(head);
    assert.equal(head.type, "deptHead");
    assert.equal(head.data.userId, "usr_events_head");
    assert.equal(head.data.roleLabel, "Head of Events");
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

  it("produces placeholder node but no edges when dept has a head but no members", () => {
    const { nodes, edges } = buildOrgChart([eventsHead]);
    const placeholder = nodes.find((n) => n.id === "dept-placeholder-events");
    assert.ok(placeholder);
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

  it("attaches role label to officer nodes", () => {
    const { nodes } = buildOrgChart([president, vp, hof]);
    const p = nodes.find((n) => n.id === "officer-president");
    const v = nodes.find((n) => n.id === "officer-vice_president");
    const h = nodes.find((n) => n.id === "officer-head_of_finance");
    assert.equal(p?.data.roleLabel, "President");
    assert.equal(v?.data.roleLabel, "Vice President");
    assert.equal(h?.data.roleLabel, "Head of Finance");
  });

  it("stores departmentId on member nodes", () => {
    const { nodes } = buildOrgChart([eventsMember1]);
    const member = nodes.find((n) => n.data.userId === "usr_events_m1");
    assert.equal(member?.data.departmentId, "events");
  });

  it("stores status on member nodes", () => {
    const onboardingMember = makeUser({
      id: "usr_onboarding",
      department: "events",
      status: "onboarding",
    });
    const { nodes } = buildOrgChart([onboardingMember]);
    const member = nodes.find((n) => n.data.userId === "usr_onboarding");
    assert.equal(member?.data.status, "onboarding");
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

  it("with no filters returns all person nodes and all edges", () => {
    const { nodes, edges } = chart();
    const { nodes: fn, edges: fe } = applyFilters(nodes, edges, {
      batchFilter: null,
    });
    // Placeholder nodes for depts with a visible head are hidden; others visible
    const personNodes = nodes.filter(
      (n) =>
        n.type === "officer" || n.type === "deptHead" || n.type === "member",
    );
    assert.ok(fn.length >= personNodes.length);
    assert.equal(fe.length, edges.length);
  });

  it("placeholder nodes are always visible regardless of batch filter", () => {
    const { nodes, edges } = chart();
    const { nodes: fn } = applyFilters(nodes, edges, {
      batchFilter: 99,
    });
    const placeholders = fn.filter((n) => n.type === "deptPlaceholder");
    const DEPT_COUNT = 5;
    assert.equal(placeholders.length, DEPT_COUNT);
  });

  it("officer nodes are always visible regardless of batch filter", () => {
    const { nodes, edges } = chart();
    const { nodes: fn } = applyFilters(nodes, edges, {
      batchFilter: 99,
    });
    const officers = fn.filter((n) => n.type === "officer");
    assert.equal(officers.length, 3);
  });

  it("batch filter hides dept head cards that do not match", () => {
    const { nodes, edges } = chart();
    // eventsHead is batch 3, growthHead is batch 4
    const { nodes: fn } = applyFilters(nodes, edges, {
      batchFilter: 3,
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
    });
    const growthEdges = fe.filter((e) => e.source === "dept-head-growth");
    assert.equal(growthEdges.length, 0);
  });

  it("batch filter removes edges whose target is filtered out", () => {
    const { nodes, edges } = chart();
    // eventsMember2 is batch 5; filter to batch 3 → edge to member2 gone
    const { edges: fe } = applyFilters(nodes, edges, {
      batchFilter: 3,
    });
    const toMember2 = fe.find((e) => e.target === "member-usr_events_m2");
    assert.equal(toMember2, undefined);
  });

  it("placeholder is visible when dept head is filtered out by batch", () => {
    const { nodes, edges } = chart();
    // growthHead is batch 4; filter to batch 3 hides it → placeholder visible
    const { nodes: fn } = applyFilters(nodes, edges, {
      batchFilter: 3,
    });
    const growthPlaceholder = fn.find(
      (n) => n.id === "dept-placeholder-growth",
    );
    assert.ok(
      growthPlaceholder,
      "growth placeholder should be visible when head is filtered",
    );
  });

  it("placeholder is hidden when dept head is visible", () => {
    const { nodes, edges } = chart();
    // eventsHead is batch 3; filter to batch 3 keeps it → placeholder hidden
    const { nodes: fn } = applyFilters(nodes, edges, {
      batchFilter: 3,
    });
    const eventsPlaceholder = fn.find(
      (n) => n.id === "dept-placeholder-events",
    );
    assert.equal(
      eventsPlaceholder,
      undefined,
      "events placeholder should be hidden when head is visible",
    );
  });

  it("placeholder is visible for dept with no head regardless of filter", () => {
    const noHeadUsers = [eventsMember1];
    const { nodes, edges } = buildOrgChart(noHeadUsers);
    const { nodes: fn } = applyFilters(nodes, edges, { batchFilter: 3 });
    const placeholder = fn.find((n) => n.id === "dept-placeholder-events");
    assert.ok(placeholder, "placeholder always visible when dept has no head");
  });
});
