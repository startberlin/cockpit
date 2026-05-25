import type { CanCheck } from "@/components/can";
import { evaluateAuth, type UserAuthority } from "./index";
import { can } from "./server";

declare const authority: UserAuthority;
declare const check: CanCheck;

evaluateAuth(authority, "groups.view_all");
evaluateAuth(authority, "users.view_inactive");
evaluateAuth(authority, "user.view_details", { targetDepartment: "events" });
evaluateAuth(authority, "group.members.manage", {
  isGroupMember: true,
  isGroupManager: false,
});
evaluateAuth(authority, "group.export", {
  isGroupMember: false,
  isGroupManager: false,
});

// UnscopedViewActions — valid both with and without dept scope.
evaluateAuth(authority, "user.view_details"); // gate check
evaluateAuth(authority, "membership.transition.view"); // gate check
evaluateAuth(authority, "membership.transition.view", {
  targetDepartment: "events",
}); // scoped
evaluateAuth(authority, "membership.cancellation.view"); // gate check
evaluateAuth(authority, "membership.cancellation.view", {
  targetDepartment: null,
}); // user has no dept

// @ts-expect-error contextless permissions do not accept user-scoped context.
evaluateAuth(authority, "groups.view_all", { targetDepartment: "events" });

// @ts-expect-error group-scoped permissions require group context.
evaluateAuth(authority, "group.members.manage");

can("groups.view_all");
can("user.view_details"); // unscoped — valid for listing route gate
can("user.view_details", { department: "events" });
can("user.payment.view", { department: "events" });
can("group.members.manage", { id: "gr_123" });
can("membership.transition.view"); // gate check — valid without dept
can("membership.transition.view", { department: "events" }); // scoped — valid
can("membership.cancellation.view", { department: null }); // user has no dept

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
check("membership.transition.view"); // gate check — valid without dept
check("membership.transition.view", { department: "events" }); // scoped — valid
check("membership.cancellation.view", { department: null }); // user has no dept

// @ts-expect-error user-scoped client checks require a user resource.
check("user.membership.propose");

// @ts-expect-error global client checks do not accept a resource.
check("groups.view_all", { department: "events" });

// @ts-expect-error group-scoped client checks require group context.
check("group.members.manage");
