---
title: "refactor: Permission system — granular roles, action naming, people_admin"
type: refactor
status: completed
date: 2026-05-20
origin: docs/brainstorms/2026-05-20-permission-registry-and-granular-roles-requirements.md
---

# refactor: Permission system — granular roles, action naming, people_admin

## Summary

Refactors the permission action names to follow a clear singular/plural scope convention, splits the coarse `users.edit` action into `user.edit.contact` and `user.edit.status`, defines the `people_admin` grant's precise permission set, adds `targetStatus` to user-scoped permission context, and replaces the manually-maintained `nav-access.ts` layer with direct `can()`/`useCan()` calls.

After this refactor:
- Adding a new grantable role requires editing only `evaluate.ts` (new helper + relevant switch cases) plus a mechanical DB enum migration.
- Nav visibility for any admin section is automatically correct for any role whose helper is included in the relevant switch case — no nav file changes needed.
- TypeScript enforces that all user-scoped `can()` calls pass `targetStatus`, preventing silent mismatches.

**No DB migration is needed in this pass.** `people_admin` already exists in the `GlobalAccessGrant` enum in `src/lib/authority/model.ts`.

---

## Problem Frame

(see origin: `docs/brainstorms/2026-05-20-permission-registry-and-granular-roles-requirements.md`)

The current permission system has four structural limitations:

1. **`users.edit` is too coarse.** A single action covers contact edits, alumni status changes, and membership-type changes. There is no way to give someone contact-edit access without also giving them status-edit access.

2. **Action naming is ambiguous.** `users.view_details` and `groups.view` look plural/collection-level but are actually user-scoped and group-scoped respectively. The existing naming makes it hard to tell which actions require a target resource and which are collection-level.

3. **`nav-access.ts` is manually maintained.** When a new role is added, its evaluator helper must also be added to every nav-access function it affects. This is a separate file that must stay in sync with `evaluate.ts`.

4. **`people_admin` is partially implemented.** The grant exists in the DB schema and has some switch-case coverage, but the permission set has not been formally defined (specifically: which edits are allowed and which are denied).

---

## Planning Decisions

### DB migration
`people_admin` already exists in the `globalAccessGrants` array in `src/lib/authority/model.ts` and in the Postgres `global_access_grant` enum. No migration is needed for this pass.

### `users.edit` call sites
The action string `users.edit` exists in `evaluate.ts` type definitions only. It is not called at any active runtime call site in the app. No call site migration is needed for that specific string — the rename to `user.edit.contact` + `user.edit.status` is a purely additive change in the evaluator.

### `canAccessAnyAdminRoute` simplification
Replace with `(await can("users.view_all")) || (await can("payments.manage"))`. All admin sections that require more (batches, settings) also require admin, which implies `users.view_all`. Only `finance_admin` and `head_of_finance` reach admin routes without `users.view_all`, via `payments.manage`.

### `nav-access.ts` deletion
Plan `2026-05-20-002` introduced `nav-access.ts` as a single source of truth for nav visibility. This plan replaces it with direct `useCan()` / `can()` calls, which is a stronger guarantee: when a new role's helper is added to the `users.view_all` switch case, People Directory becomes visible automatically without touching any nav file. The indirection in `nav-access.ts` breaks this property.

### `targetStatus` field is required
`UserScope.targetStatus` is required (not optional) in the TypeScript type. This enforces completeness: TypeScript compilation fails for any user-scoped `can()` call missing `targetStatus`. All existing call sites that pass a full user object already have `status` available (confirmed for `PublicUser`, `UserDetail`, and Drizzle query results in server actions).

### Membership action renames
`membership.vote_resolution` → `membership.resolution.vote`, `membership.view_resolution` → `membership.resolution.view`, `membership.manage_workflows` → `membership.workflows.manage` — these follow the convention established in R5 of the origin document (noun-first, then verb: `resolution.vote`).

---

## Action Rename Map

| Current | New | Scope type |
|---------|-----|------------|
| `users.view_details` | `user.view` | UserScopedAction (was DepartmentScopedAction) |
| `users.edit` | *(removed — split below)* | — |
| *(new)* | `user.edit.contact` | UserScopedAction |
| *(new)* | `user.edit.status` | UserScopedAction |
| `users.complete_onboarding` | `user.complete_onboarding` | UserScopedAction |
| `membership.propose` | `user.membership.propose` | UserScopedAction |
| `groups.view` | `group.view` | GroupScopedAction |
| `groups.manage_members` | `group.members.manage` | GroupScopedAction |
| `groups.export` | `group.export` | GroupScopedAction |
| `membership.vote_resolution` | `membership.resolution.vote` | GlobalAction |
| `membership.view_resolution` | `membership.resolution.view` | GlobalAction |
| `membership.manage_workflows` | `membership.workflows.manage` | GlobalAction |

Global actions unchanged: `users.create`, `users.import`, `users.view_all`, `users.manage_authority`, `users.impersonate`, `groups.view_all`, `groups.create`, `batches.manage`, `payments.manage`, `settings.positions.manage`.

## Type Rename Map

| Current | New |
|---------|-----|
| `DepartmentScopedAction` | `UserScopedAction` |
| `DepartmentScope` | `UserScope` |
| `isDepartmentScopedAction` | `isUserScopedAction` |
| `hasDepartmentScope` (internal) | `hasUserScope` |
| `evaluateDepartmentScopedAction` (internal) | `evaluateUserScopedAction` |

`GroupScopedAction`, `GroupScope`, `isGroupScopedAction` are unchanged.

---

## Implementation Units

### IU1 — Core evaluator refactor (`src/lib/permissions/evaluate.ts`)

**All changes are in a single file. No new files.**

1. Add import: `type UserStatus` from `@/db/schema/auth`.
2. Rename `DepartmentScopedAction` → `UserScopedAction`, `departmentScopedActions` → `userScopedActions`.
3. Update `userScopedActions` array to the new action names.
4. Rename `DepartmentScope` → `UserScope`, add required field `targetStatus: UserStatus`.
5. Rename `isDepartmentScopedAction` → `isUserScopedAction`.
6. Rename `hasDepartmentScope` → `hasUserScope`; update the type guard to check `targetStatus` field presence.
7. Rename `evaluateDepartmentScopedAction` → `evaluateUserScopedAction`.
8. Update `groupScopedActions` array and `GroupScopedAction` type to the new action names.
9. Update `globalActions` array: rename the three `membership.*` actions.
10. Update `evaluateUserScopedAction` switch:
    - `"user.view"`: `hasAdminGrant(a) || hasPeopleAdminGrant(a) || isDepartmentHead(a, scope.targetDepartment)`
    - `"user.edit.contact"`: `hasAdminGrant(a) || hasPeopleAdminGrant(a) || isDepartmentHead(a, scope.targetDepartment)`
    - `"user.edit.status"`: `hasAdminGrant(a) || isDepartmentHead(a, scope.targetDepartment)` — `people_admin` is explicitly excluded
    - `"user.complete_onboarding"`: `hasAdminGrant(a) || isLegalOfficer(a) || isDepartmentHead(a, scope.targetDepartment)`
    - `"user.membership.propose"`: `hasAdminGrant(a) || isLegalOfficer(a) || isDepartmentHead(a, scope.targetDepartment)` — `people_admin` excluded
11. Update `evaluateGroupScopedAction` switch to the new `group.*` action names.
12. Update `evaluateGlobalAction` switch: rename the three `membership.*` global actions.
13. Update `evaluateAuth` overloads: `DepartmentScopedAction` → `UserScopedAction`, `DepartmentScope` → `UserScope`.
14. Update `Action` union type: `GlobalAction | UserScopedAction | GroupScopedAction`.

**`people_admin` permission boundaries established here:**
- Allowed: `user.view`, `user.edit.contact`, `users.view_all`, `users.create`, `users.import`, `groups.view_all`, `group.view`, `group.export`
- Denied: `user.edit.status`, `user.membership.propose` (omitted from switch cases — defaults to false)

**Test scenarios (add to `src/lib/permissions/permissions.test.ts`):**
- `people_admin` + `user.edit.contact` → `true`
- `people_admin` + `user.edit.status` → `false`
- `people_admin` + `user.membership.propose` → `false`
- `people_admin` + `user.view` (any department) → `true`
- `admin` + `user.edit.contact` → `true`
- `admin` + `user.edit.status` → `true`
- `department_head(events)` + `user.view` with `targetDepartment: "events"` → `true`
- `department_head(events)` + `user.view` with `targetDepartment: "growth"` → `false`
- `isUserScopedAction("user.view")` → `true`
- `isUserScopedAction("users.view_all")` → `false`
- Existing `users.view_all` describe-block tests: update action strings; behavior unchanged
- All existing membership, group, and global action tests: update action strings; behavior unchanged

**Files:** `src/lib/permissions/evaluate.ts`

---

### IU2 — Public API updates (`server.ts`, `index.ts`, `can.tsx`)

**`src/lib/permissions/server.ts`:**
- Add import: `type UserStatus` from `@/db/schema/auth`.
- Rename `DepartmentScopedAction` overload → `UserScopedAction`.
- User-scoped overload: `user: { department: Department | null }` → `user: { department: Department | null; status: UserStatus }`.
- Replace `isDepartmentScopedAction` → `isUserScopedAction`.
- Update scope construction: `{ targetDepartment: resource?.department ?? null }` → `{ targetDepartment: resource?.department ?? null, targetStatus: resource?.status }`. Use non-null assertion or default since TypeScript now requires `status` in the overload.

**`src/lib/permissions/index.ts`:**
- Update all re-exports: `DepartmentScopedAction` → `UserScopedAction`, `DepartmentScope` → `UserScope`, `isDepartmentScopedAction` → `isUserScopedAction`.
- Keep `evaluateAuth` exported (it is used by `server.ts` and `can.tsx` within the permissions module; the contract is that external call sites use `can()` / `useCan()`, not `evaluateAuth` directly).

**`src/components/can.tsx`:**
- Add import: `type UserStatus` from `@/db/schema/auth`.
- Update `CanCheck` type: user-scoped overload gains `status: UserStatus` in the user resource argument.
- Update `CanProps` union: user-scoped branch's `context` type gains `status: UserStatus`.
- Update `useCan()` overloads to include `status` in user-scoped variant.
- Update `useCan()` internal implementation: pass `targetStatus: checkResource?.status` when building `UserScope`.
- Replace `isDepartmentScopedAction` → `isUserScopedAction` (and `DepartmentScope` → `UserScope`) in import and usage.

**Test scenarios (update `src/lib/permissions/permissions.typecheck.ts`):**
- `evaluateAuth(authority, "user.view", { targetDepartment: "events", targetStatus: "member" })` — compiles
- `evaluateAuth(authority, "user.view", { targetDepartment: "events" })` — `@ts-expect-error` (missing `targetStatus`)
- `evaluateAuth(authority, "users.view_all", { targetDepartment: "events" })` — `@ts-expect-error` (global action)
- `evaluateAuth(authority, "group.view", { isGroupMember: true })` — compiles
- `can("user.view", { department: "events", status: "member" })` — compiles
- `can("user.view", { department: "events" })` — `@ts-expect-error` (missing `status`)
- `can("users.view_all")` — compiles (no resource)
- `can("group.members.manage", { id: "gr_123" })` — compiles
- `check("user.view", { department: "events", status: "member" })` — compiles
- `check("user.view", { department: "events" })` — `@ts-expect-error`

**Files:** `src/lib/permissions/server.ts`, `src/lib/permissions/index.ts`, `src/components/can.tsx`

---

### IU3 — Delete `nav-access.ts`, update nav and admin layout

**`src/lib/permissions/nav-access.ts`:** Delete the file.

**`src/components/nav-main.tsx`:**
- Remove imports: `canAccessAdminBatches`, `canAccessAdminPeopleDirectory`, `canAccessAdminSettings`, `canAccessAnyAdminRoute` from `@/lib/permissions/nav-access`.
- Remove `useAuthority` import and the `authority` variable — `authority` is only used to feed the nav-access functions, so it becomes unused once those calls are replaced with `useCan()`.
- Add `useCan` import from `@/components/can` (it is already used in the file via `<Can>` components; the hook form may be new).
- Replace the manual variable computations:
  - `showAdminDirectory` = `useCan("users.view_all")`
  - `showAdminSettings` = `useCan("settings.positions.manage")`
  - `showAdminPeople` = `useCan("users.view_all") || useCan("batches.manage")`
  - `showAdminGroup` = `useCan("users.view_all") || useCan("payments.manage")`
- The inline `<Can permission="batches.manage">`, `<Can permission="groups.view_all">`, `<Can permission="payments.manage">` usages stay as-is.
- Remove `authority` variable if no longer needed after replacing the manual checks.

**`src/app/(authenticated)/(app)/admin/layout.tsx`:**
- Remove imports: `canAccessAnyAdminRoute` from `@/lib/permissions/nav-access`, `getUserAuthority` from `@/db/authority` (no longer used).
- Add import: `can` from `@/lib/permissions/server`.
- Replace the `authority` + `canAccessAnyAdminRoute` check with:
  ```
  const [canViewAll, canManagePayments] = await Promise.all([
    can("users.view_all"),
    can("payments.manage"),
  ]);
  if (!canViewAll && !canManagePayments) {
    return redirect("/membership");
  }
  ```

**Test scenarios (manual verification):**
- Admin sees People Directory, Groups, Settings, Batches in nav.
- `people_admin` sees People Directory, Groups in nav; no Batches, no Settings.
- `finance_admin` sees Payments in nav; no People, no Groups, no Batches, no Settings. Admin section is visible because of `payments.manage`.
- Department head sees People Directory in nav; no Payments, no Groups, no Batches, no Settings.
- Super admin sees all items including Settings.
- Plain member sees no Admin group.
- `finance_admin` accessing `/admin/payments` is allowed; accessing `/admin/people/directory` redirects (no `users.view_all`).

**Files:** `src/lib/permissions/nav-access.ts` (delete), `src/components/nav-main.tsx`, `src/app/(authenticated)/(app)/admin/layout.tsx`

---

### IU4 — Call site updates

Mechanical rename of action strings in all call sites, plus adding `status` to user-scoped resource objects. TypeScript compilation is the completeness check: any missed user-scoped `can()` call without `status` fails to compile.

All user-scoped server-action call sites pass a Drizzle-fetched user object (which includes `status`). All user-scoped client call sites use `<Can>` or `useCan()` with a user resource that has `status` available from the rendered data.

**`src/app/(authenticated)/(app)/admin/people/directory/[id]/page.tsx`:**
- `"users.view_details"` → `"user.view"` — `user` object already has `status`; no changes needed beyond the string rename since TypeScript will now require and accept `status` from the same object
- `"membership.propose"` → `"user.membership.propose"` — same as above

**`src/components/people-table.tsx`:**
- `"users.view_details"` → `"user.view"` in the `can()` call — `member` is a `PublicUser` which has `status: UserStatus`, so passing `member` as the resource already satisfies the new type requirement

**`src/app/(authenticated)/(app)/(people)/complete-onboarding-action.ts`:**
- `"users.complete_onboarding"` → `"user.complete_onboarding"` — `targetUser` is a Drizzle result with `status`

**`src/app/(authenticated)/(app)/(people)/propose-membership-action.ts`:**
- `"membership.propose"` → `"user.membership.propose"` — `targetUser` is a Drizzle result with `status`

**`src/app/(authenticated)/(app)/groups/[id]/page.tsx`:**
- `"groups.view"` → `"group.view"` — group-scoped action, no `status` change needed

**`src/app/api/groups/[id]/route.ts`:**
- `"groups.view"` → `"group.view"`

**`src/app/(authenticated)/(app)/groups/[id]/actions.ts`** (4 occurrences):
- `"groups.manage_members"` → `"group.members.manage"`

**`src/app/(authenticated)/(app)/groups/[id]/bulk-actions.ts`** (2 occurrences):
- `"groups.manage_members"` → `"group.members.manage"`

**`src/app/(authenticated)/(app)/groups/[id]/criteria-actions.ts`** (2 occurrences):
- `"groups.manage_members"` → `"group.members.manage"`

**`src/app/api/groups/[id]/criteria/route.ts`:**
- `"groups.manage_members"` → `"group.members.manage"`

**`src/db/groups.ts`:**
- `"groups.manage_members"` → `"group.members.manage"`

**`src/app/api/groups/[id]/export/route.ts`:**
- `"groups.export"` → `"group.export"`

**`src/app/(authenticated)/(app)/people/resolutions/[id]/vote-action.ts`:**
- `"membership.vote_resolution"` → `"membership.resolution.vote"`

**`src/app/(authenticated)/(app)/people/resolutions/[id]/page.tsx`:**
- `"membership.view_resolution"` → `"membership.resolution.view"`

**`src/app/(authenticated)/(app)/groups/[id]/page-client.tsx`:**
- `"users.view_details"` → `"user.view"` — `GroupMember extends PublicUser` which already has `status: UserStatus`, so no data change is needed

**Test scenarios:** TypeScript compilation with `npm run lint` or `tsc --noEmit` catches any remaining old action strings or missing `status` fields.

**Files:** 15 files listed above.

---

### IU5 — Test updates

**`src/lib/permissions/permissions.test.ts`:**
- Rename all old action strings to new names throughout.
- Add `targetStatus: "member"` (or another valid `UserStatus`) to all existing user-scoped `evaluateAuth()` calls (the `{ targetDepartment: ... }` calls).
- Add a `describe("people_admin")` block:
  - `user.edit.contact` → allowed
  - `user.edit.status` → denied
  - `user.membership.propose` → denied
  - `user.view` (with any department) → allowed
  - `users.view_all` → allowed
  - `groups.view_all` → allowed
- Update the `users.view_all` describe-block: action string unchanged (global); just verify no breakage.
- Update the department-scoped tests: action string `"users.view_details"` → `"user.view"`, scope object gains `targetStatus: "member"`.

**`src/lib/permissions/permissions.typecheck.ts`:**
- Replace all old action strings with new names.
- Update user-scoped `evaluateAuth()` calls to include `targetStatus`.
- Update user-scoped `can()` calls to include `status`.
- Update user-scoped `check()` (CanCheck) calls to include `status`.
- Verify `@ts-expect-error` lines still trigger for the missing-field cases.

**Files:** `src/lib/permissions/permissions.test.ts`, `src/lib/permissions/permissions.typecheck.ts`

---

## Sequencing

The units have a hard dependency chain — each IU depends on the previous one being complete:

1. **IU1** — Core evaluator. No external dependencies. Start here. TypeScript will immediately flag IU2/IU3/IU4 call sites once action strings change.
2. **IU2** — Public API. Depends on IU1 type names. Update `server.ts`, `index.ts`, `can.tsx` before touching call sites.
3. **IU3** — Nav deletion. Depends on IU2 (`useCan()` type updated). Delete `nav-access.ts` and update `nav-main.tsx`, `admin/layout.tsx`.
4. **IU4** — Call sites. Depends on IU2 (updated `can()` overload with `status`). Do all 15 files in one pass.
5. **IU5** — Tests. Depends on IU1 and IU2. Update tests last so they catch any remaining issues.

Run `npm run lint` after IU4 to surface any remaining old action strings via TypeScript errors.

---

## Risks

**Missing `targetStatus` in a call site.** TypeScript makes `targetStatus` required in `UserScope`, so compilation will surface any missed call site. All confirmed call sites already have `status` available: `GroupMember extends PublicUser` (has `status`), `PublicUser` (has `status`), and Drizzle full-user query results (have `status`).

**`nav-main.tsx` uses `useAuthority()` indirectly.** The current nav-main calls `canAccessAdminPeopleDirectory(authority)` etc. which takes the authority object. After switching to `useCan()` calls, the `useAuthority()` import may be unused if it was only needed for passing to nav-access functions. Check whether `useAuthority` is still used elsewhere in the component before removing it.

**Nav behavior regression.** Manually verify the nav shows/hides correctly for all role combinations (admin, people_admin, finance_admin, dept_head, super_admin, plain member) after IU3.

**`people_admin` test coverage.** The boundary cases — specifically the denied actions (`user.edit.status`, `user.membership.propose`) — must be explicitly tested. A missing test case would leave the exclusion unverified.
