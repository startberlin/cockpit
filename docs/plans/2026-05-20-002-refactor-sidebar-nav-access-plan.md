---
title: "refactor: Nav item visibility — single source of truth via nav-access layer"
type: refactor
status: active
date: 2026-05-20
---

# refactor: Nav item visibility — single source of truth via nav-access layer

## Summary

Introduces a `nav-access.ts` module with named per-route access functions that become the single source of truth for which admin sidebar items are visible and which pages are accessible. `nav-main.tsx` and `admin/layout.tsx` currently hard-code raw `authority.grants.some()` / `authority.positions.some()` checks that duplicate — and can silently drift from — the auth guards that pages enforce. After this refactor, both nav visibility and page guards derive from the same functions, making drift structurally impossible.

---

## Problem Frame

Three independent places currently re-implement the same admission logic in different ways:

1. `nav-main.tsx` (client component) — inline `authority.grants.some()` / `authority.positions.some()` arrays, bypassing `evaluateAuth()` entirely.
2. `admin/layout.tsx` (server component) — the same raw array checks again, duplicated verbatim.
3. Individual admin page components — some use `can("action")` which correctly calls `evaluateAuth()`; one (`admin/people/directory`) has no page-level guard at all, relying solely on the layout's broad check.

Adding a new admin route means updating at minimum three places; forgetting one silently breaks either visibility or access control.

---

## Requirements

- R1. One authoritative module (`nav-access.ts`) defines which authority is required to access each admin route. No other module re-implements this logic.
- R2. `nav-main.tsx` derives all admin item visibility from `nav-access.ts` functions; no inline `authority.grants.some()` or `authority.positions.some()` calls remain.
- R3. `admin/layout.tsx` derives its guard condition from `nav-access.ts`; no inline grant/position arrays remain.
- R4. Every admin route's `page.tsx` has a server-side guard that calls `can("action")` where the action maps to the same `evaluateAuth()` branch as the corresponding `nav-access.ts` function.
- R5. The `admin/people/directory` page gains a page-level guard it is currently missing.
- R6. No behaviour change: the same users who can see an admin nav item today can still see it after the refactor; the same users who are blocked are still blocked.

---

## Scope Boundaries

- No changes to page content or data queries — guards only.
- No changes to the Community group or Personal group nav items; they need no permission gating.
- `admin/people/directory/[id]` already gates per-action inside the component (`can("users.view_details", user)`); that pattern is out of scope.
- The parallel navigation redesign plan (`docs/plans/2026-05-20-001-feat-navigation-redesign-grouped-sidebar-plan.md`) restructures the groups and adds new routes. This plan is compatible: `nav-access.ts` functions work for both the current nav structure and the new three-group structure.

---

## Context & Research

### Relevant Code and Patterns

- `src/lib/permissions/evaluate.ts` — `evaluateAuth()` is the single evaluator. It is not `server-only` and can be called from both client and server code. Adding a new `GlobalAction` requires: adding the string to `globalActions`, adding a `case` in `evaluateGlobalAction()`.
- `src/lib/permissions/server.ts` — `can("action")` wraps `evaluateAuth()` with automatic user and authority loading. Used by server page components for guards.
- `src/lib/permissions/authority-context.tsx` — `useAuthority()` returns the `UserAuthority` already serialised to the client by the app layout. `nav-main.tsx` uses this today.
- `src/components/nav-main.tsx` — three raw inline checks: `showAdminGroup`, `canSeeAdminDirectory`, `canSeeSettings`. The `<Can permission="...">` wrappers on Groups, Payments, and Batches already use the permission system correctly.
- `src/app/(authenticated)/(app)/admin/layout.tsx` — raw inline check for `hasAdminAccess`; identical logic to `showAdminGroup` in nav-main.
- `src/app/(authenticated)/(app)/admin/people/directory/page.tsx` — **no auth guard**. Relies entirely on the layout's broad check.
- `src/app/(authenticated)/(app)/admin/groups/page.tsx` — uses `can("groups.view_all")`. Correct.
- `src/app/(authenticated)/(app)/admin/settings/positions/page.tsx` — uses `can("settings.positions.manage")`. Correct.
- `src/app/(authenticated)/(app)/people/batches/page.tsx` — uses `can("batches.manage")`. Correct. (`admin/people/batches/page.tsx` re-exports it.)
- `src/app/(authenticated)/(app)/payments/page.tsx` — uses `can("payments.manage")`. Correct. (`admin/payments/page.tsx` re-exports it.)

### Institutional Learnings

- **Permission policy API convention** (`docs/solutions/conventions/reusable-permission-policy-api-2026-05-02.md`): use `can()` for server enforcement; `<Can>` / `useCan()` for client affordances; do not import the low-level evaluator directly in app UI. `nav-access.ts` is a permissions library module, not app UI, so importing `evaluateAuth()` there is within convention. App components import `nav-access.ts`, not `evaluateAuth` directly.
- **Any new permission check** must add a case in `evaluateAuth()` in `evaluate.ts` and add runtime tests.

---

## Key Technical Decisions

- **`nav-access.ts` functions take `UserAuthority`, not a route string.** They are pure boolean predicates — no async, no DB calls. This makes them usable from both the client (nav-main via `useAuthority()`) and the server (layout, pages after calling `getUserAuthority()`).
- **New `GlobalAction "users.view_all"` for the people-directory gate.** The existing `"users.view_details"` action is a `DepartmentScopedAction` and does not include `people_admin`. The nav and layout currently allow `people_admin` to see Admin > People > Directory, which matches the product requirement. Adding `"users.view_all"` (admin + people_admin + any department_head) creates a clean evaluator case for this need rather than scattering the `people_admin` check across the nav and layout.
- **`canAccessAnyAdminRoute(authority)` derived bottom-up.** The admin layout guard and nav `showAdminGroup` both reduce to "would this user see at least one admin item?" Deriving this via the OR of all per-item functions means the layout guard stays automatically in sync if items are added or removed.
- **Existing `can("action")` calls in pages are preserved.** Pages call `can("action")` from `server.ts` which internally calls `evaluateAuth()` — the same branch that `nav-access.ts` functions call. No need to change pages to import `nav-access.ts`; the invariant is that the action string used in `can()` and the action string wrapped by `nav-access.ts` are the same.

---

## Open Questions

### Resolved During Planning

- **Does `people_admin` currently see Admin > People > Directory?** Yes — nav-main explicitly includes `people_admin` in `canSeeAdminDirectory`. This is the correct product intent. A new evaluator action is needed to formalise it.
- **Is `evaluate.ts` safe to import in client-bundled code?** Yes — no `"server-only"` marker; it contains only pure TypeScript logic with no Node.js dependencies.

### Deferred to Implementation

- **Data scoping for department heads in admin directory.** Department heads can access the admin people directory but should see only their own department's members. `getAllUsersForAdmin()` may not enforce this scoping today. That's a data-access concern separate from the access check; defer to implementation.

---

## Implementation Units

### U1. Add `"users.view_all"` GlobalAction to the evaluator

**Goal:** Give the permission evaluator a named action for "can see the admin people listing," covering admin, super_admin, people_admin grants and any department_head position. This is the authority missing for the admin people directory page guard.

**Requirements:** R1, R4, R5

**Dependencies:** None

**Files:**
- Modify: `src/lib/permissions/evaluate.ts`
- Modify: `src/lib/permissions/permissions.test.ts`
- Modify: `src/lib/permissions/permissions.typecheck.ts`

**Approach:**
- Add `"users.view_all"` to the `globalActions` const array.
- Add a `case "users.view_all":` branch in `evaluateGlobalAction()` returning `hasAdminGrant(authority) || hasPeopleAdminGrant(authority) || isDepartmentHead(authority, undefined)`.
  - Note: `isDepartmentHead(authority, undefined)` matches any department head (the `undefined` path in the existing helper).
- The `GlobalAction` union type widens automatically from the const array; no manual type edits needed.

**Patterns to follow:**
- Existing `case "groups.view_all":` in `evaluateGlobalAction()` — parallel structure.
- `isDepartmentHead(authority, undefined)` usage already present in the file.

**Test scenarios:**
- Happy path: `admin` grant → `evaluateAuth(authority, "users.view_all")` returns true.
- Happy path: `super_admin` grant → returns true.
- Happy path: `people_admin` grant → returns true.
- Happy path: `department_head` position (any dept) → returns true.
- Error path: plain member (no grants, no positions) → returns false.
- Error path: `finance_admin` grant only → returns false.
- Error path: `head_of_finance` position only → returns false.
- Error path: `president` position only → returns false.
- Type-level: `"users.view_all"` is accepted as a `GlobalAction` argument to `evaluateAuth()`.

**Verification:** Tests pass. `permissions.typecheck.ts` compiles without error.

---

### U2. Create `src/lib/permissions/nav-access.ts`

**Goal:** A single module that maps every admin nav route to an access predicate. This is the canonical file an implementer reads to answer "which authority is needed to see X in the nav?"

**Requirements:** R1, R2, R3

**Dependencies:** U1 (uses `"users.view_all"`)

**Files:**
- Create: `src/lib/permissions/nav-access.ts`

**Approach:**
- Export one named function per admin nav item:
  - `canAccessAdminPeopleDirectory(authority)` → `evaluateAuth(authority, "users.view_all")`
  - `canAccessAdminBatches(authority)` → `evaluateAuth(authority, "batches.manage")`
  - `canAccessAdminGroups(authority)` → `evaluateAuth(authority, "groups.view_all")`
  - `canAccessAdminPayments(authority)` → `evaluateAuth(authority, "payments.manage")`
  - `canAccessAdminSettings(authority)` → `evaluateAuth(authority, "settings.positions.manage")`
- Export a derived aggregate:
  - `canAccessAnyAdminRoute(authority)` → OR of all five functions above.
- No `"server-only"` marker — the file must remain importable from client components.
- All functions are synchronous pure predicates; no async, no DB access.

**Technical design:**

> *Directional guidance only — not implementation specification.*

```
// shape of the module (not literal code)
import { evaluateAuth } from "./evaluate"
import type { UserAuthority } from "./index"

canAccessAdminPeopleDirectory(authority)  →  evaluateAuth(authority, "users.view_all")
canAccessAdminBatches(authority)          →  evaluateAuth(authority, "batches.manage")
canAccessAdminGroups(authority)           →  evaluateAuth(authority, "groups.view_all")
canAccessAdminPayments(authority)         →  evaluateAuth(authority, "payments.manage")
canAccessAdminSettings(authority)         →  evaluateAuth(authority, "settings.positions.manage")

canAccessAnyAdminRoute(authority)         →  OR of all five above
```

**Patterns to follow:**
- `src/lib/permissions/server.ts` — thin wrapper pattern; call `evaluateAuth()` rather than re-implement.

**Test scenarios:**

For `canAccessAdminPeopleDirectory`:
- Happy path: `people_admin` grant → true (this is the gap the new action closes).
- Happy path: `admin` grant → true.
- Happy path: department_head position → true.
- Error path: `finance_admin` grant only → false.

For `canAccessAnyAdminRoute`:
- Happy path: `finance_admin` only → true (payments gate passes).
- Happy path: `head_of_finance` position only → true.
- Happy path: `department_head` only → true.
- Error path: plain member → false.
- Error path: `president` position only → false.

**Verification:** All exported functions return the expected boolean for the authority fixtures used in U1 tests.

---

### U3. Add page-level guard to `admin/people/directory`

**Goal:** Ensure the admin people listing page enforces access on its own, rather than relying solely on the layout.

**Requirements:** R4, R5

**Dependencies:** U1 (the `"users.view_all"` action must exist for `can()` to accept it)

**Files:**
- Modify: `src/app/(authenticated)/(app)/admin/people/directory/page.tsx`

**Approach:**
- At the top of the server component function, add `if (!(await can("users.view_all"))) { redirect("/membership"); }` before any data fetch.
- Import `can` from `@/lib/permissions/server` (already used in sibling pages) and `redirect` from `next/navigation`.

**Patterns to follow:**
- `src/app/(authenticated)/(app)/admin/groups/page.tsx` — identical guard pattern.

**Test scenarios:**
- Happy path: `people_admin` user navigates to `/admin/people/directory` → page renders.
- Happy path: `admin` user → page renders.
- Happy path: `department_head` → page renders.
- Error path: `finance_admin` only (passes layout, should be blocked at page level) → redirect to `/membership`.

**Verification:** A user holding only `finance_admin` is redirected when navigating directly to `/admin/people/directory`, even though the admin layout passes them through.

---

### U4. Update `admin/layout.tsx` to use `canAccessAnyAdminRoute`

**Goal:** Replace the inline grants/positions check in the admin layout with the canonical function from `nav-access.ts`.

**Requirements:** R3, R6

**Dependencies:** U2

**Files:**
- Modify: `src/app/(authenticated)/(app)/admin/layout.tsx`

**Approach:**
- Import `canAccessAnyAdminRoute` from `@/lib/permissions/nav-access`.
- Replace the `const hasAdminAccess = authority.grants.some(...) || authority.positions.some(...)` block with `const hasAdminAccess = canAccessAnyAdminRoute(authority)`.
- The redirect logic (`if (!hasAdminAccess) redirect("/membership")`) is unchanged.

**Patterns to follow:**
- Existing layout structure — only the condition expression changes.

**Test scenarios:**
- Happy path: each of the six qualifying user types (admin, super_admin, people_admin, finance_admin, department_head, head_of_finance) → children rendered.
- Error path: plain member → redirect.
- Error path: `president` position only → redirect (matches existing behaviour).
- Regression: behaviour identical to current inline check for all authority combinations.

**Verification:** Existing layout test scenarios pass. The inline grants/positions arrays are gone from the file.

---

### U5. Update `nav-main.tsx` to use nav-access functions

**Goal:** Remove all inline authority checks from the nav component; replace with named calls to `nav-access.ts`.

**Requirements:** R2, R6

**Dependencies:** U2

**Files:**
- Modify: `src/components/nav-main.tsx`

**Approach:**
- Import `canAccessAdminPeopleDirectory`, `canAccessAdminBatches`, `canAccessAdminSettings`, `canAccessAnyAdminRoute` from `@/lib/permissions/nav-access`.
- Replace `showAdminGroup` inline derivation with `canAccessAnyAdminRoute(authority ?? { grants: [], positions: [], status: "inactive" })` (or null-guard inline; authority is typed as `UserAuthority | null` from `useAuthority()`).
- Replace `canSeeAdminDirectory` derivation with `canAccessAdminPeopleDirectory(authority)` (null-guarded).
- Replace `canSeeSettings` derivation with `canAccessAdminSettings(authority)` (null-guarded).
- Replace `showAdminPeople = canSeeAdminDirectory || can("batches.manage")` with `canAccessAdminPeopleDirectory(authority) || canAccessAdminBatches(authority)`.
- The `<Can permission="batches.manage">`, `<Can permission="groups.view_all">`, and `<Can permission="payments.manage">` wrappers on individual `SidebarMenuItem` elements are already correct — leave them unchanged.

**Patterns to follow:**
- Existing `useAuthority()` usage in the component — keep the same null-safe pattern.

**Test scenarios:**
- Happy path: `people_admin` user → Admin group shown; People > Directory visible; Batches hidden; Groups visible; Payments hidden; Settings hidden.
- Happy path: `finance_admin` user → Admin group shown; only Payments visible.
- Happy path: `department_head` only → Admin group shown; only People > Directory visible.
- Happy path: `admin` grant → all five items visible.
- Error path: plain member → Admin group not rendered.
- Regression: no authority (null context) → Admin group not rendered; no JS error.

**Verification:** Nav renders identically to the current implementation for every authority combination. No `authority.grants.some()` or `authority.positions.some()` calls remain in the file.

---

## System-Wide Impact

- **Interaction graph:** `admin/layout.tsx` and `nav-main.tsx` both call into `nav-access.ts`. Any future change to what qualifies for admin access updates one function; both consumers reflect it automatically.
- **Error propagation:** Guard failures produce `redirect("/membership")` — same destination as today, no change to error surface.
- **API surface parity:** The `<Can>` wrappers in `nav-main.tsx` for Groups, Payments, and Batches are left unchanged — they already use the permission system correctly and do not need nav-access wrappers for the nav rendering layer.
- **Unchanged invariants:** The `evaluateAuth()` switch-case logic for all existing actions is unchanged. Only a new case (`"users.view_all"`) is added. The `can()` server utility, `<Can>` component, and `useCan()` hook are unchanged. The community group and personal group nav items have no gating and are not touched.
- **Integration coverage:** The admin layout guard and the page-level guard on `/admin/people/directory` now both derive from the same evaluator branch, so any change to `"users.view_all"` in `evaluateAuth()` propagates to both simultaneously.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `nav-access.ts` imported in client bundle pulls in server-only transitive deps | `evaluate.ts` has no `server-only` marker and no Node.js imports — verified before writing plan. Run `npm run build` after U2 to confirm no bundle error. |
| `canAccessAnyAdminRoute` OR-logic differs from existing inline layout check | U4 test scenario explicitly compares each qualifying authority type against both old and new code. Verify identical behaviour before removing the old check. |
| New `"users.view_all"` action allows `people_admin` users to reach the admin people directory — their data may not be department-scoped | Noted in Deferred to Implementation. The access gate is correct (people_admin should reach the page); data scoping is a separate concern. |

---

## Sources & References

- Related plan: `docs/plans/2026-05-20-001-feat-navigation-redesign-grouped-sidebar-plan.md`
- Permission convention: `docs/solutions/conventions/reusable-permission-policy-api-2026-05-02.md`
- Evaluator: `src/lib/permissions/evaluate.ts`
- Nav component: `src/components/nav-main.tsx`
- Admin layout: `src/app/(authenticated)/(app)/admin/layout.tsx`
