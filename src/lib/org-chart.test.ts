import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OrgChartUser } from "@/db/people";
import { applyBatchFilter, buildOrgChart } from "@/lib/org-chart";

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
    { position: "department_head", scope: "department", department: "events" },
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
    { position: "department_head", scope: "department", department: "growth" },
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
  it("returns officers in president → VP → HoF order", () => {
    const { officers } = buildOrgChart([hof, vp, president]);
    assert.equal(officers.length, 3);
    assert.equal(officers[0].userId, "usr_president");
    assert.equal(officers[1].userId, "usr_vp");
    assert.equal(officers[2].userId, "usr_hof");
  });

  it("attaches correct roleLabel to each officer", () => {
    const { officers } = buildOrgChart([president, vp, hof]);
    assert.equal(
      officers.find((o) => o.userId === "usr_president")?.roleLabel,
      "President",
    );
    assert.equal(
      officers.find((o) => o.userId === "usr_vp")?.roleLabel,
      "Vice President",
    );
    assert.equal(
      officers.find((o) => o.userId === "usr_hof")?.roleLabel,
      "Head of Finance",
    );
  });

  it("returns one department entry per DEPARTMENT_IDS entry", () => {
    const { departments } = buildOrgChart([]);
    const DEPARTMENT_IDS = [
      "partnerships",
      "operations",
      "community",
      "growth",
      "events",
    ] as const;
    assert.equal(departments.length, DEPARTMENT_IDS.length);
    for (const deptId of DEPARTMENT_IDS) {
      assert.ok(
        departments.find((d) => d.departmentId === deptId),
        `missing dept ${deptId}`,
      );
    }
  });

  it("dept head appears in head field with correct roleLabel", () => {
    const { departments } = buildOrgChart([eventsHead]);
    const events = departments.find((d) => d.departmentId === "events");
    assert.ok(events);
    assert.equal(events.head?.userId, "usr_events_head");
    assert.equal(events.head?.roleLabel, "Head of Events");
  });

  it("headExists is true when head assigned, false when none", () => {
    const { departments } = buildOrgChart([eventsHead]);
    const events = departments.find((d) => d.departmentId === "events");
    const growth = departments.find((d) => d.departmentId === "growth");
    assert.equal(events?.headExists, true);
    assert.equal(growth?.headExists, false);
  });

  it("dept head is not duplicated as a dept member", () => {
    const { departments } = buildOrgChart([eventsHead, eventsMember1]);
    const events = departments.find((d) => d.departmentId === "events");
    assert.ok(!events?.members.find((m) => m.userId === "usr_events_head"));
  });

  it("global officer with a department is not added to dept members", () => {
    const presidentWithDept = makeUser({
      id: "usr_president",
      department: "events",
      positions: [{ position: "president", scope: "global", department: null }],
    });
    const { officers, departments } = buildOrgChart([presidentWithDept]);
    assert.equal(officers.length, 1);
    const events = departments.find((d) => d.departmentId === "events");
    assert.equal(events?.members.length, 0);
  });

  it("user with no department and no position is excluded entirely", () => {
    const nobody = makeUser({ id: "usr_nobody" });
    const { officers, departments } = buildOrgChart([nobody]);
    assert.equal(officers.length, 0);
    assert.ok(
      departments.every((d) => d.members.length === 0 && d.head === null),
    );
  });

  it("members carry status field", () => {
    const onboarding = makeUser({
      id: "usr_ob",
      department: "events",
      status: "onboarding",
    });
    const { departments } = buildOrgChart([onboarding]);
    const events = departments.find((d) => d.departmentId === "events");
    assert.equal(events?.members[0]?.status, "onboarding");
  });
});

// ─── applyBatchFilter ─────────────────────────────────────────────────────────

describe("applyBatchFilter", () => {
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

  it("null filter returns data unchanged", () => {
    const data = chart();
    const filtered = applyBatchFilter(data, null);
    assert.equal(filtered.officers.length, data.officers.length);
    assert.equal(filtered.departments.length, data.departments.length);
    const events = filtered.departments.find(
      (d) => d.departmentId === "events",
    );
    assert.equal(events?.members.length, 2);
  });

  it("always includes all officers regardless of batch", () => {
    const { officers } = applyBatchFilter(chart(), 99);
    assert.equal(officers.length, 3);
  });

  it("hides dept head whose batch does not match", () => {
    // eventsHead batch=3, growthHead batch=4
    const { departments } = applyBatchFilter(chart(), 3);
    const events = departments.find((d) => d.departmentId === "events");
    const growth = departments.find((d) => d.departmentId === "growth");
    assert.ok(events?.head, "events head (batch 3) should be visible");
    assert.equal(growth?.head, null, "growth head (batch 4) should be null");
  });

  it("headExists stays true when head is filtered out", () => {
    const { departments } = applyBatchFilter(chart(), 3);
    const growth = departments.find((d) => d.departmentId === "growth");
    assert.equal(growth?.head, null);
    assert.equal(growth?.headExists, true);
  });

  it("filters members to matching batch only", () => {
    // eventsMember1 batch=3, eventsMember2 batch=5
    const { departments } = applyBatchFilter(chart(), 3);
    const events = departments.find((d) => d.departmentId === "events");
    assert.equal(events?.members.length, 1);
    assert.equal(events?.members[0]?.userId, "usr_events_m1");
  });

  it("removes all members when no member matches the batch", () => {
    const { departments } = applyBatchFilter(chart(), 99);
    assert.ok(departments.every((d) => d.members.length === 0));
  });
});
