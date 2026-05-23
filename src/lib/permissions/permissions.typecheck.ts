import type { CanCheck } from "@/components/can";
import { evaluateAuth, type UserAuthority } from "./index";
import { can } from "./server";

declare const authority: UserAuthority;
declare const check: CanCheck;

evaluateAuth(authority, "groups.view_all");
evaluateAuth(authority, "users.view_inactive");
evaluateAuth(authority, "user.view_details", { targetDepartment: "events" });
evaluateAuth(authority, "group.members.manage", { isGroupMember: true });
evaluateAuth(authority, "group.export", { isGroupMember: false });

// @ts-expect-error user-scoped permissions require context.
evaluateAuth(authority, "user.view_details");

// @ts-expect-error contextless permissions do not accept user-scoped context.
evaluateAuth(authority, "groups.view_all", { targetDepartment: "events" });

// @ts-expect-error group-scoped permissions require group context.
evaluateAuth(authority, "group.members.manage");

can("groups.view_all");
can("user.view_details"); // unscoped — valid for listing route gate
can("user.view_details", { department: "events" });
can("user.payment.view", { department: "events" });
can("group.members.manage", { id: "gr_123" });

// @ts-expect-error user-scoped server checks require a user resource.
can("user.membership.propose");

// @ts-expect-error global server checks do not accept a resource.
can("groups.view_all", { department: "events" });

// @ts-expect-error group-scoped server checks require a group id.
can("group.members.manage");

check("groups.view_all");
check("user.view_details"); // unscoped — valid for listing route gate
check("user.view_details", { department: "events" });
check("group.members.manage", { isMember: true });

// @ts-expect-error user-scoped client checks require a user resource.
check("user.membership.propose");

// @ts-expect-error global client checks do not accept a resource.
check("groups.view_all", { department: "events" });

// @ts-expect-error group-scoped client checks require group context.
check("group.members.manage");
