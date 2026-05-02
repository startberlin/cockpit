import type { Department, Role, UserStatus } from "@/db/schema/auth";
import type { AccessGrant, OrganizationPosition } from "@/db/schema/authority";

export type PositionAssignment = {
  position: OrganizationPosition;
  scope: "global" | "department";
  department?: Department | null;
};

export type GrantAssignment = {
  grant: AccessGrant;
  scope: "global" | "department";
  department?: Department | null;
};

export interface UserAuthority {
  userId: string;
  status: UserStatus;
  department: Department | null;
  positions: PositionAssignment[];
  grants: GrantAssignment[];
}

export interface PermissionContext {
  targetDepartment?: Department | null;
}

interface PermissionRule {
  globalGrants?: AccessGrant[];
  globalPositions?: OrganizationPosition[];
  departmentPositions?: OrganizationPosition[];
}

export const PERMISSIONS = {
  "users.create": {
    globalGrants: ["admin"],
  },
  "users.import": {
    globalGrants: ["admin"],
  },
  "users.view_details": {
    globalGrants: ["admin"],
    globalPositions: ["department_head"],
    departmentPositions: ["department_head"],
  },
  "users.edit": {
    globalGrants: ["admin"],
    departmentPositions: ["department_head"],
  },
  "users.manage_authority": {
    globalGrants: ["admin"],
  },
  "users.complete_onboarding": {
    globalGrants: ["admin"],
    globalPositions: ["president", "vice_president", "head_of_finance"],
    departmentPositions: ["department_head"],
  },
  "membership.propose": {
    globalGrants: ["admin"],
    globalPositions: ["president", "vice_president", "head_of_finance"],
    departmentPositions: ["department_head"],
  },
  "membership.vote_resolution": {
    globalPositions: ["president", "vice_president", "head_of_finance"],
  },
  "membership.view_resolution": {
    globalGrants: ["admin"],
    globalPositions: ["president", "vice_president", "head_of_finance"],
  },
  "membership.manage_workflows": {
    globalGrants: ["admin"],
  },
  "groups.view_all": {
    globalGrants: ["admin"],
    globalPositions: ["president", "vice_president", "head_of_finance"],
    departmentPositions: ["department_head"],
  },
  "groups.create": {
    globalGrants: ["admin"],
  },
  "groups.manage_members": {
    globalGrants: ["admin"],
  },
} as const satisfies Record<string, PermissionRule>;

export type Action = keyof typeof PERMISSIONS;

function hasGlobalGrant(authority: UserAuthority, grants: AccessGrant[] = []) {
  return authority.grants.some(
    (assignment) =>
      assignment.scope === "global" && grants.includes(assignment.grant),
  );
}

function hasGlobalPosition(
  authority: UserAuthority,
  positions: OrganizationPosition[] = [],
) {
  return authority.positions.some(
    (assignment) =>
      assignment.scope === "global" && positions.includes(assignment.position),
  );
}

function matchesDepartment(
  assignmentDepartment: Department | null | undefined,
  targetDepartment: Department | null | undefined,
) {
  return !!assignmentDepartment && assignmentDepartment === targetDepartment;
}

function hasDepartmentPosition(
  authority: UserAuthority,
  positions: OrganizationPosition[] = [],
  context: PermissionContext = {},
) {
  return authority.positions.some(
    (assignment) =>
      assignment.scope === "department" &&
      positions.includes(assignment.position) &&
      matchesDepartment(assignment.department, context.targetDepartment),
  );
}

export function evaluateAuth(
  authority: UserAuthority,
  action: Action,
  context: PermissionContext = {},
): boolean {
  const rule = PERMISSIONS[action] as PermissionRule | undefined;
  if (!rule) return false;

  if (hasGlobalGrant(authority, rule.globalGrants)) return true;
  if (hasGlobalPosition(authority, rule.globalPositions)) return true;
  if (hasDepartmentPosition(authority, rule.departmentPositions, context)) {
    return true;
  }

  return false;
}

export function legacyRolesToAuthorityAssignments(
  roles: readonly Role[],
  user: { department: Department | null },
): {
  positions: PositionAssignment[];
  grants: GrantAssignment[];
} {
  const positions: PositionAssignment[] = [];
  const grants: GrantAssignment[] = [];

  if (roles.includes("department_lead") && user.department) {
    positions.push({
      position: "department_head",
      scope: "department",
      department: user.department,
    });
  }

  if (roles.includes("admin")) {
    grants.push({ grant: "admin", scope: "global" });
  }

  return { positions, grants };
}

export type BoardRosterSetup =
  | {
      ok: true;
      legalOfficerIds: string[];
      officers: {
        presidentId: string;
        vicePresidentId: string;
        headOfFinanceId: string;
      };
    }
  | { ok: false; reason: "invalid_legal_officer_count"; count: number }
  | {
      ok: false;
      reason: "missing_officer_function";
      missing: Array<"president" | "vice_president" | "head_of_finance">;
    }
  | {
      ok: false;
      reason: "duplicate_officer_function";
      duplicate: Array<"president" | "vice_president" | "head_of_finance">;
    }
  | {
      ok: false;
      reason: "overlapping_officer_function";
      officerIds: string[];
    };

function hasGlobalAuthorityPosition(
  authority: UserAuthority,
  position: OrganizationPosition,
) {
  return authority.positions.some(
    (assignment) =>
      assignment.scope === "global" && assignment.position === position,
  );
}

function userIdsWithPosition(
  authorities: UserAuthority[],
  position: OrganizationPosition,
) {
  return authorities
    .filter((authority) => hasGlobalAuthorityPosition(authority, position))
    .map((authority) => authority.userId);
}

const boardEligiblePositions = [
  "president",
  "vice_president",
  "head_of_finance",
] as const satisfies OrganizationPosition[];

type OfficerPosition = "president" | "vice_president" | "head_of_finance";

const officerPositions = [
  "president",
  "vice_president",
  "head_of_finance",
] as const satisfies OfficerPosition[];

export function getBoardRosterSetup(
  authorities: UserAuthority[],
): BoardRosterSetup {
  const boardMembers = authorities.filter((authority) =>
    authority.positions.some(
      (assignment) =>
        assignment.scope === "global" &&
        (boardEligiblePositions as readonly OrganizationPosition[]).includes(
          assignment.position,
        ),
    ),
  );
  const legalOfficerIds = [
    ...new Set(boardMembers.map(({ userId }) => userId)),
  ];
  const officerUserIds = Object.fromEntries(
    officerPositions.map((position) => [
      position,
      userIdsWithPosition(boardMembers, position),
    ]),
  ) as Record<OfficerPosition, string[]>;
  const missing = officerPositions.filter(
    (position) => officerUserIds[position].length === 0,
  );

  if (missing.length > 0) {
    return { ok: false, reason: "missing_officer_function", missing };
  }

  const duplicate = officerPositions.filter(
    (position) => officerUserIds[position].length > 1,
  );

  if (duplicate.length > 0) {
    return { ok: false, reason: "duplicate_officer_function", duplicate };
  }

  const presidentId = officerUserIds.president[0];
  const vicePresidentId = officerUserIds.vice_president[0];
  const headOfFinanceId = officerUserIds.head_of_finance[0];
  const officerIds = [presidentId, vicePresidentId, headOfFinanceId];

  if (new Set(officerIds).size !== officerIds.length) {
    return {
      ok: false,
      reason: "overlapping_officer_function",
      officerIds,
    };
  }

  if (legalOfficerIds.length !== 3) {
    return {
      ok: false,
      reason: "invalid_legal_officer_count",
      count: legalOfficerIds.length,
    };
  }

  return {
    ok: true,
    legalOfficerIds,
    officers: {
      presidentId,
      vicePresidentId,
      headOfFinanceId,
    },
  };
}
