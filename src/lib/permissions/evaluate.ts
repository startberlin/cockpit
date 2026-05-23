import type { Department } from "@/db/schema/auth";
import {
  isActiveAuthorityStatus,
  type UserAuthority,
} from "@/lib/authority/model";

export type UserScopedAction =
  | "user.view_details"
  | "user.payment.view"
  | "user.membership.propose"
  | "membership.transition.decide"
  | "membership.cancellation.acknowledge";

const userScopedActions = [
  "user.view_details",
  "user.payment.view",
  "user.membership.propose",
  "membership.transition.decide",
  "membership.cancellation.acknowledge",
] as const;

export function isUserScopedAction(action: Action): action is UserScopedAction {
  return (userScopedActions as readonly Action[]).includes(action);
}

export type GroupScopedAction =
  | "group.view"
  | "group.members.manage"
  | "group.export";

export type Action = GlobalAction | UserScopedAction | GroupScopedAction;

export type UserScope = {
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
  "membership.resolution.vote",
  "membership.resolution.view",
  "membership.cancel_member",
  "groups.view_all",
  "groups.create",
  "batches.manage",
  "payments.manage",
  "settings.positions.manage",
  "users.view_inactive",
  "audit_log.read",
] as const;

export type GlobalAction = (typeof globalActions)[number];

export function isGlobalAction(action: Action): action is GlobalAction {
  return (globalActions as readonly Action[]).includes(action);
}

const groupScopedActions = [
  "group.view",
  "group.members.manage",
  "group.export",
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

    return (
      targetDepartment !== null && assignment.department === targetDepartment
    );
  });
}

function hasUserScope(scope: unknown): scope is UserScope {
  return (
    typeof scope === "object" &&
    scope !== null &&
    "targetDepartment" in scope &&
    (scope as UserScope).targetDepartment !== undefined
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
): boolean {
  switch (action) {
    case "group.view":
      return (
        hasAdminGrant(authority) ||
        hasPeopleAdminGrant(authority) ||
        scope.isGroupMember
      );
    case "group.members.manage":
      return hasAdminGrant(authority);
    case "group.export":
      return hasAdminGrant(authority) || hasPeopleAdminGrant(authority);
  }
}

function evaluateGlobalAction(
  authority: UserAuthority,
  action: GlobalAction,
): boolean {
  switch (action) {
    case "users.create":
    case "users.import":
      return hasAdminGrant(authority) || hasPeopleAdminGrant(authority);
    case "users.manage_authority":
    case "groups.create":
      return hasAdminGrant(authority);
    case "users.impersonate":
    case "settings.positions.manage":
      return hasSuperAdminGrant(authority);
    case "batches.manage":
      return hasAdminGrant(authority);
    case "payments.manage":
      return isHeadOfFinance(authority) || hasFinanceAdminGrant(authority);
    case "membership.resolution.vote":
      return isLegalOfficer(authority);
    case "membership.resolution.view":
      return hasAdminGrant(authority) || isLegalOfficer(authority);
    case "membership.cancel_member":
      return isLegalOfficer(authority) || hasSuperAdminGrant(authority);
    case "groups.view_all":
      return hasAdminGrant(authority) || hasPeopleAdminGrant(authority);
    case "users.view_inactive":
      return (
        hasAdminGrant(authority) ||
        isLegalOfficer(authority) ||
        hasFinanceAdminGrant(authority)
      );
    case "audit_log.read":
      return hasAdminGrant(authority);
  }
}

function evaluateUserScopedAction(
  authority: UserAuthority,
  action: UserScopedAction,
  scope: UserScope,
): boolean {
  switch (action) {
    case "user.view_details":
      return (
        hasAdminGrant(authority) ||
        hasPeopleAdminGrant(authority) ||
        isDepartmentHead(authority, scope.targetDepartment)
      );
    case "user.payment.view":
      return (
        hasAdminGrant(authority) ||
        isLegalOfficer(authority) ||
        hasFinanceAdminGrant(authority)
      );
    case "user.membership.propose":
      return (
        hasAdminGrant(authority) ||
        isLegalOfficer(authority) ||
        isDepartmentHead(authority, scope.targetDepartment)
      );
    case "membership.transition.decide":
    case "membership.cancellation.acknowledge":
      return (
        isLegalOfficer(authority) ||
        isDepartmentHead(authority, scope.targetDepartment)
      );
  }
}

export function evaluateUnscopedViewDetails(authority: UserAuthority): boolean {
  if (!isActiveAuthorityStatus(authority.status)) return false;
  return (
    hasAdminGrant(authority) ||
    hasPeopleAdminGrant(authority) ||
    isDepartmentHead(authority)
  );
}

export function evaluateAuth(
  authority: UserAuthority,
  action: GlobalAction,
): boolean;
export function evaluateAuth(
  authority: UserAuthority,
  action: UserScopedAction,
  scope: UserScope,
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

  if (!hasUserScope(scope) || !isUserScopedAction(action)) {
    return false;
  }

  return evaluateUserScopedAction(authority, action, scope);
}
