import type { CanCheck } from "@/components/can";
import { evaluateAuth, type UserAuthority } from "./index";
import { can } from "./server";

declare const authority: UserAuthority;
declare const check: CanCheck;

evaluateAuth(authority, "groups.view_all");
evaluateAuth(authority, "users.view_details", { targetDepartment: "events" });

// @ts-expect-error target-department permissions require context.
evaluateAuth(authority, "users.view_details");

// @ts-expect-error contextless permissions do not accept target-department context.
evaluateAuth(authority, "groups.view_all", { targetDepartment: "events" });

can("groups.view_all");
can("users.view_details", { targetDepartment: "events" });

// @ts-expect-error department-scoped server checks require scope.
can("users.view_details");

// @ts-expect-error global server checks do not accept department scope.
can("groups.view_all", { targetDepartment: "events" });

check("groups.view_all");
check("users.view_details", { targetDepartment: "events" });

// @ts-expect-error department-scoped client checks require scope.
check("users.view_details");

// @ts-expect-error global client checks do not accept department scope.
check("groups.view_all", { targetDepartment: "events" });
