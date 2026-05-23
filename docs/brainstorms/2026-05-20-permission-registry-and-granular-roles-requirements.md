---
date: 2026-05-20
topic: permission-registry-and-granular-roles
---

# Permission Registry and Granular Roles Requirements

## Problem Frame

The current permission system (delivered by the 2026-05-02 and 2026-05-03 brainstorms) is correct and readable but has structural limitations that make it hard to add fine-grained roles in the future:

1. **`users.edit` is too coarse.** A single action covers all user edits: contact info, alumni status, membership status. There is no way to give someone edit-contact access without also giving them edit-status access.

2. **`people_admin` was never fully defined.** It was deferred in the 2026-05-03 pass and currently exists only partially in the codebase.

3. **No status-scoped access.** Permissions can be scoped by department (department head) but not by user status. There is no way to express "can only see and edit alumni users."

4. **nav-access.ts is manually maintained.** Helper functions like `canAccessAdminPeopleDirectory` hand-code which permission gates which section. They must be updated whenever a new role is added.

The goal is a design where:
- Adding a new grantable role means editing one file (evaluate.ts), with only a mechanical DB migration alongside it.
- Nav section visibility derives from `can()` / `useCan()` calls directly, not from a separate helper layer.
- Permissions are fine-grained enough to give a user "can edit contact info but not status."
- Grant-based roles and position-based roles are expressed uniformly in the switch — both as helper function calls.

---

## Prior Context

- `docs/brainstorms/2026-05-02-permission-policy-api-requirements.md` — introduced named predicates and the evaluator/API split.
- `docs/brainstorms/2026-05-03-simple-permission-evaluator-requirements.md` — replaced DSL with a readable switch-based evaluator. Explicitly deferred `people_admin`.
- The current `src/lib/permissions/evaluate.ts` is the output of those two passes.

---

## Actors

- A1. Admin or authorized member: Attempts protected reads or mutations.
- A2. Frontend UI: Shows or hides affordances based on the current member's authority context.
- A3. Server guard: Enforces authorization in pages, actions, route handlers, and workflows.
- A4. Implementer: Adds a new grantable role or fine-grained permission to the system.

---

## Requirements

### Action naming and granularity

- R1. User-scoped actions (require a specific target user in context) use the singular prefix `user.*`. Examples: `user.view`, `user.edit.contact`, `user.membership.propose`.
- R2. Collection-level actions (no specific user required) use the plural prefix `users.*`. Examples: `users.view_all`, `users.create`, `users.import`.
- R3. Same rule applies to groups: `group.view`, `group.members.manage`, `group.export` vs `groups.view_all`, `groups.create`.
- R4. Artifacts owned by a specific user use the `user.` namespace. Example: `user.membership.propose` (propose THIS user for membership).
- R5. Org-level membership actions that do not target a specific user use a top-level namespace. Examples: `membership.resolution.vote`, `membership.resolution.view`, `membership.workflows.manage`.
- R6. The current `users.edit` action is split into two finer-grained user-scoped actions:
  - `user.edit.contact` — edit name, address, phone, avatar.
  - `user.edit.status` — change alumni status or membership type.
- R7. Action types are derived from their `as const` arrays via `(typeof array)[number]` — not written as separate manual union types alongside the arrays. The arrays are the single source of truth; the types follow from them. This is already the pattern for `GlobalAction` in the current evaluator and must be applied consistently to `UserScopedAction` and `GroupScopedAction`. The type guards use the same arrays, so adding an action to the array is the only step needed.

### Evaluator structure

- R8. `src/lib/permissions/evaluate.ts` remains the single switch-based evaluator, as established in the 2026-05-03 pass. No separate registry file is introduced.
- R9. Each switch case expresses the full rule for that action as a boolean combination of helper function calls. The case body is the authoritative definition of who can perform the action.
- R10. Helper functions exist for every grantable role and every relevant position. Grant helpers check `authority.grants`; position helpers check `authority.positions`. Both have the same call shape at the switch-case level.
- R11. Grant helpers: `isAdmin()`, `isSuperAdmin()`, `isPeopleAdmin()`, `isFinanceAdmin()`. Future status-scoped grant helpers additionally accept the target user's status and return false when the status does not match the grant's allowed set — but no such helpers are introduced in this pass.
- R12. Position helpers: `isLegalOfficer()`, `isPresident()`, `isVicePresident()`, `isHeadOfFinance()`, `isDepartmentHead(authority, targetDepartment)`. These are unchanged from the current implementation.
- R13. A switch case may freely mix grant helpers and position helpers. Example: `case "user.membership.propose": return isAdmin(a) || isLegalOfficer(a) || isDepartmentHead(a, scope.targetDepartment)`.
- R14. Group member self-access (members can view and export their own group) is handled in the group-scoped switch cases via the `isGroupMember` scope field, as it is today.
- R15. The evaluator is internal. `can()` is the only external API for permission checks. `evaluateAuth()` is not exported from `src/lib/permissions/` for use outside the permissions module.

### Adding a new grantable role

- R16. Adding a new grantable role requires:
  1. A DB migration to add the new value to the `GlobalAccessGrant` enum (mechanical — no logic change).
  2. A new helper function in `evaluate.ts` for the new grant.
  3. Adding that helper to the relevant switch cases in `evaluate.ts`.
  - No other files require changes.
- R17. Status-scoped roles (roles that only apply to users with a specific target status) are expressed via a helper that accepts `targetStatus` and returns false when the status is not in the allowed set. Pass `targetStatus=undefined` only for global actions where no target user exists; the helper returns true in that case, allowing the global action through. This pattern is established by the design but not implemented in this pass — no status-scoped roles are introduced here.

### Built-in roles (defined in this pass)

- R18. `super_admin`: Unchanged behavior. All admin permissions plus `users.manage_authority`, `users.impersonate`, `settings.positions.manage`.
- R19. `admin`: Unchanged behavior, updated to use the new action names.
- R20. `finance_admin`: `payments.manage` only. Unchanged.
- R21. `people_admin` (introduced in this pass): Permitted actions — `users.view_all`, `users.create`, `users.import`, `groups.view_all`, `user.view` (any status), `user.edit.contact` (any status), `group.view`, `group.export`. Explicitly excluded — `user.edit.status`, `user.membership.propose`.
- R22. Position-based permissions (legal officers, department heads) are unchanged in behavior and continue to be expressed via the position helper functions in the switch.

### Nav visibility

- R23. `src/lib/permissions/nav-access.ts` is deleted.
- R24. Nav section visibility is determined by direct `useCan()` calls in nav components and `can()` calls in layout guards. A section is visible if and only if the user holds a permission that gates it. Multiple `can()` / `useCan()` calls in the same render are safe: both `getCurrentUser` and `getUserAuthority` are wrapped in React's `cache()` (verified in `src/db/user.ts` and `src/db/authority.ts`), so all calls within one request share a single DB result.
- R25. Example call sites (informative, not a separate config):
  - People Directory: `useCan("users.view_all")` — true for admin, people_admin, any dept head, and any future role included in the `users.view_all` switch case.
  - Groups: `useCan("groups.view_all")`.
  - Payments: `useCan("payments.manage")`.
  - Batches: `useCan("batches.manage")`.
  - Settings: `useCan("settings.positions.manage")`.
- R26. When a new role is added and its helper is included in the `users.view_all` case, People Directory becomes visible for holders of that role without touching any nav file.
- R27. The admin layout's `canAccessAnyAdminRoute` guard simplifies to two checks: `users.view_all` (covers admin, people_admin, dept heads, and any future role with directory access) and `payments.manage` (covers finance_admin and head_of_finance, who are the only grant holders without `users.view_all`). All other admin sections — groups, batches, settings — are only accessible to roles that also have `users.view_all`, so they do not need to be checked separately in the layout gate.

### Public API (unchanged)

- R27. `can()` in `src/lib/permissions/server.ts` remains the server-side API.
- R28. `<Can>` and `useCan()` in `src/components/can.tsx` remain the client-side API.
- R29. No page, action, or component calls `evaluateAuth()` directly.

### Scope context changes

- R30. The scope argument to user-scoped `can()` calls gains a `targetStatus: UserStatus` field alongside the existing `targetDepartment`. Callers pass the target user's status so status-scoped helpers in the switch can evaluate it.
- R31. All existing call sites that check user-scoped actions must be updated to pass `targetStatus`. This is a required mechanical update; the authorization outcomes for current roles are unchanged because current helpers ignore `targetStatus`.

---

## Acceptance Examples

- AE1. **Covers R6, R21.** A `people_admin` grant holder can edit a user's contact info (`user.edit.contact` → allowed). They cannot change a user's alumni status (`user.edit.status` → denied). They cannot propose someone for membership (`user.membership.propose` → denied).
- AE2. **Covers R17.** When a future status-scoped role (e.g., `alumni_manager`) is added, its helper returns false for non-matching target statuses. A holder can view alumni users but the same `can("user.view", { ..., status: "member" })` call returns false for member targets.
- AE3. **Covers R26.** When a future role is added and its helper is included in the `users.view_all` case, a holder sees the People Directory nav item without any nav file changes.
- AE4. **Covers R15, R29.** A server action that calls `evaluateAuth()` directly fails a code review. All server enforcement goes through `can()`.
- AE5. **Covers R22.** Legal officer and department head permissions continue to work as before. A president can still vote on resolutions; a department head can still view and edit members in their department.
- AE6. **Covers R7, R30.** Calling `can("user.view", { targetDepartment: null })` without `targetStatus` is a TypeScript error. All call sites must pass the target user's status.

---

## Success Criteria

- Adding a future status-scoped role (e.g., `alumni_manager`) requires editing only `evaluate.ts` (new helper + relevant cases) plus a mechanical DB enum migration.
- `people_admin` is properly defined: contact edits allowed, status edits and membership proposals denied.
- A code reader can understand who can perform any action by reading its single switch case.
- `nav-access.ts` is deleted; nav visibility is driven by `can()` / `useCan()` call sites.
- All existing authorization outcomes are preserved.
- The test suite in `src/lib/permissions/permissions.test.ts` covers the new action names, status-scoped helpers, and the `people_admin` boundary cases.

---

## Scope Boundaries

**In scope:**
- Rename existing actions to follow the `user.*` / `users.*` / `group.*` / `groups.*` convention.
- Split `users.edit` into `user.edit.contact` and `user.edit.status`.
- Add `targetStatus` to user scope context and update all user-scoped call sites.
- Introduce `people_admin` grant with the defined permission set.
- Restructure `evaluate.ts` to use the new action names, new helpers, and new split cases.
- Delete `nav-access.ts` and replace call sites with direct `can()` / `useCan()` calls.

**Out of scope:**
- A separate registry file or ROLES data structure.
- Visual UI for creating or editing roles.
- Permission audit logging.
- Arbitrary custom role creation at runtime by end users.
- Any new product features beyond what the permission model enables.

---

## Key Decisions

- **Switch is the registry:** The switch cases in `evaluate.ts` are the authoritative source of truth for who can do what. No separate data structure duplicates this. This continues the pattern established in the 2026-05-03 pass.
- **Grant helpers and position helpers are uniform:** `isPeopleAdmin()` and `isDepartmentHead()` are the same kind of call. The switch mixes them freely — there is no separate section for grants vs positions.
- **Status-scoped roles use helpers that accept targetStatus:** The status filter is not a data structure; it is logic inside the helper function for that grant. This keeps the switch readable without introducing a filter-matching abstraction.
- **No ADMIN_NAV config:** Nav visibility is expressed as direct `can()` / `useCan()` calls at the component level.
- **Multiple `can()` calls are safe:** `getCurrentUser` and `getUserAuthority` are both wrapped in React's `cache()`, so repeated calls within the same render deduplicate to one DB hit each. The 5-call nav pattern and the 2-call layout gate carry no performance penalty.
- **Admin layout gate is `users.view_all || payments.manage`:** All other admin sections (groups, batches, settings) require admin, which already implies `users.view_all`. Only `finance_admin` and `head_of_finance` reach admin routes without `users.view_all`, via `payments.manage`.
- **DB enum question deferred to planning:** Whether the grant enum stays as a Postgres enum (one migration per new role) or becomes a varchar (no migration but weaker validation) is a trade-off for planning to decide.

---

## Dependencies / Assumptions

- Current permission infrastructure: `src/lib/permissions/evaluate.ts`, `src/lib/permissions/server.ts`, `src/components/can.tsx`, `src/lib/permissions/authority-context.tsx`.
- Current nav: `src/lib/permissions/nav-access.ts` (to be deleted), `src/components/nav-main.tsx`.
- Database: `user_access_grant` table stores grant type as a Postgres enum in `src/db/schema/authority.ts`. Adding new grant values requires a migration.
- Existing test suite: `src/lib/permissions/permissions.test.ts`.

---

## Outstanding Questions

### Resolve Before Planning

- None.

### Deferred to Planning

- [Affects Key Decisions] Whether the DB `GlobalAccessGrant` enum stays as a Postgres enum (requires a migration per new grant) or becomes a varchar with an application-level check list (no migration, but weaker DB-level validation).
- [Affects R30, R31] Exact overload shapes for `can()`, `<Can>`, and `useCan()` to carry `targetStatus` without breaking existing call sites.
- [Affects R6] Full inventory of current call sites that check `users.edit` and the rename strategy for each.
- [Affects R27] Whether `canAccessAnyAdminRoute` in `src/app/(authenticated)/(app)/admin/layout.tsx` is replaced with two inline `can()` calls (`users.view_all || payments.manage`) or a small named local helper that makes the intent explicit.

---

## Next Steps

-> `/ce-plan` for structured implementation planning.
