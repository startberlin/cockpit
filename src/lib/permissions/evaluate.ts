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

const departmentScopedActions = [
  "users.view_details",
  "users.edit",
  "users.complete_onboarding",
  "membership.propose",
] as const;

export function isDepartmentScopedAction(
  action: Action,
): action is DepartmentScopedAction {
  return (departmentScopedActions as readonly Action[]).includes(action);
}

export type GroupScopedAction =
  | "groups.view"
  | "groups.manage_members"
  | "groups.export";

export type Action = GlobalAction | DepartmentScopedAction | GroupScopedAction;

export type DepartmentScope = {
  targetDepartment: Department | null;
};

export type GroupScope = {
  isGroupMember: boolean;
};

const globalActions = [
  "users.create",
  "users.import",
  "users.manage_authority",
  "users.impersonate",
  "membership.vote_resolution",
  "membership.view_resolution",
  "membership.manage_workflows",
  "groups.view_all",
  "groups.create",
  "batches.manage",
  "payments.manage",
  "settings.positions.manage",
  "users.view_all",
] as const;

export type GlobalAction = (typeof globalActions)[number];

export function isGlobalAction(action: Action): action is GlobalAction {
  return (globalActions as readonly Action[]).includes(action);
}

const groupScopedActions = [
  "groups.view",
  "groups.manage_members",
  "groups.export",
] as const;

export function isGroupScopedAction(
  action: Action,
): action is GroupScopedAction {
  return (groupScopedActions as readonly Action[]).includes(action);
}

function hasSuperAdminGrant(authority: UserAuthority) {
  return authority.grants.some((a) => a.grant === "super_admin");
}

function hasAdminGrant(authority: UserAuthority) {
  return (
    hasSuperAdminGrant(authority) ||
    authority.grants.some((a) => a.grant === "admin")
  );
}

function hasFinanceAdminGrant(authority: UserAuthority) {
  return authority.grants.some((a) => a.grant === "finance_admin");
}

function hasPeopleAdminGrant(authority: UserAuthority) {
  return authority.grants.some((a) => a.grant === "people_admin");
}

function isHeadOfFinance(authority: UserAuthority) {
  return authority.positions.some(
    (assignment) =>
      assignment.scope === "global" &&
      assignment.position === "head_of_finance",
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

function hasGroupScope(scope: unknown): scope is GroupScope {
  return (
    typeof scope === "object" &&
    scope !== null &&
    "isGroupMember" in scope &&
    typeof (scope as GroupScope).isGroupMember === "boolean"
  );
}

function evaluateGroupScopedAction(
  authority: UserAuthority,
  action: GroupScopedAction,
  scope: GroupScope,
) {
  switch (action) {
    case "groups.view":
      return (
        hasAdminGrant(authority) ||
        hasPeopleAdminGrant(authority) ||
        scope.isGroupMember
      );
    case "groups.manage_members":
      return hasAdminGrant(authority) || hasPeopleAdminGrant(authority);
    case "groups.export":
      return (
        hasAdminGrant(authority) ||
        hasPeopleAdminGrant(authority) ||
        scope.isGroupMember
      );
  }
}

function evaluateGlobalAction(authority: UserAuthority, action: GlobalAction) {
  switch (action) {
    case "users.create":
    case "users.import":
    case "users.manage_authority":
    case "membership.manage_workflows":
    case "groups.create":
      return hasAdminGrant(authority) || hasPeopleAdminGrant(authority);
    case "users.impersonate":
    case "settings.positions.manage":
      return hasSuperAdminGrant(authority);
    case "batches.manage":
      return hasAdminGrant(authority);
    case "payments.manage":
      return isHeadOfFinance(authority) || hasFinanceAdminGrant(authority);
    case "membership.vote_resolution":
      return isLegalOfficer(authority);
    case "membership.view_resolution":
      return hasAdminGrant(authority) || isLegalOfficer(authority);
    case "groups.view_all":
      return hasAdminGrant(authority) || hasPeopleAdminGrant(authority);
    case "users.view_all":
      return (
        hasAdminGrant(authority) ||
        hasPeopleAdminGrant(authority) ||
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
  action: GroupScopedAction,
  scope: GroupScope,
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

  if (isGroupScopedAction(action)) {
    if (!hasGroupScope(scope)) return false;
    return evaluateGroupScopedAction(authority, action, scope);
  }

  if (!hasDepartmentScope(scope)) {
    return false;
  }

  return evaluateDepartmentScopedAction(
    authority,
    action as DepartmentScopedAction,
    scope,
  );
}
