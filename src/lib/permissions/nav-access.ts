import { evaluateAuth } from "./evaluate";
import type { UserAuthority } from "./index";

export function canAccessAdminPeopleDirectory(
  authority: UserAuthority,
): boolean {
  return evaluateAuth(authority, "users.view_all");
}

export function canAccessAdminBatches(authority: UserAuthority): boolean {
  return evaluateAuth(authority, "batches.manage");
}

export function canAccessAdminGroups(authority: UserAuthority): boolean {
  return evaluateAuth(authority, "groups.view_all");
}

export function canAccessAdminPayments(authority: UserAuthority): boolean {
  return evaluateAuth(authority, "payments.manage");
}

export function canAccessAdminSettings(authority: UserAuthority): boolean {
  return evaluateAuth(authority, "settings.positions.manage");
}

export function canAccessAnyAdminRoute(authority: UserAuthority): boolean {
  return (
    canAccessAdminPeopleDirectory(authority) ||
    canAccessAdminBatches(authority) ||
    canAccessAdminGroups(authority) ||
    canAccessAdminPayments(authority) ||
    canAccessAdminSettings(authority)
  );
}
