import type { Department } from "@/db/schema/auth";
import {
  isActiveAuthorityStatus,
  isDepartmentLeadPosition,
  type UserAuthority,
} from "@/lib/authority/model";

// Actions that are user-scoped but whose department argument is optional.
// When called without a department (gate check), they behave as "any department".
export type UnscopedViewAction =
  | "user.view_details"
  | "membership.transition.view"
  | "membership.cancellation.view"
  | "membership.resolution.admission.view";

export type UserScopedAction =
  | "user.payment.view"
  | "user.membership.propose"
  | "user.department.change"
  | "membership.transition.decide"
  | "membership.cancellation.acknowledge"
  | UnscopedViewAction;

const userScopedActions = [
  "user.view_details",
  "user.payment.view",
  "user.membership.propose",
  "user.department.change",
  "membership.transition.decide",
  "membership.cancellation.acknowledge",
  "membership.transition.view",
  "membership.cancellation.view",
  "membership.resolution.admission.view",
] as const;

const unscopedViewActions: readonly UnscopedViewAction[] = [
  "user.view_details",
  "membership.transition.view",
  "membership.cancellation.view",
  "membership.resolution.admission.view",
];

export function isUnscopedViewAction(
  action: Action,
): action is UnscopedViewAction {
  return (unscopedViewActions as readonly Action[]).includes(action);
}

export function isUserScopedAction(action: Action): action is UserScopedAction {
  return (userScopedActions as readonly Action[]).includes(action);
}

export type GroupScopedAction =
  | "group.members.manage"
  | "group.managers.manage"
  | "group.export"
  | "group.export_phone";

export type Action = GlobalAction | UserScopedAction | GroupScopedAction;

export type UserScope = {
  // undefined = gate check (any department); null = subject has no department
  targetDepartment: Department | null | undefined;
};

export type GroupScope = {
  isGroupMember: boolean;
  isGroupManager: boolean;
  groupId?: string;
};

const globalActions = [
  "users.create",
  "users.import",
  "users.manage_authority",
  "users.impersonate",
  "membership.resolution.admission.vote",
  "membership.cancel_member",
  "groups.view_all",
  "groups.create",
  "batches.manage",
  "payments.manage",
  "settings.positions.manage",
  "users.view_inactive",
  "audit_log.read",
  "user.personal_email.change",
  "user.password.reset",
] as const;

export type GlobalAction = (typeof globalActions)[number];

export function isGlobalAction(action: Action): action is GlobalAction {
  return (globalActions as readonly Action[]).includes(action);
}

const groupScopedActions = [
  "group.members.manage",
  "group.managers.manage",
  "group.export",
  "group.export_phone",
] as const;

export function isGroupScopedAction(
  action: Action,
): action is GroupScopedAction {
  return (groupScopedActions as readonly Action[]).includes(action);
}

function hasSuperAdminGrant(authority: UserAuthority) {
  return authority.grants.some((a) => a.grant === "super_admin");
}

export function hasAdminGrant(authority: UserAuthority) {
  return (
    hasSuperAdminGrant(authority) ||
    authority.grants.some((a) => a.grant === "admin")
  );
}

function hasFinanceAdminGrant(authority: UserAuthority) {
  return authority.grants.some((a) => a.grant === "finance_admin");
}

export function hasPeopleAdminGrant(authority: UserAuthority) {
  return authority.grants.some((a) => a.grant === "people_admin");
}

export function hasMembersGroupExporterGrant(authority: UserAuthority) {
  return authority.grants.some((a) => a.grant === "members_group_exporter");
}

export function isLegalOfficer(authority: UserAuthority) {
  return authority.positions.some(
    (assignment) =>
      assignment.scope === "global" &&
      (assignment.position === "president" ||
        assignment.position === "vice_president" ||
        assignment.position === "head_of_finance"),
  );
}

function isHeadOfFinance(authority: UserAuthority) {
  return authority.positions.some(
    (assignment) =>
      assignment.scope === "global" &&
      assignment.position === "head_of_finance",
  );
}

// True for both the department head and the department co-head — they hold the
// same authority.
function isDepartmentHead(
  authority: UserAuthority,
  targetDepartment?: Department | null,
) {
  return authority.positions.some((assignment) => {
    if (
      assignment.scope !== "department" ||
      !isDepartmentLeadPosition(assignment.position)
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
    typeof scope === "object" && scope !== null && "targetDepartment" in scope
  );
}

function hasGroupScope(scope: unknown): scope is GroupScope {
  return (
    typeof scope === "object" &&
    scope !== null &&
    "isGroupMember" in scope &&
    typeof (scope as GroupScope).isGroupMember === "boolean" &&
    "isGroupManager" in scope &&
    typeof (scope as GroupScope).isGroupManager === "boolean"
  );
}

function evaluateGroupScopedAction(
  authority: UserAuthority,
  action: GroupScopedAction,
  scope: GroupScope,
): boolean {
  switch (action) {
    case "group.members.manage":
      return (
        hasAdminGrant(authority) ||
        hasPeopleAdminGrant(authority) ||
        scope.isGroupManager
      );
    case "group.managers.manage":
      return hasAdminGrant(authority) || hasPeopleAdminGrant(authority);
    case "group.export":
      return (
        hasAdminGrant(authority) ||
        hasPeopleAdminGrant(authority) ||
        isLegalOfficer(authority) ||
        scope.isGroupManager ||
        (hasMembersGroupExporterGrant(authority) && scope.groupId === "members")
      );
    case "group.export_phone":
      return (
        hasAdminGrant(authority) ||
        hasPeopleAdminGrant(authority) ||
        isLegalOfficer(authority) ||
        scope.isGroupManager
      );
  }
}

function evaluateGlobalAction(
  authority: UserAuthority,
  action: GlobalAction,
): boolean {
  switch (action) {
    case "users.create":
    case "users.import":
      return hasAdminGrant(authority);
    case "users.manage_authority":
      return hasAdminGrant(authority);
    case "groups.create":
      return hasAdminGrant(authority) || hasPeopleAdminGrant(authority);
    case "users.impersonate":
    case "settings.positions.manage":
      return hasSuperAdminGrant(authority);
    case "batches.manage":
      return hasAdminGrant(authority);
    case "payments.manage":
      return isHeadOfFinance(authority) || hasFinanceAdminGrant(authority);
    case "membership.resolution.admission.vote":
      return isLegalOfficer(authority);
    case "membership.cancel_member":
      return isLegalOfficer(authority) || hasSuperAdminGrant(authority);
    case "groups.view_all":
      return (
        hasAdminGrant(authority) ||
        hasPeopleAdminGrant(authority) ||
        isLegalOfficer(authority)
      );
    case "users.view_inactive":
      return (
        hasAdminGrant(authority) ||
        isLegalOfficer(authority) ||
        hasFinanceAdminGrant(authority)
      );
    case "audit_log.read":
      return hasAdminGrant(authority);
    case "user.personal_email.change":
    case "user.password.reset":
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
        isLegalOfficer(authority) ||
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
    case "user.department.change":
      return (
        isDepartmentHead(authority, scope.targetDepartment) ||
        isLegalOfficer(authority) ||
        hasPeopleAdminGrant(authority)
      );
    case "membership.transition.decide":
    case "membership.cancellation.acknowledge":
      return (
        hasSuperAdminGrant(authority) ||
        isLegalOfficer(authority) ||
        isDepartmentHead(authority, scope.targetDepartment)
      );
    case "membership.transition.view":
    case "membership.cancellation.view":
      return (
        hasAdminGrant(authority) ||
        hasPeopleAdminGrant(authority) ||
        isLegalOfficer(authority) ||
        isDepartmentHead(authority, scope.targetDepartment)
      );
    case "membership.resolution.admission.view":
      return (
        hasAdminGrant(authority) ||
        hasPeopleAdminGrant(authority) ||
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
  action: UnscopedViewAction,
  scope?: UserScope,
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

  if (!isUserScopedAction(action)) {
    return false;
  }

  // UnscopedViewActions allow omitting scope for a gate check (any department).
  const userScope: UserScope = hasUserScope(scope)
    ? scope
    : { targetDepartment: undefined };

  if (!hasUserScope(scope) && !isUnscopedViewAction(action)) {
    return false;
  }

  return evaluateUserScopedAction(authority, action, userScope);
}
