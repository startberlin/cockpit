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

export interface TargetDepartmentContext {
  targetDepartment: Department | null;
}

export interface PermissionContexts {
  "users.create": undefined;
  "users.import": undefined;
  "users.view_details": TargetDepartmentContext;
  "users.edit": TargetDepartmentContext;
  "users.manage_authority": undefined;
  "users.complete_onboarding": TargetDepartmentContext;
  "membership.propose": TargetDepartmentContext;
  "membership.vote_resolution": undefined;
  "membership.view_resolution": undefined;
  "membership.manage_workflows": undefined;
  "groups.view_all": undefined;
  "groups.create": undefined;
  "groups.manage_members": undefined;
}

export type Action = keyof PermissionContexts;
export type PermissionContext<A extends Action = Action> =
  PermissionContexts[A];
export type PermissionContextArg<A extends Action> =
  PermissionContexts[A] extends undefined
    ? []
    : [context: PermissionContexts[A]];

export interface AuthPredicate<Context> {
  name: string;
  evaluate: (authority: UserAuthority, context: Context) => boolean;
}

interface PermissionRule<ActionName extends Action> {
  action: ActionName;
  predicates: AuthPredicate<PermissionContexts[ActionName]>[];
}

function predicate<Context>(
  name: string,
  evaluate: (authority: UserAuthority, context: Context) => boolean,
): AuthPredicate<Context> {
  return { name, evaluate };
}

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

function hasAnyDepartmentPosition(
  authority: UserAuthority,
  positions: OrganizationPosition[],
) {
  return authority.positions.some(
    (assignment) =>
      assignment.scope === "department" &&
      positions.includes(assignment.position),
  );
}

function hasTargetDepartmentPosition(
  authority: UserAuthority,
  context: TargetDepartmentContext,
  positions: OrganizationPosition[],
) {
  return authority.positions.some(
    (assignment) =>
      assignment.scope === "department" &&
      positions.includes(assignment.position) &&
      !!assignment.department &&
      assignment.department === context?.targetDepartment,
  );
}

export const authPredicates = {
  isAdmin: () =>
    predicate("isAdmin", (authority: UserAuthority) =>
      hasGlobalGrant(authority, ["admin"]),
    ),
  isLegalOfficer: () =>
    predicate("isLegalOfficer", (authority: UserAuthority) =>
      hasGlobalPosition(authority, [
        "president",
        "vice_president",
        "head_of_finance",
      ]),
    ),
  isAnyDepartmentHead: () =>
    predicate("isAnyDepartmentHead", (authority: UserAuthority) =>
      hasAnyDepartmentPosition(authority, ["department_head"]),
    ),
  isHeadOfTargetDepartment: () =>
    predicate(
      "isHeadOfTargetDepartment",
      (authority: UserAuthority, context: TargetDepartmentContext) =>
        hasTargetDepartmentPosition(authority, context, ["department_head"]),
    ),
} as const;

export function definePermission<ActionName extends Action>(
  action: ActionName,
  ...predicates: AuthPredicate<PermissionContexts[ActionName]>[]
): PermissionRule<ActionName> {
  return { action, predicates };
}

const {
  isAdmin,
  isAnyDepartmentHead,
  isHeadOfTargetDepartment,
  isLegalOfficer,
} = authPredicates;

export const PERMISSIONS = {
  "users.create": definePermission("users.create", isAdmin()),
  "users.import": definePermission("users.import", isAdmin()),
  "users.view_details": definePermission(
    "users.view_details",
    isAdmin(),
    isHeadOfTargetDepartment(),
  ),
  "users.edit": definePermission(
    "users.edit",
    isAdmin(),
    isHeadOfTargetDepartment(),
  ),
  "users.manage_authority": definePermission(
    "users.manage_authority",
    isAdmin(),
  ),
  "users.complete_onboarding": definePermission(
    "users.complete_onboarding",
    isAdmin(),
    isLegalOfficer(),
    isHeadOfTargetDepartment(),
  ),
  "membership.propose": definePermission(
    "membership.propose",
    isAdmin(),
    isLegalOfficer(),
    isHeadOfTargetDepartment(),
  ),
  "membership.vote_resolution": definePermission(
    "membership.vote_resolution",
    isLegalOfficer(),
  ),
  "membership.view_resolution": definePermission(
    "membership.view_resolution",
    isAdmin(),
    isLegalOfficer(),
  ),
  "membership.manage_workflows": definePermission(
    "membership.manage_workflows",
    isAdmin(),
  ),
  "groups.view_all": definePermission(
    "groups.view_all",
    isAdmin(),
    isLegalOfficer(),
    isAnyDepartmentHead(),
  ),
  "groups.create": definePermission("groups.create", isAdmin()),
  "groups.manage_members": definePermission("groups.manage_members", isAdmin()),
} as const satisfies { [ActionName in Action]: PermissionRule<ActionName> };

export function evaluateAuth<ActionName extends Action>(
  authority: UserAuthority,
  action: ActionName,
  ...contextArg: PermissionContextArg<ActionName>
): boolean {
  const rule = PERMISSIONS[action] as unknown as PermissionRule<ActionName>;
  const context = contextArg[0] as PermissionContexts[ActionName];

  return rule.predicates.some((rulePredicate) =>
    rulePredicate.evaluate(authority, context),
  );
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
