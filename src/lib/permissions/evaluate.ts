import type { Department } from "@/db/schema/auth";
import {
  isActiveAuthorityStatus,
  type UserAuthority,
} from "@/lib/authority/model";

export type DepartmentScopedAction =
  | "users.view_details"
  | "users.edit"
  | "users.complete_onboarding"
  | "membership.propose";

export type Action = GlobalAction | DepartmentScopedAction;

export type DepartmentScope = {
  targetDepartment: Department | null;
};

const globalActions = [
  "users.create",
  "users.import",
  "users.manage_authority",
  "membership.vote_resolution",
  "membership.view_resolution",
  "membership.manage_workflows",
  "groups.view_all",
  "groups.create",
  "groups.manage_members",
] as const;

export type GlobalAction = (typeof globalActions)[number];

export function isGlobalAction(action: Action): action is GlobalAction {
  return (globalActions as readonly Action[]).includes(action);
}

function hasAdminGrant(authority: UserAuthority) {
  return authority.grants.some(
    (assignment) =>
      assignment.scope === "global" && assignment.grant === "admin",
  );
}

function isLegalOfficer(authority: UserAuthority) {
  return authority.positions.some(
    (assignment) =>
      assignment.scope === "global" &&
      (assignment.position === "president" ||
        assignment.position === "vice_president" ||
        assignment.position === "head_of_finance"),
  );
}

function isDepartmentHead(
  authority: UserAuthority,
  targetDepartment?: Department | null,
) {
  return authority.positions.some((assignment) => {
    if (
      assignment.scope !== "department" ||
      assignment.position !== "department_head"
    ) {
      return false;
    }

    if (targetDepartment === undefined) {
      return true;
    }

    return !!targetDepartment && assignment.department === targetDepartment;
  });
}

function hasDepartmentScope(scope: unknown): scope is DepartmentScope {
  return (
    typeof scope === "object" &&
    scope !== null &&
    "targetDepartment" in scope &&
    (scope as DepartmentScope).targetDepartment !== undefined
  );
}

function evaluateGlobalAction(authority: UserAuthority, action: GlobalAction) {
  switch (action) {
    case "users.create":
    case "users.import":
    case "users.manage_authority":
    case "membership.manage_workflows":
    case "groups.create":
    case "groups.manage_members":
      return hasAdminGrant(authority);
    case "membership.vote_resolution":
      return isLegalOfficer(authority);
    case "membership.view_resolution":
      return hasAdminGrant(authority) || isLegalOfficer(authority);
    case "groups.view_all":
      return (
        hasAdminGrant(authority) ||
        isLegalOfficer(authority) ||
        isDepartmentHead(authority)
      );
  }
}

function evaluateDepartmentScopedAction(
  authority: UserAuthority,
  action: DepartmentScopedAction,
  scope: DepartmentScope,
) {
  switch (action) {
    case "users.view_details":
    case "users.edit":
      return (
        hasAdminGrant(authority) ||
        isDepartmentHead(authority, scope.targetDepartment)
      );
    case "users.complete_onboarding":
    case "membership.propose":
      return (
        hasAdminGrant(authority) ||
        isLegalOfficer(authority) ||
        isDepartmentHead(authority, scope.targetDepartment)
      );
  }
}

export function evaluateAuth(
  authority: UserAuthority,
  action: GlobalAction,
): boolean;
export function evaluateAuth(
  authority: UserAuthority,
  action: DepartmentScopedAction,
  scope: DepartmentScope,
): boolean;
export function evaluateAuth(
  authority: UserAuthority,
  action: Action,
  scope?: unknown,
): boolean {
  if (!isActiveAuthorityStatus(authority.status)) {
    return false;
  }

  if (isGlobalAction(action)) {
    return evaluateGlobalAction(authority, action);
  }

  if (!hasDepartmentScope(scope)) {
    return false;
  }

  return evaluateDepartmentScopedAction(authority, action, scope);
}
