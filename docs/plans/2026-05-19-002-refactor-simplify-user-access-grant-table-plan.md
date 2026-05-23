---
title: "refactor: Simplify user_access_grant table — remove scope, clean up department enum"
type: refactor
status: active
date: 2026-05-19
---

# refactor: Simplify user_access_grant table — remove scope, clean up department enum

## Summary

All access grants are inherently global — no department-scoped grant exists or is planned. The `scope` column in `user_access_grant` is therefore always `'global'` and adds no information; removing it yields a clean composite PK of `(userId, grant)`. Separately, the `department` enum contains a `'none'` sentinel value used only to satisfy the composite PK of `user_organization_position` for global officer positions (president, vice-president, head-of-finance). Removing `'none'` from the enum and making `user_organization_position.department` a nullable column — with NULL for global positions — eliminates all the TypeScript type mismatches that `'none'` causes without introducing a normalization helper.

---

## Problem Frame

This branch is mid-cleanup of the `user_access_grant` table: `department` was already removed as a column (migration 0034 applied). `scope` remains, even though the check constraint enforces it is always `'global'`. The redundant scope column keeps unnecessary complexity in the type system and in `evaluate.ts`'s grant helpers.

A second issue: the `department` enum includes `'none'` as a sentinel to allow global officer positions in the `user_organization_position` composite PK. Drizzle propagates the enum's `'none'` value into every column type that references it, but the application's `Department` type was defined as `Exclude<..., "none">`. This mismatch created TypeScript errors in multiple files. A prior partial attempt added `normalizeDepartment` and `NullableDepartment` to `auth.ts` — this is the **wrong direction**. The clean fix is to remove `'none'` from the enum entirely, make `user_organization_position.department` nullable (using SQL NULL for global positions), and change that table's PK from `(userId, position, scope, department)` to `(userId, position, scope)`.

### Current working-tree state

- `department` column removed from `user_access_grant` ✓ (migration 0034, committed)
- `scope` column still in `user_access_grant` (U1 not yet done)
- `NullableDepartment` type and `normalizeDepartment` function added to `auth.ts` — these are the wrong-direction partial changes that U3 must remove
- `normalizeDepartment` imported in `authority.ts` and `people.ts` — also wrong direction, to be cleaned up in U3
- Phantom `id` fields removed from `UserDetail`/`UserAuthorityData` type interfaces ✓, but query column selections and result mappings still reference `id` (U4)

---

## Requirements

- R1. `user_access_grant` has a simple composite PK of `(userId, grant)` with no `scope` or `department` columns.
- R2. All TypeScript code that consumed `scope` on grants compiles cleanly and behaves identically at runtime.
- R3. The `department` enum has no `'none'` value. `user_organization_position.department` is a nullable column with NULL for global officer positions. No `normalizeDepartment` helper exists in the codebase.
- R4. Position/grant arrays in `UserDetail` and `UserAuthorityData` do not claim an `id` field that does not exist on those tables.
- R5. `npx tsc --noEmit` passes with zero errors when the work is complete.

---

## Scope Boundaries

- `user_organization_position` PK changes from `(userId, position, scope, department)` to `(userId, position, scope)` — this is required by removing the 'none' sentinel.
- The `department` enum itself is reduced; `user.department` column on the `user` table is already nullable and stores NULL (not 'none') — no data migration needed for that column.
- No changes to how the app displays department names beyond what TypeScript requires.
- No changes to business logic: permission evaluation behaviour is identical after scope removal since all grants were already global.

---

## Context & Research

### Relevant Code and Patterns

- `src/db/schema/authority.ts` — `userAccessGrant` (scope removal) and `userOrganizationPosition` (nullable department + PK)
- `src/db/schema/auth.ts` — `department` enum, `Department` type, wrong-direction `NullableDepartment` + `normalizeDepartment` to remove
- `src/lib/authority/model.ts` — `GrantAssignment` type (`scope: "global"` to remove); `PositionAssignment` global branch uses `department?: "none"` → needs updating after enum change
- `src/lib/authority/assignments.ts` — `grantAssignmentSchema` (`scope: z.literal("global")` to remove); `positionAssignmentSchema` global branch (`department: z.literal("none").optional()` to remove)
- `src/lib/permissions/evaluate.ts` — grant helpers all check `assignment.scope === "global"` redundantly
- `src/db/authority.ts` — `PersistedPositionAssignment` (wrong-direction `NullableDepartment`); `mapPositionAssignment` checks `department === "none"` → must check `department === null`; wrong-direction `normalizeDepartment` usage in `mapAuthorityUser`
- `src/db/people.ts` — wrong-direction `normalizeDepartment` import; query column selections still have `id: true`; mapping still has `id: p.id` / `id: g.id`
- `src/components/authority-editor.tsx` — `ExistingPosition.department: Department` (not `Department | null`) — needs widening
- `src/app/(authenticated)/(app)/people/directory/[id]/authority-card.tsx` — React keys use `assignment.id` which doesn't exist

---

## Key Technical Decisions

- **Remove `scope` entirely, not just from PK**: Since `scope` carries no information (always 'global', enforced by check constraint), keeping it as a non-PK column would be misleading. Dropping it from the table and all application types is cleaner.
- **Remove `'none'` from the enum, not normalize it**: The `'none'` sentinel exists only to satisfy a composite PK constraint. Making `user_organization_position.department` nullable with a shorter PK is the right fix. This makes `Department` equal to all enum values, eliminates `NullableDepartment`, and makes `Department | null` the natural type for any nullable department in the app.
- **`mapPositionAssignment` checks `department === null` after the change**: The `"none"` branch in the current `mapPositionAssignment` becomes a `null` check. No other logic changes.
- **Remove `id` from position/grant array types**: `user_organization_position` and `user_access_grant` are composite-PK tables with no `id` column. The type claims were always wrong; `p.id` / `g.id` return `undefined` at runtime. Callers use these as React keys — replace with composite key strings.
- **Scope removal also simplifies `evaluate.ts` grant helpers**: Once `GrantAssignment` has no `scope`, each helper reduces to `authority.grants.some(a => a.grant === "X")`. No logic change.

---

## Open Questions

### Resolved During Planning

- *Do any department-scoped access grants exist or are planned?* No. The model, schema, and check constraint all agree. All grants are global. Scope can be removed without changing behaviour.
- *Should the `'none'` sentinel be normalized at boundaries, or removed from the source?* Removed from the source — making the column nullable means the type system expresses the constraint directly as `Department | null`, without a helper that must be applied consistently at every boundary.
- *Does `user.department` on the `user` table also use `'none'`?* No — it is already nullable (no `notNull()`) and stores SQL NULL for users without a department.

### Deferred to Implementation

- Whether `group-criteria-manager.tsx`'s `DEPARTMENT_OPTIONS` needs any change after 'none' is gone from the enum — since `department.enumValues` will only contain real departments, it may already be correct.
- Whether `membership-details-card.tsx` needs changes after the enum cleanup — `user.department` is `Department | null` naturally; check on first read.

---

## Implementation Units

### U1. Remove `scope` from `userAccessGrant` schema and generate migration

**Goal:** Drop the `scope` column from `user_access_grant`, set PK to `(userId, grant)`, and remove the now-redundant check constraint.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/db/schema/authority.ts`
- Generate: `drizzle/<next-migration>.sql` (via `npm run db:generate`)

**Approach:**
- In `userAccessGrant`, remove `scope: authorityScope("scope").notNull()` column
- Change `primaryKey({ columns: [table.userId, table.grant, table.scope] })` to `primaryKey({ columns: [table.userId, table.grant] })`
- Remove the `check("user_access_grant_valid_scope_check", ...)` constraint entirely — nothing to constrain when scope is gone
- Run `npm run db:generate` to emit the migration, then `npm run db:migrate` to apply

**Test scenarios:**
- Test expectation: none — this is a pure schema + migration change; correctness is verified by U2's TypeScript compile and the existing test suite passing post-migration.

**Verification:**
- Generated migration SQL contains `DROP COLUMN "scope"`, updates the PK, and drops the check constraint
- `npm run db:migrate` succeeds against the local database

---

### U2. Remove `scope` from all grant-related TypeScript code

**Goal:** Eliminate every reference to `scope` in `GrantAssignment`, `grantAssignmentSchema`, `PersistedGrantAssignment`, and all consuming code. Simplify `evaluate.ts` grant helpers.

**Requirements:** R2

**Dependencies:** U1

**Files:**
- Modify: `src/lib/authority/model.ts`
- Modify: `src/lib/authority/assignments.ts`
- Modify: `src/lib/authority/assignments.test.ts`
- Modify: `src/lib/permissions/evaluate.ts`
- Modify: `src/db/authority.ts`
- Modify: `src/db/people.ts`
- Modify: `src/components/authority-editor.tsx`
- Modify: `src/app/(authenticated)/(app)/people/directory/[id]/update-authority-action.ts`

**Approach:**

`src/lib/authority/model.ts`:
- `GrantAssignment` becomes `{ grant: GlobalAccessGrant }` — remove `scope` field

`src/lib/authority/assignments.ts`:
- `grantAssignmentSchema` union has one branch: `z.object({ grant: z.enum(globalAccessGrants) })` — remove `scope`
- Remove the `grants: input.grants.map(a => ({ ...a }))` transform scope passthrough

`src/lib/permissions/evaluate.ts`:
- `hasSuperAdminGrant`: simplify to `authority.grants.some(a => a.grant === "super_admin")`
- `hasAdminGrant`, `hasFinanceAdminGrant`, `hasPeopleAdminGrant`: same simplification — remove `a.scope === "global"` predicate from each

`src/db/authority.ts`:
- `PersistedGrantAssignment`: remove `scope` field
- `mapGrantAssignment`: simplify to just `return { grant: assignment.grant }` (no scope check needed)
- `replaceUserAuthority` insert: remove `scope: assignment.scope`

`src/db/people.ts`:
- `UserAuthorityData.accessGrants`: remove `scope` from item type
- `getUserAuthorityData` column selection: remove `scope: true` from `accessGrants` columns
- `getUserAuthorityData` mapping: remove `scope: g.scope`
- `UserDetail.accessGrants`: remove `scope` from item type
- `getUserById` mapping: remove `scope: assignment.scope` from grants map

`src/components/authority-editor.tsx`:
- `ExistingGrant` interface: remove `scope`
- `GrantInput` type: remove `scope`
- Grant initialisation in `handleSave`: remove `scope: "global"` from each pushed grant

`src/app/(authenticated)/(app)/people/directory/[id]/update-authority-action.ts`:
- The restored super_admin grant: remove `scope: "global" as const`

**Patterns to follow:**
- `src/lib/authority/model.ts` — `PositionAssignment` discriminated union shows the pattern for type-safe authority types
- Existing test structure in `src/lib/authority/assignments.test.ts`

**Test scenarios:**
- Happy path: `authorityUpdateInputSchema.safeParse({ ..., grants: [{ grant: "admin" }] })` succeeds and `result.data.grants` equals `[{ grant: "admin" }]`
- Happy path: `authorityUpdateInputSchema.safeParse({ ..., grants: [] })` succeeds with empty grants
- Error path: schema rejects an unknown grant value
- Unit: `hasSuperAdminGrant({ grants: [{ grant: "super_admin" }] })` returns true
- Unit: `hasSuperAdminGrant({ grants: [{ grant: "admin" }] })` returns false
- Unit: `hasAdminGrant` returns true for both `super_admin` and `admin` grants, false otherwise

**Verification:**
- `npx tsc --noEmit` shows no errors related to `scope` on grants
- `npx tsx --test src/lib/authority/assignments.test.ts src/lib/authority/model.test.ts` all pass

---

### U3. Remove 'none' from department enum and make user_organization_position.department nullable

**Goal:** Remove the `'none'` sentinel from the `department` pgEnum. Make `user_organization_position.department` nullable with NULL for global officer positions. Update the composite PK and check constraint. Clean up the wrong-direction `normalizeDepartment`/`NullableDepartment` additions made earlier on this branch.

**Requirements:** R3, R5

**Dependencies:** None (independent of U1/U2)

**Files:**
- Modify: `src/db/schema/auth.ts`
- Modify: `src/db/schema/authority.ts`
- Modify: `src/lib/authority/model.ts`
- Modify: `src/lib/authority/assignments.ts`
- Modify: `src/db/authority.ts`
- Possibly modify: `src/components/group-criteria-manager.tsx`, `src/app/(authenticated)/(app)/membership/membership-details-card.tsx`, `src/app/(authenticated)/(app)/people/import-google-user-schema.ts`, `src/components/authority-editor.tsx`
- Generate: `drizzle/<next-migration>.sql`

**Approach:**

`src/db/schema/auth.ts`:
- Remove `"none"` from the `department` pgEnum values array
- `Department` type no longer needs `Exclude`: change to `(typeof department.enumValues)[number]`
- Remove `NullableDepartment` type entirely
- Remove `normalizeDepartment` function entirely

`src/db/schema/authority.ts` (`userOrganizationPosition`):
- Change `department: department("department").notNull().default("none")` to `department: department("department")` (nullable, no default)
- Update PK: change from `[table.userId, table.position, table.scope, table.department]` to `[table.userId, table.position, table.scope]`
- Update check constraint: replace `${table.department} = 'none'` with `${table.department} IS NULL`, and `${table.department} != 'none'` with `${table.department} IS NOT NULL`
- The unique index `one_department_head_per_department_unique` should still work with a nullable column (unique partial index on non-null department values)

`src/lib/authority/model.ts`:
- `PositionAssignment` global branch: remove `department?: "none"` field (global positions have no department, nullable maps to the absence of a department field or `department: null`)

`src/lib/authority/assignments.ts`:
- `positionAssignmentSchema` global branch: remove `department: z.literal("none").optional()`
- Remove any transform that sets `department: "none"` for global positions

`src/db/authority.ts`:
- Remove `normalizeDepartment` import (and `NullableDepartment` if imported)
- `PersistedPositionAssignment.department`: change from `NullableDepartment` to `Department | null`
- `mapPositionAssignment`: change `assignment.department === "none"` checks to `assignment.department === null`; change `assignment.department` (falsy check for department head branch) to `assignment.department !== null`
- `mapAuthorityUser`: restore plain `department: authorityUser.department` (no normalization needed since NULL is now the natural value)

`src/components/authority-editor.tsx`:
- `ExistingPosition.department`: change from `Department` to `Department | null`

**Migration note:** PostgreSQL cannot drop an enum value while any row uses it. Before the auto-generated Drizzle migration can succeed, existing rows with `department = 'none'` in `user_organization_position` must be updated to NULL. The implementer must run this SQL manually **before** applying the migration:
```sql
UPDATE user_organization_position SET department = NULL WHERE department = 'none';
```
Then run `npm run db:generate` and `npm run db:migrate`. Verify the generated SQL renames the old enum, creates the new one without 'none', alters the column, and updates the PK.

**Also verify:** that `user.department` column has no rows with `'none'` (it was always nullable and should only contain NULL or real department values).

**Display components — check on first read:** Once `'none'` is gone from the enum, `department.enumValues` in `group-criteria-manager.tsx` is all real departments and `DEPARTMENT_OPTIONS` likely needs no filtering change. `membership-details-card.tsx` uses `user.department` which is `Department | null` naturally. `import-google-user-schema.ts` can use `z.enum(department.enumValues)` directly. Apply only the changes TypeScript requires.

**Test scenarios:**
- Unit: `positionAssignmentSchema.safeParse({ position: "president", scope: "global" })` succeeds without a `department` field
- Unit: `positionAssignmentSchema.safeParse({ position: "department_head", scope: "department", department: "partnerships" })` succeeds
- Unit: `mapPositionAssignment({ position: "president", scope: "global", department: null })` returns a valid `PositionAssignment`
- Unit: `mapPositionAssignment({ position: "department_head", scope: "department", department: "partnerships" })` returns a valid `PositionAssignment`
- TypeScript: no `TS2345` or `TS2322` errors referencing `"none"` anywhere in the codebase

**Verification:**
- Generated migration SQL updates existing 'none' rows (or confirms they are already gone), removes 'none' from the enum, makes the column nullable, and updates the PK
- `npx tsc --noEmit` shows no errors involving `"none"` or `NullableDepartment`

---

### U4. Fix phantom `id` fields on position/grant query selections and mappings

**Goal:** Complete the removal of phantom `id` from position/grant arrays. Type interfaces were already updated; this unit fixes the query column selections and result mappings that still reference `id`, and fixes React key usage in `authority-card.tsx`.

**Requirements:** R4

**Dependencies:** U2 (U2 already removes `scope` from grant types; do together to avoid intermediate broken state)

**Files:**
- Modify: `src/db/people.ts`
- Modify: `src/app/(authenticated)/(app)/people/directory/[id]/authority-card.tsx`

**Approach:**

`src/db/people.ts`:
- `getUserAuthorityData` query: remove `id: true` from `organizationPositions` column selection; remove `id: true` from `accessGrants` column selection
- `getUserAuthorityData` mapping: remove `id: p.id` from positions map; remove `id: g.id` from grants map
- `getUserById` query: `organizationPositions: true` and `accessGrants: true` fetch all columns; ensure mappings do not reference `.id` — remove `id: assignment.id` from positions and grants maps

`src/app/(authenticated)/(app)/people/directory/[id]/authority-card.tsx`:
- Positions badge loop: replace `key={assignment.id}` with composite key `` key={`${assignment.position}-${assignment.scope}`} ``
- Grants badge loop: replace `key={assignment.id}` with `key={assignment.grant}` (grant value is the natural unique key once scope is removed)

**Test scenarios:**
- Test expectation: none for pure type cleanup; correctness is verified by tsc passing and the React UI rendering without key warnings (manual check)

**Verification:**
- `npx tsc --noEmit` shows no `TS2339: Property 'id' does not exist` errors in `db/people.ts` or `authority-card.tsx`
- `getUserAuthorityData` result shape matches `UserAuthorityData` interface (no `id` in positions or grants)

---

## System-Wide Impact

- **Permission evaluation**: Removing `scope` from grant helpers is a no-op at runtime — all grants were already 'global'. The `evaluateAuth` function's observable output is unchanged.
- **`user_organization_position.department`**: NULL replaces 'none' for global officer positions. `mapPositionAssignment` checks `=== null` instead of `=== "none"`. The `Department | null` type in application code naturally expresses "no department".
- **`Department` type**: Now equals all enum values directly (no `Exclude`). `NullableDepartment` is gone. Code using `Department | null` is the clean replacement everywhere.
- **React keys**: Positions use `position-scope` composite key; grants use grant name. Both are unique within a user's authority data.
- **Unchanged invariants**: `evaluateAuth`, `isDepartmentHead`, all `GlobalAction` permission checks, and the `user_organization_position` unique partial indices are entirely untouched.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Migration fails because existing rows have `department = 'none'` in `user_organization_position` | Run `UPDATE user_organization_position SET department = NULL WHERE department = 'none'` before applying the migration |
| `user.department` column unexpectedly has 'none' rows | Verify with `SELECT COUNT(*) FROM "user" WHERE department = 'none'` before running migration |
| Migration drops scope from existing `user_access_grant` rows — no data loss concern since scope was always 'global' | Confirm in migration SQL before applying |
| `mapGrantAssignment` currently throws on non-global scope — after removal the throw path disappears; verify no grants were accidentally stored with other scope values | The check constraint already prevents this; migration is safe |

---

## Sources & References

- Current schema: `src/db/schema/authority.ts`, `src/db/schema/auth.ts`
- Permission evaluation: `src/lib/permissions/evaluate.ts`, `src/lib/permissions/server.ts`
- Authority model: `src/lib/authority/model.ts`, `src/lib/authority/assignments.ts`
