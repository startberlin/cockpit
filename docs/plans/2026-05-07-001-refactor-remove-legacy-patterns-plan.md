---
title: Remove Legacy Compatibility Patterns
type: refactor
status: completed
date: 2026-05-07
origin: user request to remove legacyViewState and similar outdated patterns without backwards compatibility
---

# Remove Legacy Compatibility Patterns

## Overview

The previous simplification pass intentionally kept a few compatibility bridges so the refactor could land safely: `legacyViewState`, legacy role columns, `Raw`-suffixed group service names, and a remaining `actionClient` export from a DB module. The user has now made the product constraint explicit: we do not need backwards compatibility.

This plan removes those bridges instead of renaming them or hiding them behind comments. The target shape is simple:

- membership state is structured and direct, with no old view-state enum
- active authority lives only in authority tables, not `user.roles`
- group criteria no longer carries legacy role filters
- domain service names describe the current architecture, not the previous action-wrapper split
- `src/db/*` modules expose plain services, not app actions

This is not a broad redesign. The plan removes stale concepts that now make the code harder to explain, while keeping the current Next.js, Drizzle, Better Auth, Inngest, and next-safe-action patterns.

## Problem Frame

The app has several places where the code says one thing and the product model says another:

- `src/lib/membership-status.ts` exposes structured membership state, but still carries `legacyViewState`, `MembershipViewState`, and `getMembershipViewState()`.
- membership billing and people screens still make decisions from the old four-value enum.
- `src/lib/membership-status.ts` still treats `user.status === "member"` without a payment row as `full_member`, which is compatibility behavior rather than truthful state.
- `src/db/schema/auth.ts` still defines a legacy `role` enum and `user.roles`.
- `src/db/schema/group.ts` still defines `groupCriteria.roles`, even though new criteria writes set it to `null`.
- `src/db/groups.ts` now mostly contains plain services, but many names still end in `Raw`, preserving an obsolete distinction.
- `src/db/people.ts` still exports a `next-safe-action` action from the DB layer, which repeats the action-surface problem already fixed for groups.
- `src/lib/authority/update-authorization.ts` wraps permission checking, persistence, and cache revalidation behind callback dependencies, even though the caller could read those three steps directly.
- group API handler factories pass authorization, service calls, and revalidation as callbacks, which makes tests easy but turns simple route handlers into mini dependency-injection containers.

The risk is not only visual clutter. These leftovers make future contributors ask which model is real: legal/payment/profile membership state or `full_member`; authority grants or roles; domain services or action-wrapped DB functions. Since backwards compatibility is not required, the cleanest fix is to delete the old vocabulary.

## Requirements Trace

- R1. Remove `MembershipViewState`, `legacyViewState`, `getMembershipViewState()`, and helpers that accept the legacy enum.
- R2. Update membership UI, billing copy, people detail data, and onboarding completion logic to use structured membership fields directly.
- R3. Remove the member-without-payment `full_member` fallback. Missing payment data must not imply active/full membership.
- R4. Remove legacy `user.roles`, the `role` enum, and `groupCriteria.roles` from the active schema and current migration/snapshot.
- R5. Preserve `users_to_groups.role` and `groupRole`; group-local admin/member role is still active and unrelated to legacy user authority.
- R6. Rename `Raw` group service helpers to clean domain service names and remove compatibility aliases.
- R7. Remove `actionClient` from DB modules that still expose app actions, starting with `src/db/people.ts`.
- R8. Update tests so they assert the new direct model, not compatibility behavior.
- R9. Update living docs that still recommend compatibility bridges, while leaving historical brainstorms alone.
- R10. Remove tiny callback-orchestrator helpers that only glue permission checks, one action, and revalidation together.
- R11. Keep pure assertion/policy helpers, but make application flows either inline the steps at the boundary or own their dependencies directly.

## Scope Boundaries

- Do not redesign the authority policy model. `src/lib/authority/*`, `src/lib/permissions/*`, and authority tables remain the source of permissions.
- Do not remove group-local roles from `users_to_groups.role`.
- Do not introduce a generic workflow or state-machine abstraction for membership state.
- Do not rewrite historical brainstorm documents just because they mention old ideas.
- Do not change Better Auth core tables beyond removing the custom legacy roles field.
- Do not add backwards-compatible aliases for removed exports. Broken imports should be migrated in the same change.

## Context & Research

### Current Legacy Membership Surface

- `src/lib/membership-status.ts` defines `MembershipViewState`, `legacyViewState`, `getMembershipViewState()`, `isPaymentPendingState()`, and `getNextAction(state: MembershipViewState)`.
- `src/app/(authenticated)/(app)/membership/page.tsx` still calls `getMembershipViewState()`.
- `src/app/(authenticated)/(app)/membership/onboarding.tsx` accepts `membershipState: MembershipViewState`.
- `src/app/(authenticated)/(app)/membership/billing-copy.ts` extends its mode union from `MembershipViewState`.
- `src/app/(authenticated)/(app)/membership/start-payment-action.ts` checks `membershipState.legacyViewState`.
- `src/app/(authenticated)/(app)/people/complete-onboarding-action.ts` uses `getMembershipViewState()` to decide whether payment should start.
- `src/db/people.ts` returns `membershipViewState: MembershipViewState` from `getUserById()`.
- `src/lib/membership-status.test.ts` still has tests for legacy enum output and the member-without-payment full-member fallback.

### Current Legacy Role Surface

- `src/db/schema/auth.ts` defines the legacy `role` enum and `user.roles`.
- `src/db/schema/group.ts` imports `role` and defines `groupCriteria.roles`.
- `src/db/groups.ts` still imports `Role`, includes `roles` in `GroupCriteria`, and writes `roles: null`.
- `src/app/api/groups/route-handlers.ts` includes `roles` in `GroupCriteriaRecord`.
- `src/components/group-criteria-manager.tsx` renders "Old role condition no longer applies" when criteria roles exist.
- `src/app/api/groups/api-contracts.test.ts` includes `roles: null` fixtures.
- `src/lib/auth.test.ts` currently verifies that Better Auth additional fields do not expose legacy roles; that should become a schema-removal assertion or disappear if redundant.

### Current Outdated Service Boundary Surface

- `src/db/groups.ts` functions such as `getGroupDetailRaw()`, `searchUsersNotInGroupRaw()`, `addUserToGroupRaw()`, and `findUsersNotInGroupByCriteriaRaw()` are now ordinary services, but the names still describe an older split between raw DB helpers and wrapped actions.
- `src/db/groups.ts` still exports `addUsersMatchingCriteria` as an alias to `addUsersMatchingCriteriaRaw()`.
- `src/db/people.ts` imports `actionClient` and exports `getAllUserPublicData` as an action from inside the DB module.

### Current Callback-Orchestrator Surface

- `src/lib/authority/update-authorization.ts` defines `updateAuthorityWithAuthorization(input, deps)`, where `deps` contains `canManageAuthority`, `replaceUserAuthority`, and `revalidateUser`.
- `src/app/(authenticated)/(app)/people/[id]/update-authority-action.ts` immediately passes `can("users.manage_authority")`, `replaceUserAuthority`, and `revalidatePath()` into that helper.
- `src/db/group-authorization.ts` defines a custom error class plus assertion/authorization helpers, but the actual rules are simple enough to read directly where the route/service boundary enforces them.
- `src/app/api/groups/route-handlers.ts` exports handler factories such as `createBulkAddUsersPostHandler({ requireGroupMemberManagement, addUsersToGroupRaw, revalidatePath })`.
- `src/app/api/users/search-by-criteria/handler.ts` has the same factory pattern for criteria preview.

## Key Technical Decisions

- Delete compatibility concepts rather than renaming them. The user explicitly said backwards compatibility is not needed, so keeping adapters would preserve exactly the confusion this plan is meant to remove.
- Make no payment row mean no active payment state. If existing data needs old members to count as active, that should be represented by explicit payment/legal data through a migration or seed update, not hidden inside `membership-status`.
- Remove role columns from the current branch schema and migration artifacts. This branch is still in active refactor state, so the preferred implementation is to update the Drizzle schema, current migration, and snapshot rather than carry compatibility comments forward.
- Keep structured membership state as a small domain object, not a generic status engine. Profile, legal, operational, and payment are separate concerns; that is enough.
- Use clean group service names with no `Raw` suffix. There is no longer a wrapped/raw pair, so the suffix has become false documentation.
- Move safe-action boundaries to app-facing files. DB modules should expose plain functions that can be used by server components, server actions, route handlers, and tests.
- Prefer direct flows over dependency objects for one-off application operations. A helper is worth keeping when it centralizes reusable domain behavior that would otherwise be duplicated incorrectly; it is not worth keeping when it merely renames an obvious authentication/permission check.
- Keep route handler factories only when they buy meaningful contract testing. If a route handler can import real services directly and still be tested through the exported `GET`/`POST` function, remove the factory.
- Avoid domain-specific error wrappers when route handlers can return the correct 401/403 response directly. Custom error classes are useful when errors cross several layers; they are noise when the check and HTTP response are in the same function.

## Alternatives Considered

| Problem | Options Considered | Chosen Direction | Why |
| --- | --- | --- | --- |
| `legacyViewState` | Keep adapter until later; rename to `getLegacyMembershipViewState`; delete it now | Delete it now | The user explicitly removed the backwards-compatibility requirement, and every remaining caller is local. |
| Member without payment row | Preserve old full-member fallback; introduce a special `legacy_active` payment state; treat missing payment as not started | Treat missing payment as not started | A missing payment row is data absence, not proof of active membership. |
| Legacy user roles | Leave commented as compatibility; quarantine in a separate module; remove schema fields | Remove schema fields | The authority model is active, and keeping roles in the primary user schema invites accidental reuse. |
| Legacy criteria roles | Keep rendering old role criteria as inert; migrate to authority criteria; remove criteria roles | Remove criteria roles | Current criteria writes no longer use roles, and role-based criteria would conflict with authority semantics. |
| `Raw` group helper names | Keep names because they work; add clean aliases; rename in place | Rename in place | Aliases would create two names for the same service and repeat the parallel-surface problem. |
| People DB action | Leave `actionClient` in `src/db/people.ts`; move all people behavior to API routes; expose plain service plus app action wrapper | Plain service plus app action wrapper if needed | Matches the group cleanup and keeps DB modules framework-neutral. |
| Callback orchestrators | Keep dependency injection for testability; move callbacks into larger helpers; inline app flow at the boundary | Inline one-off flows and delete unnecessary helper modules | The callback object is more complex than the operation and hides the actual business flow. |
| Group authorization helpers | Keep `group-authorization.ts`; keep only pure assertions; inline checks where enforced | Delete the helper module and enforce checks directly | The helpers obscure simple `currentUser` and `can()` checks without reducing real duplication. |

## Implementation Units

### U1. Remove Legacy Membership View State

**Problem Restated:** `legacyViewState` keeps the old blended membership enum alive even though the app now has structured profile, operational, legal, and payment state.

**Goal:** Every membership caller uses structured state directly. The old enum and adapter functions disappear.

**Files:**

- `src/lib/membership-status.ts`
- `src/lib/membership-status.test.ts`
- `src/app/(authenticated)/(app)/membership/page.tsx`
- `src/app/(authenticated)/(app)/membership/onboarding.tsx`
- `src/app/(authenticated)/(app)/membership/billing-copy.ts`
- `src/app/(authenticated)/(app)/membership/billing-copy.test.ts`
- `src/app/(authenticated)/(app)/membership/start-payment-action.ts`
- `src/app/(authenticated)/(app)/people/complete-onboarding-action.ts`
- `src/db/people.ts`

**Detailed Approach:**

- Rename `StructuredMembershipState` to `MembershipState` if that improves call-site readability.
- Delete `MembershipViewState`.
- Delete `legacyViewState` from the state object.
- Delete `getMembershipViewState()`.
- Delete `isPaymentPendingState(state: MembershipViewState)`.
- Replace `getNextAction(state: MembershipViewState)` with a helper that derives next action from structured fields:
  - incomplete profile returns `complete_profile`
  - payment states that require user setup return `set_up_payment`
  - active, not required, or covered states return `none`
- Update `paymentSetupAllowed` to derive from structured payment/profile/operational state rather than legacy enum names.
- Change `src/db/people.ts` `UserDetail` from `membershipViewState` to `membershipState`.
- Update membership page and onboarding props so UI branches on `state.profile`, `state.payment`, `state.paymentSetupAllowed`, and `state.nextAction`.
- Update billing copy to accept the specific structured data it needs, not the old global enum.

**Test Scenarios:**

- `src/lib/membership-status.test.ts`: incomplete profile returns `profile: "incomplete"` and `nextAction: "complete_profile"`.
- `src/lib/membership-status.test.ts`: no payment row for a billing-required member returns `payment: "not_started"` and does not return any full/active legacy state.
- `src/lib/membership-status.test.ts`: checkout-started payment returns `payment: "processing"` and a payment setup action only when business rules allow it.
- `src/lib/membership-status.test.ts`: active subscription returns `payment: "active"` and `nextAction: "none"`.
- `src/app/(authenticated)/(app)/membership/billing-copy.test.ts`: copy modes are driven by structured payment/profile state, with no `MembershipViewState` imports.
- TypeScript catches any lingering imports of `getMembershipViewState`, `MembershipViewState`, or `legacyViewState`.

### U2. Remove Legacy Member-Without-Payment Fallback

**Problem Restated:** `src/lib/membership-status.ts` currently treats `user.status === "member"` with no payment row as `full_member`. That encodes old production/data assumptions in a helper that should report current truth.

**Goal:** Missing payment data is explicit. Any member that should have active billing must have explicit payment/legal data.

**Files:**

- `src/lib/membership-status.ts`
- `src/lib/membership-status.test.ts`
- `src/app/(authenticated)/(app)/membership/start-payment-action.ts`
- `src/app/(authenticated)/(app)/people/complete-onboarding-action.ts`
- `drizzle/0012_curvy_blue_marvel.sql`
- `drizzle/meta/0012_snapshot.json`

**Detailed Approach:**

- Remove the branch that maps `user.status === "member" && !payment` to full membership.
- Decide setup eligibility from explicit fields:
  - profile must be complete
  - operational status must require billing, currently `member` or `supporting_alumni`
  - payment must be absent, pending, failed, or processing according to the intended action
- If seed or migration data currently creates members without payment rows, update that data in the current migration/seed path so tests and local environments represent the new model.
- Keep `alumni` without payment as `payment: "not_required"` if that is still the intended business rule.

**Test Scenarios:**

- `src/lib/membership-status.test.ts`: a complete member with no payment row is not active/full and can be prompted to set up payment.
- `src/lib/membership-status.test.ts`: alumni without payment remains `not_required`.
- `src/app/(authenticated)/(app)/membership/start-payment-action.ts`: starting payment no longer blocks because the legacy enum said `full_member`.
- Search-based guard: no test name or assertion mentions "legacy member users without payment rows as full members".

### U3. Drop Legacy Role Columns And Criteria Roles

**Problem Restated:** Legacy roles still live in the primary user and criteria schemas even though active authorization moved to authority positions and grants.

**Goal:** Remove legacy role vocabulary from active schema and code. Keep only group-local roles.

**Files:**

- `src/db/schema/auth.ts`
- `src/db/schema/group.ts`
- `src/db/schema/auth-fields.ts`
- `src/db/schema/index.ts`
- `src/db/groups.ts`
- `src/app/api/groups/route-handlers.ts`
- `src/app/api/groups/api-contracts.test.ts`
- `src/components/group-criteria-manager.tsx`
- `src/lib/auth.test.ts`
- `drizzle/0012_curvy_blue_marvel.sql`
- `drizzle/meta/0012_snapshot.json`

**Detailed Approach:**

- Remove `role` enum and `Role` type from `src/db/schema/auth.ts`.
- Remove `roles` from the `user` table definition.
- Remove `role` import from `src/db/schema/group.ts`.
- Remove `roles` from `groupCriteria`.
- Remove `roles` from `GroupCriteria` and related route handler record types.
- Remove `roles: null` writes and test fixtures.
- Remove the "Old role condition no longer applies" UI branch from `src/components/group-criteria-manager.tsx`.
- Update Better Auth additional field tests so the canonical auth field list is checked without referencing removed role compatibility.
- Update the current Drizzle migration and snapshot to match the schema. Since this is active branch work, prefer replacing the current unshipped migration state over adding compatibility migration clutter.

**Test Scenarios:**

- `src/lib/auth.test.ts`: canonical Better Auth additional fields match the custom user fields that still exist.
- `src/app/api/groups/api-contracts.test.ts`: group criteria responses do not include `roles`.
- `src/components/group-criteria-manager.tsx`: rendered criteria conditions cover department, status, and batch only.
- TypeScript catches any import of `Role` from `src/db/schema/auth.ts`.
- `npx tsc --noEmit`: no code refers to `user.roles` or `groupCriteria.roles`.

### U4. Rename Group Services To Current Domain Names

**Problem Restated:** `Raw` suffixes in `src/db/groups.ts` preserve an old architecture where DB helpers were wrapped by actions in the same module. The wrapper layer is gone, so the suffix now makes the current structure harder to read.

**Goal:** Group services use plain names and have no compatibility aliases.

**Files:**

- `src/db/groups.ts`
- `src/app/(authenticated)/(app)/groups/[id]/actions.ts`
- `src/app/(authenticated)/(app)/groups/[id]/page.tsx`
- `src/app/api/groups/[id]/route.ts`
- `src/app/api/groups/[id]/criteria/route.ts`
- `src/app/api/groups/bulk-add-users/route.ts`
- `src/app/api/groups/criteria/route.ts`
- `src/app/api/groups/criteria/[id]/route.ts`
- `src/app/api/groups/route-handlers.ts`
- `src/app/api/users/search-by-criteria/handler.ts`
- `src/app/api/users/search-by-criteria/route.ts`
- `src/app/api/groups/api-contracts.test.ts`
- `src/app/api/users/search-by-criteria/route.test.ts`

**Detailed Approach:**

- Rename `getGroupDetailRaw` to `getGroupDetail`.
- Rename `searchUsersNotInGroupRaw` to `searchUsersNotInGroup`.
- Rename `addUserToGroupRaw` to `addUserToGroup`.
- Rename `removeUserFromGroupRaw` to `removeUserFromGroup`.
- Rename `updateUserGroupRoleRaw` to `updateUserGroupRole`.
- Rename `getGroupCriteriaRaw` to `getGroupCriteria`.
- Rename `addGroupCriteriaRaw` to `addGroupCriteria`.
- Rename `removeGroupCriteriaRaw` to `removeGroupCriteria`.
- Rename `findUsersNotInGroupByCriteriaRaw` to `findUsersNotInGroupByCriteria`.
- Rename `addUsersToGroupRaw` to `addUsersToGroup`.
- Rename `addUsersMatchingCriteriaRaw` to `addUsersMatchingCriteria`.
- Delete `export const addUsersMatchingCriteria = addUsersMatchingCriteriaRaw`.
- Update route handler dependency names so tests read like domain contracts rather than raw helper wiring.

**Test Scenarios:**

- `src/app/api/groups/api-contracts.test.ts`: retained route contracts pass with renamed dependency objects.
- `src/app/api/users/search-by-criteria/route.test.ts`: criteria preview still delegates to the single criteria search service.
- `src/app/(authenticated)/(app)/groups/[id]/actions.ts`: server actions still revalidate the group page after mutations.
- Search-based guard: `rg "Raw\\b" src/db/groups.ts src/app/api src/app/\\(authenticated\\)/\\(app\\)/groups` returns no group service names.

### U5. Remove Safe Action Boundary From People DB Module

**Problem Restated:** `src/db/people.ts` still imports `actionClient` and exports `getAllUserPublicData` as a next-safe-action action. That keeps app-boundary behavior inside a DB service module.

**Goal:** `src/db/people.ts` exposes plain services. Any safe-action wrapper lives in app-facing code.

**Files:**

- `src/db/people.ts`
- `src/app/(authenticated)/(app)/people/page.tsx`
- `src/app/(authenticated)/(app)/people/page-client.tsx`
- `src/app/(authenticated)/(app)/people/create-user-action.ts`
- `src/app/(authenticated)/(app)/people/complete-onboarding-action.ts`
- `src/app/(authenticated)/(app)/people/check-workspace-email-action.ts`
- `src/app/(authenticated)/(app)/people/import-google-user-action.ts`

**Detailed Approach:**

- Convert `getAllUserPublicData` to a plain async function returning `PublicUser[]`.
- Update callers that currently expect a safe-action result shape.
- If a client component needs an action wrapper, create a colocated app action with a narrow name such as `listPeopleAction`; do not put it in `src/db/people.ts`.
- Keep people mutations that already live in app action files as app actions. This unit is not trying to remove next-safe-action from the app, only from DB modules.
- After U1, ensure `getUserById()` returns structured `membershipState`, not `membershipViewState`.

**Test Scenarios:**

- Existing people page tests or TypeScript compile prove `getAllUserPublicData()` callers consume a plain array.
- Add a focused unit test for `getUserById()` mapping if test scaffolding already exists for DB mapping; otherwise rely on TypeScript plus route/page tests.
- Search-based guard: `rg "actionClient" src/db` returns no DB module imports.

### U6. Remove Callback-Orchestrator And Authorization Helper Layers

**Problem Restated:** Some helpers do not model a domain operation; they just rename obvious authorization checks or accept callbacks for permission, mutation, and revalidation. That makes the call graph harder to read than spelling out the steps where the app boundary already has the needed imports.

**Goal:** Remove small dependency-object orchestrators and unnecessary authorization helper modules. Authorization should be enforced directly in the place that needs it unless there is substantial reusable policy logic.

**Files:**

- `src/lib/authority/update-authorization.ts`
- `src/lib/authority/update-authorization.test.ts`
- `src/app/(authenticated)/(app)/people/[id]/update-authority-action.ts`
- `src/db/group-authorization.ts`
- `src/db/groups.ts`
- `src/db/groups.test.ts`
- `src/app/api/groups/route-handlers.ts`
- `src/app/api/groups/[id]/route.ts`
- `src/app/api/groups/[id]/criteria/route.ts`
- `src/app/api/groups/bulk-add-users/route.ts`
- `src/app/api/groups/criteria/route.ts`
- `src/app/api/groups/criteria/[id]/route.ts`
- `src/app/api/users/search-by-criteria/handler.ts`
- `src/app/api/users/search-by-criteria/route.ts`
- `src/app/api/groups/api-contracts.test.ts`
- `src/app/api/users/search-by-criteria/route.test.ts`

**Detailed Approach:**

- Delete `updateAuthorityWithAuthorization()`.
- Prefer deleting `assertAuthorityUpdateAllowed()` too. The denial branch in `update-authority-action.ts` is short and easier to read inline unless another caller appears during implementation.
- In `src/app/(authenticated)/(app)/people/[id]/update-authority-action.ts`, make the flow explicit:
  - validate input through the existing safe-action schema
  - call `can("users.manage_authority")`
  - throw the existing authorization error if denied
  - call `replaceUserAuthority(parsedInput)`
  - call `revalidatePath(`/people/${parsedInput.userId}`)`
- Remove callback dependency tests for `updateAuthorityWithAuthorization()` and replace them with action-level denial coverage if existing test scaffolding makes that reasonable. Do not keep an assertion-only test just to preserve a helper.
- Delete `src/db/group-authorization.ts`.
- Move group authorization enforcement into the functions/routes that need it:
  - `requireGroupMemberManagement()` in `src/db/groups.ts` can directly load `getCurrentUser()`, return a 401-style error/result for missing users, call `can("groups.manage_members")`, and return a 403-style error/result for denied users.
  - `requireGroupView(groupId)` can directly load `getCurrentUser()`, call `can("groups.view_all")`, check membership if needed, and throw/return the exact denial used by its caller.
  - route handlers should translate those direct checks into 401/403 responses without importing a domain-specific error helper.
- Prefer small local response helpers inside API route files, such as `unauthorized()` or `forbidden()`, over a cross-module `GroupAuthorizationError`.
- Revisit route handler factories after U4 renames services:
  - For retained API routes, prefer direct exported `GET`/`POST` functions that import `requireGroupView`, `requireGroupMemberManagement`, service functions, and `revalidatePath` directly.
  - Keep only local response helpers that reduce duplication without hiding dependencies.
  - If contract tests need dependency control, test the domain services separately and route handlers through actual exported route functions with mocked module boundaries only if the repo already has that pattern. Do not preserve a factory solely to inject three callbacks.
- For `src/app/api/users/search-by-criteria/handler.ts`, either inline the handler into `route.ts` or keep a pure `parseCriteriaSearchRequest()` helper if request validation needs direct tests.

**Test Scenarios:**

- `src/lib/authority/update-authorization.test.ts`: no test calls `updateAuthorityWithAuthorization()`. Denial-path coverage remains either on the pure assertion or on the server action.
- `src/app/(authenticated)/(app)/people/[id]/update-authority-action.ts`: denied authority update still throws the same authorization message and does not call `replaceUserAuthority()`.
- `src/db/groups.test.ts`: group authorization behavior is covered through `requireGroupMemberManagement()` / `requireGroupView()` or route-level tests, not through `group-authorization.ts`.
- `src/app/api/groups/api-contracts.test.ts`: retained routes still return 401/403/400/404/409/500 contracts as applicable after factory removal or simplification.
- `src/app/api/users/search-by-criteria/route.test.ts`: criteria preview still rejects invalid bodies and requires group member management authority.
- Search-based guard: `rg "WithAuthorization|interface .*Dependencies|canManageAuthority: \\(\\)|revalidateUser|create.*Handler\\(|GroupAuthorizationError|group-authorization" src/lib src/db src/app/api` returns only intentional leftovers.

### U7. Update Living Docs And Remove Compatibility Instructions

**Problem Restated:** Some current planning docs still describe compatibility bridges as acceptable intermediate states. That was correct before the user clarified the no-backwards-compatibility constraint, but it is now stale guidance.

**Goal:** Living docs point future work at the direct model. Historical brainstorms remain intact.

**Files:**

- `docs/plans/2026-05-02-001-feat-membership-lifecycle-workflows-plan.md`
- `docs/plans/2026-05-05-002-refactor-app-simplification-plan.md`
- `docs/plans/2026-05-07-001-refactor-remove-legacy-patterns-plan.md`

**Detailed Approach:**

- Update the membership lifecycle plan only where it gives active implementation guidance that conflicts with this cleanup.
- Add a short supersession note to the completed app simplification plan for the parts this plan intentionally replaces:
  - legacy roles should be removed, not quarantined
  - membership view-state compatibility should be deleted, not retained
- Do not rewrite `docs/brainstorms/*`; those are historical context.
- Do not update unrelated solution docs unless they actively instruct current code to use legacy roles or legacy membership view state.

**Test Scenarios:**

- Documentation scan: no active plan recommends retaining `legacyViewState`, `getMembershipViewState()`, `user.roles`, or `groupCriteria.roles`.
- Documentation scan: no absolute paths are introduced in plan files.

## Sequencing

1. U1 and U2 should land together because removing `legacyViewState` and removing the full-member fallback touch the same helper and tests.
2. U3 should come next because it removes schema fields and route/UI fixtures that still advertise old authority concepts.
3. U4 can run after U3 so route handler types and tests are only updated once.
4. U5 should run after U1 because `src/db/people.ts` is affected by both membership state and action-boundary cleanup.
5. U6 should run after U4 because handler factories and `Raw` service names currently overlap in the API route files.
6. U7 should be last so documentation reflects the final implementation decisions rather than temporary migration steps.

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Removing the member-without-payment fallback changes local seeded user behavior | Update seeds/current migration data so active members have explicit payment state when needed. |
| Dropping `user.roles` breaks Better Auth additional field assumptions | Remove the field from the canonical additional-field list and verify auth tests plus `npx tsc --noEmit`. |
| Dropping `groupCriteria.roles` breaks criteria API fixtures | Update route contract tests and criteria UI together in U3. |
| Renaming `Raw` helpers causes scattered import churn | Use search-based guard after U4 and avoid aliases so TypeScript finds every caller. |
| Moving people action boundary changes client data shape | Keep the public user return type unchanged; only change whether the function is called as a plain service or action result. |
| Flattening route factories weakens contract tests | Keep route contract tests, but test exported handlers or extracted pure request parsing instead of callback wiring. |

## Verification Plan

- `npm test`
- `npx tsc --noEmit`
- `npm run lint -- --max-diagnostics=80`
- `git diff --check`
- Targeted searches:
  - `rg "legacyViewState|getMembershipViewState|MembershipViewState" src`
  - `rg "user\\.roles|groupCriteria\\.roles|\\bRole\\b" src`
  - `rg "Raw\\b" src/db/groups.ts src/app/api src/app/\\(authenticated\\)/\\(app\\)/groups`
  - `rg "actionClient" src/db`
  - `rg "WithAuthorization|interface .*Dependencies|canManageAuthority: \\(\\)|revalidateUser|create.*Handler\\(|GroupAuthorizationError|group-authorization" src/lib src/db src/app/api`

## Done Criteria

- No source code imports or exports `MembershipViewState`, `getMembershipViewState()`, or `legacyViewState`.
- No helper maps missing payment data to full/active membership.
- `user.roles`, `role`, and `groupCriteria.roles` are gone from active schema and current migration artifacts.
- Group service names no longer use `Raw` or compatibility aliases.
- `src/db/people.ts` exposes plain services and does not import `actionClient`.
- One-off permission/action/revalidation flows are explicit at the app boundary or owned by a real domain service, not callback dependency objects.
- `src/db/group-authorization.ts` is removed, and group authorization checks are readable at the enforcement sites.
- Tests and docs describe the direct model, not legacy compatibility behavior.
