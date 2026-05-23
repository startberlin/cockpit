---
title: "fix: Resolve critical and high issues in the groups feature"
type: fix
status: active
date: 2026-05-18
---

# fix: Resolve critical and high issues in the groups feature

## Summary

Nine targeted fixes addressing every P0 and P1 finding from the groups feature review. Each fix is scoped to one commit: data integrity and security issues land first, followed by the infrastructure/performance improvement, then the three CLAUDE.md pattern violations in the UI layer. The ordering ensures that server actions exist before the components that will call them are refactored.

---

## Problem Frame

The groups feature was shipped with several reliability and security bugs alongside widespread use of raw `fetch()` and `useState` instead of the project's established server-action + React Hook Form patterns. The combined effect is that group membership can drift silently (phantom members, missed reconciliation triggers, duplicate Slack channels), any authenticated user can delete arbitrary group criteria, and the UI component layer ignores every project convention in CLAUDE.md.

---

## Requirements

- R1. Slack channel creation must be idempotent across Inngest retries
- R2. Adding group criteria and its immediate backfill must be atomic
- R3. Criteria deletion must verify the caller manages the criteria's group
- R4. Deleting the last criterion on a group must clean up `source='criteria'` members
- R5. `cockpit/user.updated` must fire whenever `department`, `status`, or `batchNumber` changes in any server action
- R6. `reconcileGroupMembership` must not perform a full user table scan
- R7. `GroupCriteriaManager` must use server actions and React Hook Form
- R8. `BulkAddUsersDialog` must use server actions and React Hook Form; remove `as any[]` casts
- R9. `handleCriteriaChange` in `page-client.tsx` must not use raw fetch; stale closure and silent error must be fixed

---

## Scope Boundaries

- P2 and P3 findings from the review (bulk DELETE optimisation, Google status check, hardcoded domain, DEPARTMENTS/STATUSES duplication) are deferred to follow-up work
- No schema migrations are needed for these fixes
- The existing API routes at `/api/groups/criteria`, `/api/groups/criteria/[id]`, and `/api/groups/bulk-add-users` will become dead code after U7 and U8 land; deleting them is included in those units
- The `/api/groups/[id]` and `/api/groups/[id]/criteria` GET routes are kept (they serve legitimate SSR needs until the page is fully SSR-converted)

### Deferred to Follow-Up Work

- P2: N individual DELETE calls in reconcile loop → bulk DELETE
- P2: Hardcoded `start-berlin.com` domain → env var
- P2: Unreachable Google Group status check cleanup
- P2: `findUsersNotInGroupByCriteria` missing LIMIT
- P2: Duplicated `DEPARTMENTS`/`STATUSES` constants (after U7/U8 this is resolved at the source; leftover copies elsewhere deferred)
- P3: `|| null` → `?? null` in `addGroupCriteria`
- P3: `addUsersMatchingCriteria` `match: "all"` semantic divergence from reconcile

---

## Context & Research

### Relevant Code and Patterns

- `src/app/(authenticated)/(app)/groups/[id]/actions.ts` — canonical `"use server"` pattern for this feature; uses `getCurrentUser()`, `can()`, `revalidatePath`
- `src/app/(authenticated)/(app)/people/import-google-user-action.ts` — `actionClient.inputSchema().action()` pattern; fires `inngest.send(events.cockpitUserUpdated)` after user creation
- `src/app/(authenticated)/(app)/groups/create-group-dialog.tsx` — `useHookFormAction` with `zodResolver` pattern; established form convention
- `src/lib/inngest.ts` — event registry; `cockpitUserUpdated` is `eventType("cockpit/user.updated", { schema: staticSchema<{ id: string }>() })`
- `src/db/groups.ts` — `addGroupCriteria(input, tx?)` already accepts an optional transaction handle; `addUsersToGroup` and `findUsersNotInGroupByCriteria` do not yet
- `src/lib/groups/reconcile.ts` — `reconcileGroupMembership` performs full user table scan; `userMatchesCriterion` encodes the per-criterion AND logic that should move to SQL
- `src/inngest/create-group.ts` — two DB operations share one `step.run`, causing duplicate channels on retry

### Institutional Learnings

- Inngest step idempotency: DB writes inside `step.run` must be wrapped with `onConflictDoNothing` or a conditional WHERE, or split into separate steps so each is individually retryable
- Permission enforcement: all mutations must pass through `can()` from `src/lib/permissions/server.ts` — global `can("groups.manage_members")` is the correct call for group management operations in this codebase

---

## Key Technical Decisions

- **Criteria server actions colocated with group detail**: new file `src/app/(authenticated)/(app)/groups/[id]/criteria-actions.ts`; bulk actions file `src/app/(authenticated)/(app)/groups/[id]/bulk-actions.ts`. Keeps all group mutation actions in one route directory.
- **revalidatePath over manual state refresh**: criteria and bulk-add actions call `revalidatePath(\`/groups/\${groupId}\`)`. The `handleCriteriaChange` callback becomes `router.refresh()`, eliminating the manual fetch + state merge.
- **Slack idempotency via step split**: `syncGroupIntegrationsWorkflow` splits the channel creation step into "create-slack-channel" (with `name_taken` recovery) and "persist-slack-channel-id" so each is individually retryable.
- **SQL-first reconciliation**: replace the in-JS filter loop with a WHERE clause built from criteria rows using OR-of-ANDs so `reconcileGroupMembership` fetches only matching users.
- **Last-criterion cleanup path**: when `criteria.length === 0`, `reconcileGroupMembership` removes all `source='criteria'` members rather than returning early.
- **IDOR mitigation**: the delete-criteria server action loads the criteria row first, reads its `groupId`, then calls `can("groups.manage_members")` before deleting — consistent with the existing global-permission model.

---

## Open Questions

### Resolved During Planning

- *Which server actions mutate `department`, `status`, `batchNumber`?* Confirmed via grep: `import-google-user-action.ts` already fires the event; `bulk-create-user-action.ts` also creates users with these fields. No dedicated "edit user profile" action exists in the current codebase — if one is added in future it must also fire the event. U5 targets both existing paths.
- *Does `can()` support group-scoped context?* The existing actions.ts uses the global `can("groups.manage_members")` without a resource argument. Consistent with that pattern — the IDOR fix loads the criteria row to confirm existence and get its groupId, then applies the same global permission check.

### Deferred to Implementation

- *Exact SQL shape for OR-of-ANDs in `reconcileGroupMembership`*: the implementer should derive the WHERE clause from the criteria rows using Drizzle's `or(...criteria.map(c => and(...)))` pattern; exact null handling for criteria fields will be confirmed at implementation time.
- *Whether to use `useAction` or `useHookFormAction`*: the remove-criteria action takes only an ID (no form), so it uses `useAction`; the add-criteria action has a form and uses `useHookFormAction`. The implementer should confirm the right hook per action shape.

---

## Implementation Units

### U1. Fix Slack channel duplicate creation on retry

**Goal:** Make `syncGroupIntegrationsWorkflow` idempotent — a retry after a failed DB write must not create a second Slack channel.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/inngest/create-group.ts`

**Approach:**
- Split the single `step.run("sync-slack-channel")` into two sequential steps:
  1. `"create-or-resolve-slack-channel"` — call `slack.conversations.create`. On `name_taken` error, call `slack.conversations.list` (or the lookup API) to resolve the existing channel's ID. Return the channel ID from the step.
  2. `"persist-slack-channel-id"` — take the resolved channel ID and `db.update(group).set({ slackChannelId })` with a conditional WHERE `IS NULL` guard so a double-run is a no-op.
- The two-step split means: if step 2 fails, step 1 is checkpointed and does not re-run; the retry goes directly to the DB write.

**Patterns to follow:**
- `src/inngest/create-group.ts` existing step structure
- Inngest step checkpointing docs: each `step.run` is independently retried once checkpointed

**Test scenarios:**
- Happy path: first run creates channel and persists ID; group record has `slackChannelId` set
- Retry after DB failure: step 1 checkpoint is used; step 2 retries with the same channel ID; no duplicate channel created
- `name_taken` recovery: if channel already exists with the group's slug, the workflow resolves the ID and persists it rather than throwing

**Verification:**
- Running `syncGroupIntegrationsWorkflow` twice in Inngest dev with the same group ID results in exactly one Slack channel and the correct `slackChannelId` in the DB

---

### U2. Fix transaction atomicity for criteria + backfill

**Goal:** Make `addGroupCriteria` + `addUsersMatchingCriteria` truly atomic — if either fails, neither is persisted.

**Requirements:** R2

**Dependencies:** None

**Files:**
- Modify: `src/db/groups.ts`
- Modify: `src/app/api/groups/criteria/route.ts`

**Approach:**
- Add an optional `tx` parameter to `addUsersMatchingCriteria` (same pattern as `addGroupCriteria`): `function addUsersMatchingCriteria(groupId, criteria, tx?)`
- Thread `tx` through to `findUsersNotInGroupByCriteria` and `addUsersToGroup` by adding the same optional `tx` parameter to each
- In `src/app/api/groups/criteria/route.ts`, pass `tx` to the `addUsersMatchingCriteria` call inside the `db.transaction` callback
- This API route is dead code after U7 lands; this fix ensures correctness in the interim and the pattern carries forward to the server action

**Patterns to follow:**
- `addGroupCriteria(input, tx?)` at `src/db/groups.ts:264` — exact same signature pattern

**Test scenarios:**
- Happy path: criteria row and user rows both committed atomically
- Failure in `addGroupCriteria`: no user rows inserted, criteria row rolled back
- Failure in `addUsersToGroup`: no user rows inserted, criteria row rolled back — confirmed by checking DB state after simulating the failure

**Verification:**
- Both operations share the same transaction handle; a rollback removes both

---

### U3. Fix IDOR on criteria deletion

**Goal:** Prevent any authenticated user from deleting criteria belonging to groups they don't manage.

**Requirements:** R3

**Dependencies:** None

**Files:**
- Modify: `src/app/api/groups/criteria/[id]/route.ts`

**Approach:**
- Before calling `removeGroupCriteria`, load the criteria row by ID to confirm it exists and read its `groupId`
- If not found, return 404
- Apply `can("groups.manage_members")` (consistent with existing global permission model) — if this check passes, the caller is authorised to manage any group's members
- This route is dead code after U7 lands; the server action in U7 should apply the same pattern

**Patterns to follow:**
- Auth guard pattern in `src/app/api/groups/criteria/route.ts` (load, check can, act)

**Test scenarios:**
- Authenticated manager: can delete criteria belonging to any group (global permission model)
- Authenticated non-manager: receives 403 before any deletion occurs
- Non-existent criteria ID: receives 404 rather than a silent 200 or DB error

**Verification:**
- Attempting to delete a criteria ID that belongs to a different group than expected returns 404 or 403 appropriately; no criteria row is deleted without the authorisation check passing

---

### U4. Fix phantom members when last criterion is deleted

**Goal:** Ensure `reconcileGroupMembership` always removes `source='criteria'` members when no criteria remain.

**Requirements:** R4

**Dependencies:** None

**Files:**
- Modify: `src/lib/groups/reconcile.ts`

**Approach:**
- Remove the early return at `criteria.length === 0`
- Replace it with a cleanup path: when `criteria.length === 0`, fetch all `source='criteria'` members for the group and remove them (calling existing `removeUserFromGroup` loop and integration pushes)
- The rest of the function is unchanged — when criteria is empty, `matching` will be an empty set, so `toAdd` is empty and `toRemove` is all current criteria-sourced members
- This means the `if (criteria.length === 0) return` guard is simply deleted; the function proceeds normally and falls through to the existing diff logic, which naturally produces `toRemove = all criteria members` and `toAdd = []`

**Patterns to follow:**
- Existing `toRemove` / `pushRemoveToIntegrations` logic in `reconcileGroupMembership`

**Test scenarios:**
- Group with 0 criteria and 3 `source='criteria'` members: all 3 are removed from DB and from Slack/Google integrations
- Group with 0 criteria and 2 `source='manual'` members: no members removed (manual source is unchanged)
- Group with 1 criterion and matching users: existing behaviour unchanged

**Verification:**
- After deleting all criteria for a group, the next reconcile call (or cron tick) removes all criteria-sourced members

---

### U5. Fire `cockpit/user.updated` from all attribute-mutation paths

**Goal:** Ensure reactive reconciliation runs whenever `department`, `status`, or `batchNumber` changes on a user.

**Requirements:** R5

**Dependencies:** None

**Files:**
- Modify: `src/app/(authenticated)/(app)/admin/bulk-create-user-action.ts`
- Modify: `src/app/(authenticated)/(app)/people/import-google-user-action.ts` (verify it already fires; add if missing)
- Inspect and potentially modify any additional action files found by grepping for `user.*set.*department\|user.*set.*status\|user.*set.*batchNumber`

**Approach:**
- After each successful DB write that sets `department`, `status`, or `batchNumber` on a user, call:
  ```
  await inngest.send(events.cockpitUserUpdated, { data: { id: userId } })
  ```
- `import-google-user-action.ts` may already fire this event — confirm and add only if missing
- `bulk-create-user-action.ts` creates users with these fields set; add the event fire after each successful create
- Run a grep for `db.*update.*user\|db.*insert.*user` filtered to action files to catch any remaining paths before finalising this unit

**Patterns to follow:**
- `src/app/(authenticated)/(app)/people/import-google-user-action.ts` — `inngest.send(events.cockpitUserUpdated, { data: { id } })` call after user DB write

**Test scenarios:**
- Bulk user import: each imported user triggers exactly one `cockpit/user.updated` event
- After the event fires, `reconcileUserGroupMembership` runs and adds/removes the user from appropriate groups
- No event fires when an action that does NOT touch group-relevant attributes completes (e.g., updating a user's address)

**Verification:**
- Inngest dev server shows `cockpit/user.updated` events for each affected action; `reconcile-user-group-membership` function runs in response

---

### U6. Push reconciliation matching into SQL

**Goal:** Replace the full user table scan in `reconcileGroupMembership` with a targeted SQL query.

**Requirements:** R6

**Dependencies:** U4 (both touch `reconcileGroupMembership`)

**Files:**
- Modify: `src/lib/groups/reconcile.ts`

**Approach:**
- Build a Drizzle WHERE clause from the `criteria` rows using OR-of-ANDs:
  - Each criterion contributes a clause: `and(dept = c.department, ...)` for non-null fields only
  - All criterion clauses are combined with `or(...)`
- Replace the `SELECT * FROM user` + JS filter with `SELECT ... FROM user WHERE <or-of-ands>`
- The `matchingIds` set and `toAdd`/`toRemove` diff logic remain identical — only the source of `matching` changes

**Patterns to follow:**
- `src/db/groups.ts:buildCriteriaConditions` + `findUsersNotInGroupByCriteria` — demonstrates how to build dynamic Drizzle WHERE from criteria arrays
- The reconcile query is a simpler variant: per-criterion AND conditions, no LEFT JOIN exclusion needed (the diff handles existing members separately)

**Test scenarios:**
- Group with department=legal criterion: query returns only users with `department = 'legal'`; no JS filtering needed
- Group with two criteria (dept=legal AND batch=5 OR status=member): query returns the union of matching users
- Null criterion fields: `c.department === null` means that field is not included in that criterion's AND clause

**Verification:**
- DB query log (or Drizzle debug) shows a parameterised WHERE clause rather than `SELECT *` with no filter; large user tables resolve in < 10ms vs full scan

---

### U7. Convert GroupCriteriaManager to server actions + React Hook Form

**Goal:** Replace raw `fetch()` + `useState` form state in `GroupCriteriaManager` with server actions and React Hook Form per CLAUDE.md.

**Requirements:** R7

**Dependencies:** U2, U3 (server actions must apply the same atomicity and auth logic)

**Files:**
- Create: `src/app/(authenticated)/(app)/groups/[id]/criteria-actions.ts`
- Modify: `src/components/group-criteria-manager.tsx`
- Delete: `src/app/api/groups/criteria/route.ts` (POST endpoint becomes dead code)
- Delete: `src/app/api/groups/criteria/[id]/route.ts` (DELETE endpoint becomes dead code)

**Approach:**
- `criteria-actions.ts` exports two server actions:
  - `addGroupCriteriaAction` — validates input with `addGroupCriteriaSchema`, calls `addGroupCriteria` + `addUsersMatchingCriteria` inside a transaction (using the pattern from U2), calls `revalidatePath(\`/groups/\${groupId}\`)`; apply `can("groups.manage_members")` guard
  - `removeGroupCriteriaAction` — loads the criteria row, verifies existence, applies `can("groups.manage_members")` (pattern from U3), calls `removeGroupCriteria`, calls `revalidatePath(\`/groups/\${groupId}\`)`
- `GroupCriteriaManager` uses `useHookFormAction` for `addGroupCriteriaAction` and `useAction` for `removeGroupCriteriaAction`
- Replace `useState` form fields with `form.register` / `Controller`
- Derive department and status options from `department.enumValues` / `userStatus.enumValues` (imported from `@/db/schema/auth`) — remove the hardcoded `DEPARTMENTS`/`STATUSES` arrays

**Patterns to follow:**
- `src/app/(authenticated)/(app)/groups/create-group-dialog.tsx` — `useHookFormAction` with `zodResolver`, pending state, error display
- `src/app/(authenticated)/(app)/groups/[id]/actions.ts` — `"use server"`, `can()`, `revalidatePath`

**Test scenarios:**
- Happy path add: form submits, action runs, criteria row created, page revalidates, new criterion appears in list
- Validation failure: Zod error surfaces via `form.formState.errors` in the UI
- Unauthenticated / unauthorised: action returns an error response; UI shows toast.error
- Happy path remove: action runs, criteria row deleted, page revalidates, criterion removed from list
- Remove non-existent ID: action returns 404-style error; UI shows toast.error

**Verification:**
- No raw `fetch()` calls remain in `group-criteria-manager.tsx`; form state is managed by React Hook Form; department/status options are derived from schema enums

---

### U8. Convert BulkAddUsersDialog to server actions + React Hook Form

**Goal:** Replace raw `fetch()` + `useState` + `as any[]` in `BulkAddUsersDialog` with server actions and React Hook Form.

**Requirements:** R8

**Dependencies:** U7 (criteria-actions.ts exists as a reference; bulk-actions is a sibling file)

**Files:**
- Create: `src/app/(authenticated)/(app)/groups/[id]/bulk-actions.ts`
- Modify: `src/components/bulk-add-users-dialog.tsx`
- Delete: `src/app/api/groups/bulk-add-users/route.ts`
- Delete: `src/app/api/users/search-by-criteria/route.ts`

**Approach:**
- `bulk-actions.ts` exports two server actions:
  - `searchUsersByCriteriaAction` — validates input with `normalizedGroupCriteriaSchema`, verifies `groupId` exists, calls `findUsersNotInGroupByCriteria`, applies `can("groups.manage_members")` guard. Returns `PublicUser[]`.
  - `bulkAddUsersToGroupAction` — validates `{ groupId, userIds }`, verifies groupId exists, applies `can("groups.manage_members")`, calls `addUsersToGroup({ source: "criteria" })`, calls `revalidatePath`
- `BulkAddUsersDialog` uses `useAction` for the search action (triggered on form change, not submit) and `useHookFormAction` for the add action
- Remove all `as any[]` casts; derive enum values from `department.enumValues` / `userStatus.enumValues`

**Patterns to follow:**
- `src/app/(authenticated)/(app)/groups/[id]/criteria-actions.ts` (from U7)
- `src/app/(authenticated)/(app)/groups/create-group-dialog.tsx` — form + useHookFormAction

**Test scenarios:**
- Happy path search: criteria input → action returns matching users not yet in group
- Non-existent groupId in search: action returns empty array (groupId validation prevents data leak)
- Bulk add: selected users added with `source='criteria'`; page revalidates; members list updates
- Unauthorised caller: action returns error; UI shows toast.error
- Empty userIds array: action short-circuits gracefully (no insert)

**Verification:**
- No raw `fetch()`, no `as any[]` casts in `bulk-add-users-dialog.tsx`; all type safety from Zod schemas through to component

---

### U9. Fix handleCriteriaChange in page-client.tsx

**Goal:** Remove the raw fetch calls from `handleCriteriaChange`, fix the stale closure, and add error feedback.

**Requirements:** R9

**Dependencies:** U7 (criteria actions call `revalidatePath`, making manual refresh unnecessary)

**Files:**
- Modify: `src/app/(authenticated)/(app)/groups/[id]/page-client.tsx`

**Approach:**
- Since `addGroupCriteriaAction` and `removeGroupCriteriaAction` (from U7) already call `revalidatePath`, the `handleCriteriaChange` callback can become `router.refresh()` — Next.js re-fetches the server component and the `use(groupDetailPromise)` in this component receives fresh data
- Remove the two `fetch()` calls and the manual `setGroup` merge inside `handleCriteriaChange`
- Add `const router = useRouter()` and replace the body of `handleCriteriaChange` with `router.refresh()`
- If `router.refresh()` is insufficient for the optimistic use case, replace the full manual fetch pattern with a proper functional updater: `setGroup(prev => ({ ...prev, criteria, members }))` using `prev` not the outer closure variable
- Add `toast.error(...)` to the catch block — consistent with every other handler in the file
- The stale closure on `group.members` is fixed by the `router.refresh()` approach (state is reset from server data) or by using `prev.members` in the functional updater fallback

**Patterns to follow:**
- `handleUpdateRole` at line ~195 in `page-client.tsx` — `toast.error` in catch block
- `addUserToGroupAction` in `actions.ts` — `revalidatePath` handles data freshness

**Test scenarios:**
- After adding a criterion: page refreshes to show the new criterion and updated member list
- After removing a criterion: page refreshes to show the removed criterion and updated member list
- Network failure in the refresh: `toast.error` fires; UI does not silently fail
- Rapid add/remove: each operation triggers an independent refresh; no stale closure race

**Verification:**
- No `fetch()` calls in `handleCriteriaChange`; catch block contains `toast.error`; no direct reference to `group.members` in the update path

---

## System-Wide Impact

- **Interaction graph:** `reconcileGroupMembership` is called from `syncGroupsCron` (every 15 min) and from future direct triggers; changes to its early-return logic (U4) and query (U6) affect both callers uniformly
- **Error propagation:** U7/U8 server actions surface errors via `next-safe-action`'s structured error response; components must handle `action.result.serverError` in addition to `form.formState.errors.root`
- **State lifecycle risks:** After U7/U8, `revalidatePath` handles data freshness; any component that currently holds stale group state in `useState` will be reset on `router.refresh()`. Confirm no other client component outside page-client.tsx holds a local copy of group data.
- **Integration coverage:** U1's step split must be tested in the Inngest dev server with simulated DB failures, not just unit tests
- **Unchanged invariants:** Manual membership (`source='manual'`) must never be auto-removed by reconcile — this guard is preserved in U4 (the `toRemove` filter still checks `m.source === 'criteria'`)

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| U4 + U6 both touch `reconcileGroupMembership` — merge conflict | Apply U4 first (simple early-return removal), then U6 (SQL query change); commits are ordered and independent in their modified lines |
| `revalidatePath` in U7/U8 may cause visible loading flicker on the group detail page | Acceptable tradeoff vs raw fetch; can add a `Suspense` boundary or optimistic state on top in a follow-up |
| `router.refresh()` in U9 re-renders the whole page rather than just the criteria section | Acceptable for now; isolated section refresh requires a dedicated server component boundary, which is a follow-up refactor |
| Bulk delete of `source='criteria'` members (U4 + U6) fires individual Slack/Google calls in a loop | Pre-existing behaviour; bulk integration calls are a P2 deferred improvement |
| Identifying all user attribute mutation paths for U5 may miss an internal workflow | The grep at implementation time is the safety net; the periodic cron acts as a backstop for any missed event fires |

---

## Sources & References

- Related code: `src/lib/groups/reconcile.ts`
- Related code: `src/inngest/create-group.ts`
- Related code: `src/app/api/groups/criteria/route.ts`
- Related code: `src/components/group-criteria-manager.tsx`
- Related code: `src/components/bulk-add-users-dialog.tsx`
- Related code: `src/db/groups.ts`
