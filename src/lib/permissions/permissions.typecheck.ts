import {
  authPredicates,
  definePermission,
  evaluateAuth,
  type UserAuthority,
} from "./index";

declare const authority: UserAuthority;

definePermission(
  "users.view_details",
  authPredicates.isAdmin(),
  authPredicates.isHeadOfTargetDepartment(),
);

definePermission(
  "groups.view_all",
  authPredicates.isAdmin(),
  authPredicates.isAnyDepartmentHead(),
);

definePermission("users.view_details", authPredicates.isAnyDepartmentHead());

// @ts-expect-error target-department predicates require target-department context.
definePermission("groups.view_all", authPredicates.isHeadOfTargetDepartment());

evaluateAuth(authority, "groups.view_all");
evaluateAuth(authority, "users.view_details", { targetDepartment: "events" });

// @ts-expect-error target-department permissions require context.
evaluateAuth(authority, "users.view_details");

// @ts-expect-error contextless permissions do not accept target-department context.
evaluateAuth(authority, "groups.view_all", { targetDepartment: "events" });
