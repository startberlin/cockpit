import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OrgChartUser } from "@/db/people";
import { buildOrgChart } from "@/lib/org-chart";

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

const eventsCoHead = makeUser({
  id: "usr_events_cohead",
  firstName: "Iris",
  batchNumber: 3,
  department: "events",
  positions: [
    {
      position: "department_co_head",
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
      "people",
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

  it("dept head is not duplicated as a dept member", () => {
    const { departments } = buildOrgChart([eventsHead, eventsMember1]);
    const events = departments.find((d) => d.departmentId === "events");
    assert.ok(!events?.members.find((m) => m.userId === "usr_events_head"));
  });

  it("dept co-head appears in coHead field with correct roleLabel", () => {
    const { departments } = buildOrgChart([eventsHead, eventsCoHead]);
    const events = departments.find((d) => d.departmentId === "events");
    assert.ok(events);
    assert.equal(events.head?.userId, "usr_events_head");
    assert.equal(events.coHead?.userId, "usr_events_cohead");
    assert.equal(events.coHead?.roleLabel, "Co-Head of Events");
  });

  it("dept co-head is not duplicated as a dept member", () => {
    const { departments } = buildOrgChart([
      eventsHead,
      eventsCoHead,
      eventsMember1,
    ]);
    const events = departments.find((d) => d.departmentId === "events");
    assert.ok(!events?.members.find((m) => m.userId === "usr_events_cohead"));
    assert.ok(events?.members.find((m) => m.userId === "usr_events_m1"));
  });

  it("coHead is null when no co-head is assigned", () => {
    const { departments } = buildOrgChart([eventsHead]);
    const events = departments.find((d) => d.departmentId === "events");
    assert.equal(events?.coHead, null);
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
