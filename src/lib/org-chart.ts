import type { OrgChartUser } from "@/db/people";
import type { Department } from "@/db/schema/auth";
import { DEPARTMENT_IDS, DEPARTMENT_NAMES } from "@/lib/departments";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrgChartPerson {
  userId: string;
  firstName: string;
  lastName: string;
  image: string | null;
  batchNumber: number | null;
}

export interface OrgChartOfficer extends OrgChartPerson {
  roleLabel: string;
}

export interface OrgChartDeptHead extends OrgChartPerson {
  roleLabel: string;
}

export interface OrgChartMember extends OrgChartPerson {
  status: string;
}

export interface OrgChartDept {
  departmentId: Department;
  departmentName: string;
  head: OrgChartDeptHead | null;
  coHead: OrgChartDeptHead | null;
  members: OrgChartMember[];
}

export interface OrgChartData {
  officers: OrgChartOfficer[];
  departments: OrgChartDept[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GLOBAL_POSITION_ORDER = [
  "president",
  "vice_president",
  "head_of_finance",
] as const;

const ROLE_LABELS: Record<string, string> = {
  president: "President",
  vice_president: "Vice President",
  head_of_finance: "Head of Finance",
};

// ─── Build ────────────────────────────────────────────────────────────────────

export function buildOrgChart(users: OrgChartUser[]): OrgChartData {
  const officerByPosition = new Map<string, OrgChartUser>();
  const officerIds = new Set<string>();
  const deptHeadByDept = new Map<Department, OrgChartUser>();
  const deptCoHeadByDept = new Map<Department, OrgChartUser>();

  for (const user of users) {
    for (const pos of user.positions) {
      if (
        pos.scope === "global" &&
        (GLOBAL_POSITION_ORDER as readonly string[]).includes(pos.position)
      ) {
        officerIds.add(user.id);
        if (!officerByPosition.has(pos.position)) {
          officerByPosition.set(pos.position, user);
        }
      } else if (
        pos.scope === "department" &&
        pos.position === "department_head" &&
        pos.department
      ) {
        if (!deptHeadByDept.has(pos.department as Department)) {
          deptHeadByDept.set(pos.department as Department, user);
        }
      } else if (
        pos.scope === "department" &&
        pos.position === "department_co_head" &&
        pos.department
      ) {
        if (!deptCoHeadByDept.has(pos.department as Department)) {
          deptCoHeadByDept.set(pos.department as Department, user);
        }
      }
    }
  }

  const deptHeadIds = new Set(
    [
      ...Array.from(deptHeadByDept.values()),
      ...Array.from(deptCoHeadByDept.values()),
    ].map((u) => u.id),
  );

  const officers: OrgChartOfficer[] = GLOBAL_POSITION_ORDER.filter((p) =>
    officerByPosition.has(p),
  ).map((p) => {
    const user = officerByPosition.get(p) as OrgChartUser;
    return {
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      image: user.image,
      batchNumber: user.batchNumber,
      roleLabel: ROLE_LABELS[p],
    };
  });

  const membersByDept = new Map<Department, OrgChartUser[]>();
  for (const deptId of DEPARTMENT_IDS) {
    membersByDept.set(deptId, []);
  }

  for (const user of users) {
    if (officerIds.has(user.id)) continue;
    if (deptHeadIds.has(user.id)) continue;
    if (!user.department) continue;
    membersByDept.get(user.department as Department)?.push(user);
  }

  const departments: OrgChartDept[] = DEPARTMENT_IDS.map((deptId) => {
    const deptName = DEPARTMENT_NAMES[deptId];
    const headUser = deptHeadByDept.get(deptId);
    const head: OrgChartDeptHead | null = headUser
      ? {
          userId: headUser.id,
          firstName: headUser.firstName,
          lastName: headUser.lastName,
          image: headUser.image,
          batchNumber: headUser.batchNumber,
          roleLabel: `Head of ${deptName}`,
        }
      : null;

    const coHeadUser = deptCoHeadByDept.get(deptId);
    const coHead: OrgChartDeptHead | null = coHeadUser
      ? {
          userId: coHeadUser.id,
          firstName: coHeadUser.firstName,
          lastName: coHeadUser.lastName,
          image: coHeadUser.image,
          batchNumber: coHeadUser.batchNumber,
          roleLabel: `Co-Head of ${deptName}`,
        }
      : null;

    const members: OrgChartMember[] = (membersByDept.get(deptId) ?? []).map(
      (u) => ({
        userId: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        image: u.image,
        batchNumber: u.batchNumber,
        status: u.status,
      }),
    );

    return {
      departmentId: deptId,
      departmentName: deptName,
      head,
      coHead,
      members,
    };
  });

  return { officers, departments };
}
