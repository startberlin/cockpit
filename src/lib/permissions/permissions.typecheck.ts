import type { CanCheck } from "@/components/can";
import { evaluateAuth, type UserAuthority } from "./index";
import { can } from "./server";

declare const authority: UserAuthority;
declare const check: CanCheck;

evaluateAuth(authority, "groups.view_all");
evaluateAuth(authority, "users.view_details", { targetDepartment: "events" });
evaluateAuth(authority, "groups.manage_members", { isGroupMember: true });
evaluateAuth(authority, "groups.export", { isGroupMember: true });

// @ts-expect-error target-department permissions require context.
evaluateAuth(authority, "users.view_details");

// @ts-expect-error contextless permissions do not accept target-department context.
evaluateAuth(authority, "groups.view_all", { targetDepartment: "events" });

// @ts-expect-error group-scoped permissions require group context.
evaluateAuth(authority, "groups.manage_members");

can("groups.view_all");
can("users.view_details", { department: "events" });
can("groups.manage_members", { id: "gr_123" });

// @ts-expect-error department-scoped server checks require a user resource.
can("users.view_details");

// @ts-expect-error global server checks do not accept a resource.
can("groups.view_all", { department: "events" });

// @ts-expect-error group-scoped server checks require a group id.
can("groups.manage_members");

check("groups.view_all");
check("users.view_details", { department: "events" });
check("groups.manage_members", { isMember: true });

// @ts-expect-error department-scoped client checks require a user resource.
check("users.view_details");

// @ts-expect-error global client checks do not accept a resource.
check("groups.view_all", { department: "events" });

// @ts-expect-error group-scoped client checks require group context.
check("groups.manage_members");
