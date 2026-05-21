import type { OrgChartUser } from "@/db/people";
import type { Department } from "@/db/schema/auth";
import { DEPARTMENT_IDS, DEPARTMENT_NAMES } from "@/lib/departments";

// ─── Layout constants ─────────────────────────────────────────────────────────

export const CARD_W = 200;
export const CARD_H = 88;
const DEPT_HEADER_H = 44;
const H_GAP = 20;
const V_GAP = 64;
const DEPT_COL_GAP = 40;

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrgNodeType = "officer" | "deptHeader" | "deptHead" | "member";

export interface OrgNodeData {
  userId?: string;
  firstName?: string;
  lastName?: string;
  image?: string | null;
  batchNumber?: number | null;
  roleLabel?: string;
  departmentId?: Department;
  departmentName?: string;
}

export interface OrgChartNode {
  id: string;
  type: OrgNodeType;
  position: { x: number; y: number };
  data: OrgNodeData;
}

export interface OrgChartEdge {
  id: string;
  source: string;
  target: string;
}

export interface OrgChartData {
  nodes: OrgChartNode[];
  edges: OrgChartEdge[];
}

export interface FilterOptions {
  batchFilter: number | null;
  collapsedDepts: ReadonlySet<Department>;
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
  department_head: "Department Head",
};

// Row Y positions
const OFFICER_ROW_Y = 0;
const DEPT_HEADER_ROW_Y = CARD_H + V_GAP * 2;
const DEPT_HEAD_ROW_Y = DEPT_HEADER_ROW_Y + DEPT_HEADER_H + V_GAP;
const MEMBER_ROW_Y = DEPT_HEAD_ROW_Y + CARD_H + V_GAP;

// ─── Build ────────────────────────────────────────────────────────────────────

export function buildOrgChart(users: OrgChartUser[]): OrgChartData {
  const nodes: OrgChartNode[] = [];
  const edges: OrgChartEdge[] = [];

  // Step 1: classify users
  const officerByPosition = new Map<string, OrgChartUser>();
  const officerIds = new Set<string>();
  const deptHeadByDept = new Map<Department, OrgChartUser>();

  for (const user of users) {
    for (const pos of user.positions) {
      if (pos.scope === "global") {
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
      }
    }
  }

  const deptHeadIds = new Set(
    Array.from(deptHeadByDept.values()).map((u) => u.id),
  );

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

  // Step 2: officer nodes (top row, no edges)
  const presentOfficerPositions = GLOBAL_POSITION_ORDER.filter((p) =>
    officerByPosition.has(p),
  );

  for (let i = 0; i < presentOfficerPositions.length; i++) {
    const pos = presentOfficerPositions[i];
    const user = officerByPosition.get(pos)!;
    nodes.push({
      id: `officer-${pos}`,
      type: "officer",
      position: { x: i * (CARD_W + H_GAP), y: OFFICER_ROW_Y },
      data: {
        userId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        image: user.image,
        batchNumber: user.batchNumber,
        roleLabel: ROLE_LABELS[pos],
      },
    });
  }

  // Step 3: department columns
  let colX = 0;

  for (const deptId of DEPARTMENT_IDS) {
    const members = membersByDept.get(deptId) ?? [];
    const numMembers = members.length;
    const colWidth = Math.max(
      CARD_W,
      numMembers * CARD_W + Math.max(0, numMembers - 1) * H_GAP,
    );
    const centerX = colX + Math.floor((colWidth - CARD_W) / 2);

    // Dept header node (always visible)
    nodes.push({
      id: `dept-header-${deptId}`,
      type: "deptHeader",
      position: { x: centerX, y: DEPT_HEADER_ROW_Y },
      data: {
        departmentId: deptId,
        departmentName: DEPARTMENT_NAMES[deptId],
      },
    });

    // Dept head card (if assigned)
    const deptHead = deptHeadByDept.get(deptId);
    const deptHeadNodeId = `dept-head-${deptId}`;

    if (deptHead) {
      nodes.push({
        id: deptHeadNodeId,
        type: "deptHead",
        position: { x: centerX, y: DEPT_HEAD_ROW_Y },
        data: {
          userId: deptHead.id,
          firstName: deptHead.firstName,
          lastName: deptHead.lastName,
          image: deptHead.image,
          batchNumber: deptHead.batchNumber,
          roleLabel: ROLE_LABELS.department_head,
          departmentId: deptId,
        },
      });
    }

    // Member cards and edges
    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      const memberId = `member-${member.id}`;

      nodes.push({
        id: memberId,
        type: "member",
        position: {
          x: colX + i * (CARD_W + H_GAP),
          y: MEMBER_ROW_Y,
        },
        data: {
          userId: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          image: member.image,
          batchNumber: member.batchNumber,
          departmentId: deptId,
        },
      });

      if (deptHead) {
        edges.push({
          id: `edge-${deptId}-${member.id}`,
          source: deptHeadNodeId,
          target: memberId,
        });
      }
    }

    colX += colWidth + DEPT_COL_GAP;
  }

  return { nodes, edges };
}

// ─── Filter ───────────────────────────────────────────────────────────────────

export function applyFilters(
  nodes: OrgChartNode[],
  edges: OrgChartEdge[],
  opts: FilterOptions,
): OrgChartData {
  const { batchFilter, collapsedDepts } = opts;

  const visibleNodes = nodes.filter((node) => {
    switch (node.type) {
      case "officer":
        return true;
      case "deptHeader":
        return true;
      case "deptHead": {
        if (batchFilter === null) return true;
        return node.data.batchNumber === batchFilter;
      }
      case "member": {
        const deptId = node.data.departmentId;
        if (deptId && collapsedDepts.has(deptId)) return false;
        if (batchFilter === null) return true;
        return node.data.batchNumber === batchFilter;
      }
      default:
        return true;
    }
  });

  const visibleIds = new Set(visibleNodes.map((n) => n.id));

  const visibleEdges = edges.filter(
    (e) => visibleIds.has(e.source) && visibleIds.has(e.target),
  );

  return { nodes: visibleNodes, edges: visibleEdges };
}
