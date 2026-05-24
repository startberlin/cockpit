---
title: "refactor: System groups architecture — code-defined groups, no DB presence"
type: refactor
status: active
date: 2026-05-24
origin: docs/brainstorms/2026-05-24-system-groups-architecture-requirements.md
---

# refactor: System groups architecture — code-defined groups, no DB presence

## Summary

Replaces the current generic rule-engine group system with a two-class model: *system groups* are defined as TypeScript constants with membership predicates and have zero DB presence — Google Workspace is their only sync target. *Manual groups* remain in the `group` table and `usersToGroups` with purely hand-managed membership.

The entire `groupCriteria` table, the `group_membership_source` enum, the rule engine (`rule.ts`, `rule-sql.ts`, `criteria.ts`), the old reconcile logic, and all criteria UI are deleted. System group membership is synced event-driven via a new Inngest workflow that computes a before/after diff from user attribute changes and writes directly to Google — no Google reads required on the hot path. A daily cron serves as a safety-net reconcile. The Community > Groups page is deleted; a new Personal groups page replaces the member-facing surface.

---

## Problem Frame

The current generic criteria engine (JSONB `RuleGroup` → SQL) is over-engineered for the actual use case: every group START needs is fully derivable from known fields (`status`, `department`, `batchNumber`, org positions). Storing user↔group assignments for criteria-driven groups creates redundant state that can drift. Membership for system groups is always computable from user attributes — there is no value in persisting it. See origin document for full rationale.

---

## Requirements

- R1. System groups defined in TypeScript with membership predicates; zero DB presence (no `group` table rows, no `usersToGroups` rows).
- R2. Manual groups stored in `group` and `usersToGroups`; hand-managed membership only, no criteria.
- R3. System group membership synced event-driven: user attribute changes carry before/after, the Inngest workflow computes diff and writes to Google directly without reading Google on the hot path.
- R4. Position changes (board@, legal-board@, dept head groups) trigger Google sync via the position assignment Inngest workflow.
- R5. New batch → Google Group created and initially populated via Inngest.
- R6. Daily safety-net reconcile: load Google membership per system group, compute should-be, fix drift.
- R7. `groupCriteria` table, `group_membership_source` enum, `source` column, and entire rule engine deleted.
- R8. Community > Groups page deleted; Personal groups page added (shows current user's system + manual memberships, no export).
- R9. Admin > Groups shows system groups (computed) + manual groups (from DB); export restricted to admin/people_admin/group.export grant.
- R10. Group detail pages handle system group slugs (computed members) and manual group IDs (from `usersToGroups`).

---

## Scope Boundaries

- No UI for configuring system group membership rules — rule changes require a code deploy.
- No admin override to manually add/remove people from system groups.
- Bulk-add-by-criteria dialog deleted; manual groups are one-by-one or not at all.
- No alumni-specific email group; alumni and cancelled users fall out of all system groups.
- Batch group deletion on DB batch removal: deferred — `batch` table has no deletion concept, FK constraint prevents it.
- `cockpit/user.updated` (thin, no before/after) continues to be emitted everywhere it currently is; its consumer (`reconcileUserGroupMembershipWorkflow`) is deleted. Cleanup of the emitters is deferred to a follow-up.

### Deferred to Follow-Up Work

- Cleaning up `cockpit/user.updated` emitters (6+ sites) once we're confident the system group sync covers all cases: separate PR.
- Supporting department/batchNumber edits on existing users via the admin people UI: any future action that edits these fields must emit `cockpit/user.system-groups-sync` — noted as a prerequisite for that work.

---

## Context & Research

### Relevant Code and Patterns

- `src/db/schema/group.ts` — current `group`, `groupCriteria`, `usersToGroups` tables; `groupMembershipSource` enum
- `src/db/groups.ts` — full DB query layer; functions to keep: `getGroupDetail`, `getAllGroupMembersForExport`, `searchUsersNotInGroup`, `listAllGroupsForAdmin`, `addUserToGroup`, `removeUserFromGroup`; functions to delete: all criteria functions, `pinGroupMember`, `addUsersMatchingCriteria`, `listGroupsPublic` (duplicate)
- `src/lib/groups/reconcile.ts` — `reconcileGroupMembership`, `reconcileUserGroupMembership`; both deleted
- `src/lib/groups/google-sync.ts` — `triggerGoogleSync(groupId)`; updated to emit renamed event
- `src/inngest/reconcile-group-membership.ts` — Google sync for manual groups; trigger event renamed
- `src/inngest/reconcile-user-group-membership.ts` — user→DB criteria sync; deleted entirely
- `src/inngest/sync-groups-cron.ts` — Step 1 (criteria DB sync) deleted; Step 2 (Google sync for manual groups with `googleGroupEmail`) kept
- `src/inngest/sync-system-groups-cron.ts` — new separate daily cron for system group reconcile
- `src/lib/google-workspace/directory.ts` — `createGoogleGroup`, `addGroupMember`, `removeGroupMember`, `listGroupMemberEmails`, `googleGroupExists`; all available for the new sync paths
- `src/lib/inngest.ts` — events registry; add `userSystemGroupsSync` and `groupMembershipChanged` events, remove `groupCriteriaChanged`
- `src/lib/groups/criteria.ts` — Zod schemas for rule engine; deleted
- `src/lib/groups/rule.ts`, `src/lib/groups/rule-sql.ts` — rule engine; deleted
- `src/app/(authenticated)/(app)/(default)/groups/` — Community > Groups route (all files deleted)
- `src/app/(authenticated)/(app)/(default)/groups/[id]/criteria-actions.ts` — deleted
- `src/app/(authenticated)/(app)/(default)/groups/[id]/bulk-actions.ts` — deleted
- `src/components/group-criteria-manager.tsx` — deleted
- `src/components/bulk-add-users-dialog.tsx` — deleted
- `src/components/nav-main.tsx` — Groups nav link updated to My Groups → `/my-groups`
- `src/app/(authenticated)/(app)/(default)/admin/groups/` — updated to merge system + manual
- `src/lib/departments.ts` — `DEPARTMENT_IDS`, `DEPARTMENT_NAMES` — used in system group template definitions
- `src/db/schema/authority.ts` — `userOrganizationPosition` table and position types for board predicates
- `src/app/(authenticated)/(app)/(default)/admin/settings/positions/update-positions-action.ts` — position assignment action; updated to emit system-group sync event
- `src/app/(authenticated)/(app)/(default)/people/batches/create-batch-action.ts` — batch creation; updated to trigger Google group bootstrap

### Pattern: DEPARTMENT_IDS as const array

```typescript
// src/lib/departments.ts — follow this pattern for system group templates
export const DEPARTMENT_IDS = ["partnerships", "operations", ...] as const;
```

System group definitions follow the same `as const` pattern.

### Pattern: Inngest step idempotency

Existing Inngest steps re-read DB state inside `step.run()` for replay safety. The system group sync workflow should do the same for any DB reads inside steps.

### Pattern: Google API guard

All Google SDK calls check `env.DISABLE_GOOGLE_WORKSPACE`. New Google calls must include this guard (it's already in the SDK wrappers in `directory.ts`).

### Pattern: Conditional WHERE for idempotent updates (from institutional learning)

Use `.where(and(eq(user.id, id), eq(user.status, "onboarding")))` for state-promotion writes that must survive Inngest replays without double-applying.

### Institutional Learnings

- Exactly two code paths set `legalMembershipState = "active_member"` (Inngest activation step + import). Same discipline applies here: system group sync must fire only from canonical lifecycle event handlers, not as side effects of unrelated webhooks.
- Status transitions belong in the Inngest activation step, not in reconciliation handlers. Confirmed: the new sync workflow should subscribe to specific lifecycle events, not a catch-all reconcile.
- The ternary-spread anti-pattern for conditional updates is explicitly called out as wrong — use separate explicit UPDATE statements.

---

## Key Technical Decisions

- **Before/after payload for user sync event**: The existing `cockpit/user.updated` carries only `{id}`. For system group diff computation, we need before/after of `status`, `department`, and `batchNumber`. Rather than extending the thin event, a new dedicated event `cockpit/user.system-groups-sync` with `{userId, before: {...}, after: {...}}` is added. Emitting both events at the same call site keeps the thin event intact for any future consumers.

- **Position changes read from Google for the diff**: Position changes are rare (admin-only, infrequent). The sync workflow for position-based groups (`board@`, `legal-board@`, `<dept>@`) reads current Google membership to compute the diff, avoiding the need for before/after position payloads. This is the one path that reads Google on the hot path; the tradeoff is acceptable given the infrequency.

- **Manual group Google sync event renamed**: `group/criteria.changed` → `group/membership.changed`. The trigger semantic is now "manual membership changed" not "criteria changed". `triggerGoogleSync()` in `src/lib/groups/google-sync.ts` is updated accordingly; the Inngest workflow's trigger changes to match.

- **`source` column removal — no data cleanup required**: All existing `usersToGroups` and `groupCriteria` rows are empty in the current database, and any existing Google Workspace groups will be deleted manually before deployment. The migration can drop the column and table directly without a pre-migration data cleanup step.

- **System group detail pages**: accessible to any authenticated user — no `isGroupMember` DB check applies (membership is computed, not stored). The `group.view` permission check remains for manual group detail pages.

- **Personal groups page URL**: `/my-groups`. The `/groups` route prefix is freed for the group detail pages (system + manual) only, accessible from both the personal and admin surfaces.

- **`pinGroupMember` deleted**: existed solely because criteria-sourced rows could be auto-removed on the next reconcile cycle. With no criteria source, the concept is obsolete.

- **`listGroupsPublic` deleted**: near-duplicate of `listGroupsForViewer`; only used by the Community > Groups page which is deleted.

---

## Open Questions

### Resolved During Planning

- *Should `<dept>-members@` include supporting_alumni?*: The transition workflow sets `department = null` when a user becomes supporting_alumni. They naturally fall out of dept-member groups with no extra filter needed. Predicate: `department = dept AND status ∉ {cancelled, alumni}` is sufficient.
- *Batch group deletion when batch removed from DB?*: The `batch` table has no deletion concept; `user.batchNumber` FK prevents batch deletion while users reference it. Deferred as non-issue.

### Deferred to Implementation

- Whether `listGroupsForViewer` in `src/db/groups.ts` can serve both the admin and personal page, or whether a new `listManualGroupsForUser(userId)` function is needed.
- Whether `create-group-action.ts` under `src/app/(authenticated)/(app)/(default)/groups/` can be referenced from admin > groups, or whether the create group dialog already lives under `admin/groups/` independently. Verify before deleting the community route's action file.

### Resolved (from review)

- *Admin > Groups layout*: Two-section layout — "System groups" section (read-only) followed by "Manual groups" section (editable, with Create button). Follow the `payments/page-client.tsx` pattern: `<h2>` section headings + `Pagination` / `PaginationContent` / `PaginationPrevious` / `PaginationNext` from `@/components/ui/pagination` per section. See also `admin/people/[id]/` for the multi-table-on-one-page pattern.
- *System groups empty state copy*: "No members match this group's criteria right now."
- *Export control visibility*: Hidden (not disabled). Wrap export button with `<Can permission="group.export" context={{ isMember: true }}>` — renders nothing when unauthorized. Pattern: `groups-table.tsx` already uses `<Can permission="groups.create">` for conditional rendering.
- *Auth boundary for system group detail pages*: Inherit the existing `(app)` route group guard — no additional status check. All users who can access the app can view system group detail pages.
- *U3 Google read fail-safe*: Let Inngest retry (default step failure behavior). No custom error handling needed.

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
User attribute change path (frequent):
  Server action / Inngest lifecycle step
    → emit cockpit/user.system-groups-sync { userId, before, after }
    → syncUserSystemGroups Inngest function
        computeOldGroups(before)  // pure TS, no I/O
        computeNewGroups(after)   // pure TS, no I/O
        toAdd = newGroups - oldGroups
        toRemove = oldGroups - newGroups
        → addGroupMember / removeGroupMember per diff (Google API)

Position change path (rare):
  updatePositionsAction
    → emit cockpit/positions.system-groups-sync { userId } per affected user
    → syncPositionSystemGroups Inngest function (concurrency key: event.data.userId)
        step.run("load-positions"): loadCurrentPositions(userId)        // DB read
        step.run("sync-google-board@"):       listGroupMemberEmails → diff → adds/removes
        step.run("sync-google-legal-board@"): listGroupMemberEmails → diff → adds/removes
        step.run("sync-google-<dept>@"): × 5 (one step per dept head group)

Batch creation path (rare):
  createBatchAction
    → emit cockpit/batch.created { batchNumber }
    → bootstrapBatchSystemGroup Inngest function
        createGoogleGroup(batch-N@start-berlin.com)
        step.run("load-members"): getMembersOfSystemGroup(slug, allUsers, positions)
        addGroupMember for each user

Manual group sync path (unchanged mechanism, renamed event):
  addUserToGroupAction / removeUserFromGroupAction
    → triggerGoogleSync(groupId) → emit group/membership.changed { groupId }
    → syncManualGroupToGoogle Inngest function (renamed trigger)
        DB members → diff vs Google → addGroupMember / removeGroupMember

Daily safety-net reconcile (system groups):
  syncGroupsCron (daily step)
    for each system group definition:
      resolveInstances() // e.g. batch-7@, batch-8@, ...
      listGroupMemberEmails(googleEmail)      // Google read
      computeShouldBeMembers(predicate, DB)   // DB read + predicate
      diff → addGroupMember / removeGroupMember
```

---

## Implementation Units

### U1. System group TypeScript definitions

**Goal:** Create the canonical TypeScript definition file for all system groups, including predicates, slug templates, and helper functions. This file is the single source of truth consulted by sync workflows, UI pages, and the reconcile cron.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Create: `src/lib/groups/system-groups.ts`
- Test: `src/lib/groups/system-groups.test.ts`

**Google email addresses:**

All system groups use `${googleEmailPrefix}@start-berlin.com`. The `createGoogleGroup` wrapper in `directory.ts` appends the domain automatically from the prefix.

| Slug | Google email | Members |
|---|---|---|
| `members` | `members@start-berlin.com` | status ∈ {onboarding, member, supporting_alumni} |
| `onboarding-members` | `onboarding-members@start-berlin.com` | status = onboarding |
| `board` | `board@start-berlin.com` | any org position |
| `legal-board` | `legal-board@start-berlin.com` | president, vice_president, head_of_finance |
| `partnerships` | `partnerships@start-berlin.com` | department_head for partnerships |
| `partnerships-members` | `partnerships-members@start-berlin.com` | department = partnerships, status ∉ {cancelled, alumni} |
| `operations` | `operations@start-berlin.com` | department_head for operations |
| `operations-members` | `operations-members@start-berlin.com` | department = operations, status ∉ {cancelled, alumni} |
| `people` | `people@start-berlin.com` | department_head for people |
| `people-members` | `people-members@start-berlin.com` | department = people, status ∉ {cancelled, alumni} |
| `growth` | `growth@start-berlin.com` | department_head for growth |
| `growth-members` | `growth-members@start-berlin.com` | department = growth, status ∉ {cancelled, alumni} |
| `events` | `events@start-berlin.com` | department_head for events |
| `events-members` | `events-members@start-berlin.com` | department = events, status ∉ {cancelled, alumni} |
| `batch-<x>` | `batch-<x>@start-berlin.com` | batchNumber = x, status ∉ {cancelled, alumni} |

**Approach:**
- Define a `SystemGroupTemplate` type with fields: `slug` (or slug-generating function), `name`, `googleEmailPrefix` (or prefix-generating function), and `isMember(user, positions)` predicate.
- Two sub-types: `StaticSystemGroupTemplate` (singleton groups) and `ExpandedSystemGroupTemplate` (per-batch, per-department — each expands to N instances from DB data).
- `STATIC_SYSTEM_GROUP_TEMPLATES`: `members@`, `onboarding-members@`, `board@`, `legal-board@`.
- `DEPARTMENT_SYSTEM_GROUP_TEMPLATES`: `<dept>@` and `<dept>-members@` for each of the 5 departments. These are constants; departments don't change at runtime.
- `BATCH_SYSTEM_GROUP_TEMPLATE`: `batch-<x>@` — expands dynamically from the batch table.
- Export `getAllSystemGroupSlugs(batches)` → string[] — all slugs currently in use; used by the daily reconcile.
- Export `getSystemGroupsForUser(user, positions, batches)` → SystemGroup[] — which system groups a user belongs to; used by the Personal page and the before/after diff.
- Export `getMembersOfSystemGroup(slug, users, positions)` → User[] — used by Admin > Groups detail view and the daily reconcile.
- Export `isSystemGroupSlug(slug, batches)` → boolean — used by the group detail router.
- Membership predicates:
  - `members@`: `status ∈ {onboarding, member, supporting_alumni}`
  - `onboarding-members@`: `status === 'onboarding'`
  - `board@`: user has any row in `userOrganizationPosition`
  - `legal-board@`: user has position ∈ {president, vice_president, head_of_finance}
  - `<dept>@`: user has `department_head` position with `department === dept`
  - `<dept>-members@`: `user.department === dept AND status ∉ {cancelled, alumni}`
  - `batch-<x>@`: `batchNumber === x AND status ∉ {cancelled, alumni}`

**Patterns to follow:**
- `src/lib/departments.ts` — `DEPARTMENT_IDS as const` pattern
- `src/lib/authority/model.ts` — position type literals

**Test scenarios:**
- Happy path: `getSystemGroupsForUser` for a member with batchNumber=7 and department=partnerships returns batch-7@, partnerships-members@, members@
- Happy path: `getSystemGroupsForUser` for a supporting_alumni with batchNumber=3 returns batch-3@ and members@ but NOT the department group (department is null on transition)
- Happy path: president with department null returns board@, legal-board@, members@
- Happy path: department_head for events returns board@, events@, events-members@, members@
- Edge case: cancelled user → empty set (no system groups)
- Edge case: alumni user → empty set
- Edge case: user with batchNumber=null → no batch group returned
- Edge case: `isSystemGroupSlug("batch-99", [{number: 99}])` → true; `isSystemGroupSlug("batch-99", [])` → false
- Edge case: `getMembersOfSystemGroup` with zero users → empty array

**Verification:**
- All predicate functions are pure (no I/O) and covered by unit tests.
- Type-checks cleanly: no TypeScript errors.

---

### U2. User attribute change → system group sync (Inngest)

**Goal:** Add a new Inngest event `cockpit/user.system-groups-sync` and its consumer workflow that computes the before/after diff and executes Google membership changes without reading Google.

**Requirements:** R3

**Dependencies:** U1

**Files:**
- Modify: `src/lib/inngest.ts` — add `userSystemGroupsSync` event definition
- Create: `src/inngest/sync-user-system-groups.ts` — new Inngest function
- Modify: `src/inngest/membership-admission-workflow.ts` — emit new event after status change
- Modify: `src/inngest/membership-transition-workflow.ts` — emit new event after each status transition
- Modify: `src/inngest/membership-cancellation-workflow.ts` — emit new event after cancellation
- Modify: `src/inngest/membership-reconfirmation-workflow.ts` — emit new event after reconfirmation
- Modify: `src/inngest/new-user-workflow.ts` — emit new event after user creation
- Modify: `src/app/(authenticated)/(app)/(default)/admin/people/import-google-user-action.ts` — emit new event after user import (emits `cockpit/user.updated` directly at lines 96–97 and 225–226; add the new event at the same sites)

**Approach:**
- Event payload: `{ userId: string, before: { status: UserStatus | null, department: Department | null, batchNumber: number | null }, after: { status: UserStatus, department: Department | null, batchNumber: number | null } }`.
- **Replay-safe before-state capture**: capture `before` in a dedicated preceding `step.run("read-before-state")` that reads the user's current attributes from DB. This step must complete before the step that performs the UPDATE. Do not read before-state inside the same `step.run()` as the UPDATE: on Inngest replay, `step.run()` re-executes its entire closure — reading inside the update step re-reads post-UPDATE state, producing `before == after` and zero diff.
- **User creation case** (new-user-workflow.ts, import-google-user-action.ts): no prior DB record exists. Set `before = { status: null, department: null, batchNumber: null }` so the diff correctly computes the full set of groups to add (all membership predicates evaluate to false for a null-status user).
- The Inngest function `syncUserSystemGroups`:
  1. `step.run("compute-diff")`: call `getSystemGroupsForUser(before, ...)` and `getSystemGroupsForUser(after, ...)` using predicates on the payload attributes. Also fetch current `userOrganizationPosition` rows for the user from DB in this step — needed to evaluate `board@`, `legal-board@`, and `<dept>@` predicates. Fetch batches from DB only if needed (batchNumber is already in the payload, so batch list lookup is needed only to resolve the slug). Diff: `toAdd` and `toRemove`.
  2. `step.run("sync-google")`: for each group in `toAdd`, call `addGroupMember(googleEmail, userEmail)`; for each in `toRemove`, call `removeGroupMember(googleEmail, userEmail)`. Fetch user email from DB at start of this step.
- Concurrency key on `event.data.userId` to prevent parallel execution for the same user.
- `DISABLE_GOOGLE_WORKSPACE` guard: skip Google calls but still compute the diff (for testability).
- Note: org positions are not in this event's payload. Position-based groups (board@, legal-board@, dept@) are handled separately in U3.

**Patterns to follow:**
- `src/inngest/reconcile-user-group-membership.ts` — concurrency key pattern (replace its logic, not its shell)
- `src/inngest/reconcile-group-membership.ts` — step naming, debounce pattern

**Test scenarios:**
- Happy path: before `{status: 'onboarding'}`, after `{status: 'member'}` → user removed from onboarding-members@, stays in members@, no other changes
- Happy path: before `{batchNumber: 7}`, after `{batchNumber: 8}` → removed from batch-7@, added to batch-8@
- Happy path: before `{status: 'member'}`, after `{status: 'alumni'}` → removed from members@ (alumni excluded from all system groups); no adds
- Happy path: before `{status: 'member'}`, after `{status: 'supporting_alumni', department: null}` → stays in members@, removed from any dept-members@ (department becomes null)
- Edge case: before equals after → zero Google API calls
- Edge case: user has no email → skip Google calls (email required for membership)
- Error path: Google `addGroupMember` throws → Inngest retries the step; function is idempotent (addGroupMember is a no-op if already a member)

**Verification:**
- Emitting `cockpit/user.system-groups-sync` with a status change in the admission workflow triggers the correct Google calls (verifiable in Inngest dev server).
- `DISABLE_GOOGLE_WORKSPACE=true` causes function to return early without Google calls.

---

### U3. Position change → system group sync

**Goal:** Wire `updatePositionsAction` to emit a new event after position assignments change, and add an Inngest function that syncs the affected users to position-based system groups (`board@`, `legal-board@`, `<dept>@`).

**Requirements:** R4

**Dependencies:** U1

**Files:**
- Modify: `src/lib/inngest.ts` — add `positionsSystemGroupsSync` event definition
- Modify: `src/app/(authenticated)/(app)/(default)/admin/settings/positions/update-positions-action.ts` — emit new event after position commit
- Create: `src/inngest/sync-position-system-groups.ts` — new Inngest function
- Test: `src/inngest/sync-position-system-groups.test.ts`

**Approach:**
- New event payload: `{ userId: string }` — one event emitted per affected user, not one batched event. This enables a per-user concurrency key on the Inngest function and matches the U2 pattern. The action already computes which users were affected before committing; emit one event per user in that set.
- Inngest function `syncPositionSystemGroups`:
  - Concurrency key: `event.data.userId` — prevents parallel execution for the same user.
  1. `step.run("load-positions")`: load current `userOrganizationPosition` rows for this user from DB.
  2. Use separate steps per position group (7 total — board@, legal-board@, and 5 dept@ groups):
     - `step.run("sync-google-board@")`: `listGroupMemberEmails` → compute should-be from positions → diff → adds/removes
     - `step.run("sync-google-legal-board@")`: same pattern
     - `step.run("sync-google-${dept}@")` × 5 departments: same pattern
  - Each step reads Google membership independently, ensuring partial failures are retried at group granularity.
- Positions change infrequently (admin-only action). Reading Google membership in each step is acceptable.

**Patterns to follow:**
- `updatePositionsAction` advisory lock pattern — emit event after lock release, not inside the transaction
- `src/inngest/position-assignment-notifications.ts` — trigger shape for position events

**Test scenarios:**
- Happy path: user assigned president position → added to board@, added to legal-board@
- Happy path: user removed from department_head position for events → removed from board@ (if no other positions), removed from events@
- Happy path: user assigned department_head for growth while already president → added to board@ (already there, no-op), added to growth@
- Edge case: affectedUserIds is empty → function returns immediately, zero Google calls
- Edge case: user has no START email → skip (can't add to Google Group without email)

**Verification:**
- Assigning president position in admin settings triggers the Inngest function and adds the user to `board@` and `legal-board@` in Google (observable in Inngest dev server + Google Admin console).

---

### U4. Batch creation → Google group bootstrap

**Goal:** When a new batch is created, automatically create the corresponding Google Group and add all users with that batch number.

**Requirements:** R5

**Dependencies:** U1

**Files:**
- Modify: `src/lib/inngest.ts` — add `batchCreated` event definition
- Modify: `src/app/(authenticated)/(app)/(default)/people/batches/create-batch-action.ts` — emit event after insert
- Create: `src/inngest/bootstrap-batch-system-group.ts` — new Inngest function
- Test: `src/inngest/bootstrap-batch-system-group.test.ts`

**Approach:**
- New event payload: `{ batchNumber: number }`.
- Inngest function `bootstrapBatchSystemGroup`:
  1. `step.run("create-google-group")`: call `createGoogleGroup(emailPrefix, name)` where `emailPrefix = "batch-${batchNumber}"`. This is idempotent — if the group already exists (409), it's a no-op.
  2. `step.run("load-members")`: load all users from DB, then call `getMembersOfSystemGroup(\`batch-${batchNumber}\`, users, [])` using U1's predicate. This ensures the bootstrap is consistent with the predicate definition rather than duplicating filter logic in a raw DB query.
  3. For each member (can be parallel): `step.run("add-member-${userId}")`: call `addGroupMember(groupEmail, userEmail)`.
- Use `step.run` per member for Inngest replay safety (existing pattern from `sync-groups-cron.ts` line `populate-${g.id}-${m.userId}`).

**Patterns to follow:**
- `src/inngest/sync-groups-cron.ts` — `populate-${g.id}-${m.userId}` step pattern for per-member steps

**Test scenarios:**
- Happy path: batch 12 created with 25 users → Google Group `batch-12@start-berlin.com` created, 25 `addGroupMember` calls made
- Happy path: batch created with 0 users (empty batch) → Google Group created, no member calls
- Edge case: Google Group already exists (409 from createGoogleGroup) → function continues to populate members
- Edge case: member has no email → skip that member

**Verification:**
- Creating a new batch in the admin UI triggers Inngest function (observable in dev server). `DISABLE_GOOGLE_WORKSPACE=true` skips calls but function completes without error.

---

### U5. Cron: remove criteria step, add daily system group reconcile

**Goal:** Strip the 15-min cron of its criteria-reconcile step (Step 1), keep the manual-group Google sync (Step 2), and add a daily system group reconcile step as safety net.

**Requirements:** R6, R7

**Dependencies:** U1

**Files:**
- Modify: `src/inngest/sync-groups-cron.ts`
- Create: `src/inngest/sync-system-groups-cron.ts` — new daily Inngest function for system group reconcile
- Modify: `src/lib/inngest.ts` — add `groupMembershipChanged` event, remove `groupCriteriaChanged`
- Modify: `src/lib/groups/google-sync.ts` — emit `groupMembershipChanged` instead of `groupCriteriaChanged`
- Modify: `src/inngest/reconcile-group-membership.ts` — change trigger to `groupMembershipChanged`

**Approach:**
- `syncGroupsCron` (existing 15-min cron):
  - Remove Step 1 entirely (the `find-groups-with-criteria` + `reconcile-db-${g.id}` steps and all imports of `groupCriteria`, `usersToGroups.source`, `reconcileGroupMembership`).
  - Keep Step 2 unchanged — it syncs all manual groups that have a `googleGroupEmail`.
- New separate Inngest function `syncSystemGroupsCron` in `src/inngest/sync-system-groups-cron.ts`:
  - Schedule: `cron: "TZ=Europe/Berlin 0 3 * * *"` (daily at 3am Berlin time, avoids conflict with 15-min manual group cron)
  1. `step.run("load-all-users-with-positions")`: fetch all users + their positions from DB.
  2. `step.run("load-batches")`: fetch all batch numbers from DB.
  3. For each system group (all instances from `getAllSystemGroupSlugs`):
     - `step.run("reconcile-${slug}")`: call `listGroupMemberEmails(googleEmail)`, call `getMembersOfSystemGroup(slug, users, positions)`, compute diff, execute adds/removes.
  - Register `syncSystemGroupsCron` in `src/inngest/index.ts` alongside the existing cron function.
- `groupMembershipChanged` event payload: `{ groupId: string }` (same shape as `groupCriteriaChanged`). Rename throughout.
- `triggerGoogleSync` in `google-sync.ts` emits `groupMembershipChanged` and still sets `googleSyncPending = true`. The `googleSyncPending` flag is retained for manual groups only — `reconcileGroupMembershipWorkflow` reads and clears it. System groups do not use `googleSyncPending`; they are synced via the dedicated event-driven workflows (U2, U3) and the daily `syncSystemGroupsCron`.
- `reconcileGroupMembershipWorkflow` trigger changes from `events.groupCriteriaChanged.name` to `events.groupMembershipChanged.name`. All other logic unchanged.

**Patterns to follow:**
- Existing `sync-groups-cron.ts` Step 2 loop as the model for the system group reconcile step

**Test scenarios:**
- Happy path: cron runs, Step 2 processes 3 manual groups with `googleGroupEmail` → correct diffs applied to Google
- Happy path: daily system group reconcile finds drift (user in batch-7@ Google group who should not be) → removes them
- Happy path: daily reconcile for empty batch group → `listGroupMemberEmails` returns [], `getMembersOfSystemGroup` returns [] → no-op
- Edge case: Google API unavailable during daily reconcile → step fails, Inngest retries; does not affect the 15-min manual group sync

**Verification:**
- Cron completes without referencing `groupCriteria` or `usersToGroups.source`.
- Adding a user to a manual group and running the cron within 15 minutes causes the user to appear in the Google Group.

---

### U6. UI: delete Community > Groups, remove criteria UI, update group detail routing

**Goal:** Delete the member-facing group list (Community > Groups) and all criteria UI from the group detail page. Update the `/groups/[id]` route to handle both system group slugs (computed members) and manual group IDs (from DB).

**Requirements:** R8, R10

**Dependencies:** U1

**Files:**
- Delete: `src/app/(authenticated)/(app)/(default)/groups/page.tsx`
- Delete: `src/app/(authenticated)/(app)/(default)/groups/page-client.tsx`
- Delete: `src/app/(authenticated)/(app)/(default)/groups/loading.tsx`
- Delete: `src/app/(authenticated)/(app)/(default)/groups/error.tsx`
- Delete: `src/app/(authenticated)/(app)/(default)/groups/create-group-dialog.tsx`
- Delete: `src/app/(authenticated)/(app)/(default)/groups/check-slug-action.ts`
- Delete: `src/app/(authenticated)/(app)/(default)/groups/check-integration-actions.ts`
- Delete: `src/app/(authenticated)/(app)/(default)/groups/create-group-schema.ts`
- Delete: `src/app/(authenticated)/(app)/(default)/groups/[id]/criteria-actions.ts`
- Delete: `src/app/(authenticated)/(app)/(default)/groups/[id]/bulk-actions.ts`
- Delete: `src/components/group-criteria-manager.tsx`
- Delete: `src/components/bulk-add-users-dialog.tsx`
- Delete: `src/app/api/groups/[id]/criteria/route.ts`
- Modify: `src/app/(authenticated)/(app)/(default)/groups/[id]/page.tsx` — route now handles system slugs and manual IDs
- Modify: `src/app/(authenticated)/(app)/(default)/groups/[id]/page-client.tsx` — remove criteria section, add system group view variant
- Modify: `src/app/(authenticated)/(app)/(default)/groups/[id]/skeleton.tsx` — remove criteria section and member add/remove form placeholders for the system group path; the skeleton should reflect shared structure (header, member list) without those controls
- Modify: `src/app/(authenticated)/(app)/(default)/groups/[id]/loading.tsx` — update skeleton

**Approach:**
- `groups/[id]/page.tsx` server component:
  1. Load all batch numbers from DB (for `isSystemGroupSlug`).
  2. If `isSystemGroupSlug(params.id, batches)`: load all users + positions from DB, call `getMembersOfSystemGroup(params.id, ...)`, render system group detail variant.
  3. Otherwise: look up `group` table by `id`. If not found: 404. Render manual group detail variant.
- System group detail variant: name, description, member list (computed). No add/remove controls. No criteria section. No export button (export only available in admin context per R9). No additional auth gate — inherits the `(app)` route group guard.
- Manual group detail variant: existing member management UI minus the criteria section and bulk-add dialog.
- The `create-group-action.ts` and `create-group-schema.ts` under `groups/` (not `groups/[id]/`) move to admin-only once Community > Groups is deleted — but `createGroupAction` is called from the admin groups page too, so keep the action file; only the create dialog is deleted from the community route. Confirm in implementation whether the create group dialog moves to admin > groups or is already there.

**Patterns to follow:**
- `src/app/(authenticated)/(app)/(default)/groups/[id]/not-found.tsx` — 404 pattern
- Existing `page.tsx` server-side data fetching pattern

**Test scenarios:**
- Happy path: `/groups/members` resolves to system group detail showing all active members
- Happy path: `/groups/batch-7` resolves to system group detail with correct members
- Happy path: `/groups/<manual-group-id>` resolves to manual group detail with DB members
- Error path: `/groups/unknown-slug` → not-found page
- Edge case: `/groups/batch-99` where batch 99 doesn't exist in DB → not-found (since `isSystemGroupSlug` returns false for unknown batch numbers)

**Verification:**
- No TypeScript errors after deleting `group-criteria-manager.tsx` and `criteria-actions.ts`.
- `/groups/members` renders member list without any criteria section.
- `/groups/<valid-manual-id>` renders member list with add/remove controls.

---

### U7. Personal groups page + nav update

**Goal:** Add a new `/my-groups` page showing the current user's system and manual group memberships. Update the sidebar nav to replace the Community > Groups link with My Groups.

**Requirements:** R8

**Dependencies:** U1

**Files:**
- Create: `src/app/(authenticated)/(app)/(default)/my-groups/page.tsx`
- Create: `src/app/(authenticated)/(app)/(default)/my-groups/page-client.tsx`
- Create: `src/app/(authenticated)/(app)/(default)/my-groups/loading.tsx`
- Modify: `src/components/nav-main.tsx` — replace Groups link with My Groups → `/my-groups`
- Modify: `src/db/groups.ts` — add `listManualGroupsForUser(userId)` query

**Approach:**
- `my-groups/page.tsx` server component:
  1. Load current user with `status`, `department`, `batchNumber` fields.
  2. Load current user's org positions from DB.
  3. Load all batches from DB.
  4. Compute system group memberships: `getSystemGroupsForUser(user, positions, batches)`.
  5. Load manual group memberships: `listManualGroupsForUser(currentUser.id)` — simple join of `usersToGroups` → `group`.
  6. Pass both lists to the client component.
- `my-groups/page-client.tsx`:
  - Two sections: "System groups" (labeled as auto-managed) and "My groups" (manual).
  - Each group is a clickable card/row → links to `/groups/<slug>` or `/groups/<id>`.
  - No export button anywhere on this page.
  - Empty state for each section when user belongs to none.
- No permission gate needed — this is a first-person view of the current session user.
- Nav: replace `<Link href="/groups">Groups</Link>` with `<Link href="/my-groups">My Groups</Link>` in `nav-main.tsx`. Update the `isActive` check accordingly.

**Patterns to follow:**
- `src/app/(authenticated)/(app)/(default)/admin/groups/page.tsx` — server component + client split pattern
- `src/app/(authenticated)/(app)/(default)/admin/groups/loading.tsx` — skeleton pattern

**Test scenarios:**
- Happy path: member with batch 7 and department partnerships sees batch-7@, partnerships-members@, members@ in system groups section
- Happy path: member who is in a manual group "Recruiting Batch #11 Team" sees it in the manual groups section
- Happy path: member with no manual group memberships → manual section shows empty state
- Edge case: user is president → sees board@, legal-board@, members@ in system groups
- Edge case: user is supporting_alumni (department null, batch still set) → sees batch-X@ and members@ but no dept group

**Verification:**
- `/my-groups` loads without errors for any authenticated user.
- System group memberships update automatically when user attributes change (e.g., verify after a status change in dev).
- Nav shows "My Groups" link; no more "Groups" link in the Community section.

---

### U8. Admin > Groups: merge system + manual, restricted export

**Goal:** Update the Admin > Groups page to display system groups (computed) alongside manual groups (from DB), with system groups labeled read-only. Restrict export to authorized roles.

**Requirements:** R9

**Dependencies:** U1, U6 (criteria UI already removed)

**Files:**
- Modify: `src/app/(authenticated)/(app)/(default)/admin/groups/page.tsx`
- Modify: `src/app/(authenticated)/(app)/(default)/admin/groups/page-client.tsx`
- Modify: `src/app/(authenticated)/(app)/(default)/admin/groups/loading.tsx`
- Modify: `src/app/(authenticated)/(app)/(default)/admin/groups/layout.tsx` — verify guard stays as `groups.view_all`
- Keep: `src/app/api/groups/[id]/export/route.ts` — export route stays; no change needed (permission check is already `group.export`)
- Modify: `src/db/groups.ts` — add `getSystemGroupMemberCount(slug, users, positions)` helper or compute counts inline

**Approach:**
- `admin/groups/page.tsx` server component:
  1. Load all batches and all users (with relevant fields: status, department, batchNumber) from DB.
  2. Load all org positions from DB.
  3. Compute system groups: `getAllSystemGroupSlugs(batches)` → for each slug, call `getMembersOfSystemGroup` to get member count (or pass user list to client for count computation).
  4. Load manual groups from DB: existing `listAllGroupsForAdmin`.
  5. Pass both lists to client component.
- `admin/groups/page-client.tsx`:
  - Two-section layout following the `payments/page-client.tsx` pattern: `<h2>` section heading per section, `Pagination` / `PaginationContent` / `PaginationPrevious` / `PaginationNext` from `@/components/ui/pagination` per section.
  - **System Groups section** (first): heading "System groups", read-only badge on rows. Columns: name, member count, Google email. No edit/delete controls. Clicking → `/groups/<slug>`.
  - **Manual Groups section** (second): heading "Manual groups". Existing columns (name, members, email, email-enabled). Clicking → `/groups/<id>`. Create group button stays, wrapped in `<Can permission="groups.create">`.
  - Export button per row: wrapped in `<Can permission="group.export" context={{ isMember: true }}>` — renders nothing when unauthorized. Manual groups only (system groups have no per-row export).
- Member count for system groups is computed server-side from the user list — no extra DB queries.

**Patterns to follow:**
- `src/app/(authenticated)/(app)/(default)/payments/page-client.tsx` — two-section layout with `<h2>` headings and `Pagination` per section
- `src/app/(authenticated)/(app)/(default)/admin/people/[id]/` — multiple independent tables on one page
- `src/components/groups-table.tsx` — `<Can>` component usage for conditional rendering
- `src/app/(authenticated)/(app)/(default)/groups/[id]/page-client.tsx:186` — `can("group.export", groupScope)` pattern

**Test scenarios:**
- Happy path: admin sees system groups section with correct member counts and manual groups section
- Happy path: clicking a system group row navigates to `/groups/members` (or relevant slug)
- Edge case: no manual groups exist → manual section shows empty state, system groups still visible
- Access control: user with only `groups.view_all` can see all groups but cannot see export controls (if `group.export` not granted)
- Access control: `people_admin` can see export controls

**Verification:**
- Admin > Groups page loads without errors.
- System groups member counts match what `/groups/<slug>` detail page shows.
- Export controls visible to admin, not visible to a user with only `groups.view_all`.

---

### U9. Code deletions + db/groups.ts cleanup

**Goal:** Delete all criteria-related code (rule engine, reconcile, old Inngest workflows, bulk-add components), clean up `db/groups.ts` and `db/people.ts` of all references to the deleted schema elements, and clean up the Inngest function registry.

**Requirements:** R7

**Dependencies:** U2, U3, U4 (all modify `src/lib/inngest.ts` — their event additions must land before U9 removes dead events), U5 (cron no longer references criteria), U6 (UI no longer imports criteria components)

**Files:**
- Delete: `src/lib/groups/rule.ts`
- Delete: `src/lib/groups/rule-sql.ts`
- Delete: `src/lib/groups/criteria.ts`
- Delete: `src/lib/groups/reconcile.ts`
- Delete: `src/inngest/reconcile-user-group-membership.ts`
- Modify: `src/db/groups.ts` — remove: `addGroupCriteria`, `getGroupCriteria`, `getGroupCriteriaById`, `removeGroupCriteria`, `addUsersMatchingCriteria`, `findUsersNotInGroupByCriteria`, `pinGroupMember`, `listGroupsPublic`; update: `addUsersToGroup` (remove `source` parameter, always inserts without source column after migration); update: `addUserToGroup`, `removeUserFromGroup` (remove `source`-related logic); update: `getGroupDetail` — remove the `criteria: GroupCriteria[]` field from the `GroupDetail` interface and delete the `groupCriteria` join/select from the query body (prevents a runtime error when U10 drops the table)
- Modify: `src/db/people.ts` — remove `usersToGroups.source` from any select queries that reference it
- Modify: `src/app/(authenticated)/(app)/(default)/groups/[id]/actions.ts` — remove `pinGroupMemberAction`
- Modify: `src/app/api/groups/[id]/route.ts` — remove criteria from response shape if present
- Modify: `src/inngest/index.ts` — remove `reconcileUserGroupMembershipWorkflow` from exported functions array
- Modify: `src/lib/inngest.ts` — remove `groupCriteriaChanged` event (replaced by `groupMembershipChanged` from U5)
- Modify: `src/app/(authenticated)/(app)/(default)/admin/groups/page-client.tsx` — remove any `source` display column (research confirms it was not displayed, but verify)
- Modify: `src/app/(authenticated)/(app)/(default)/groups/create-group-action.ts` — remove `source: "manual"` from `usersToGroups.values()` call (source column gone)

**Approach:**
- This unit is primarily deletion. Work through each deleted file's import graph and remove all downstream references.
- `db/groups.ts` is the central node: updating it first will surface all call sites with TypeScript errors that need cleanup. Update `getGroupDetail` first: remove the `criteria: GroupCriteria[]` field from `GroupDetail` and delete the `groupCriteria` join from the query — the table is dropped in U10 and this call would fail at runtime.
- `pinGroupMemberAction` in `groups/[id]/actions.ts`: remove the export entirely; verify nothing in the UI still calls it (the pin button should have been removed with the criteria UI in U6).
- After all deletions, run `npm run lint` to catch any remaining stale imports.

**Test scenarios:**
- Test expectation: none — this is a deletion unit with no new behavior. TypeScript compilation succeeding is the primary verification.

**Verification:**
- `npm run lint` passes with no errors.
- `tsc --noEmit` passes.
- No runtime references to `groupCriteria`, `groupMembershipSource`, `source`, `reconcileGroupMembership`, `reconcileUserGroupMembership`, `rule`, `criteria`, `pinGroupMember` remain in non-test code.

---

### U10. DB schema migration

**Goal:** Drop `groupCriteria` table, `group_membership_source` enum, and `source` column from `usersToGroups` via two Drizzle migrations (split to guarantee safe DROP ordering).

**Requirements:** R7

**Dependencies:** U9 (all code references to deleted schema elements must be removed first)

**Files:**
- Modify: `src/db/schema/group.ts` — two-pass edit (see Approach)
- Create: `src/db/migrations/<timestamp>_drop_group_criteria_and_source_column.sql` (auto-generated by first `db:generate`)
- Create: `src/db/migrations/<timestamp>_drop_group_membership_source_enum.sql` (auto-generated by second `db:generate`)

**Approach:**

No data cleanup is required — `usersToGroups` and `groupCriteria` are empty, and any existing Google Workspace groups will be deleted manually before deployment.

Use a two-migration split to guarantee safe DROP ordering (Drizzle may otherwise emit `DROP TYPE` before `ALTER TABLE DROP COLUMN`, which fails since the column still references the enum):

**Migration 1 — drop column and table:**
- Edit `src/db/schema/group.ts`: remove the `source` column from `usersToGroups`, remove the entire `groupCriteria` table definition and `groupCriteriaRelations`, remove `criteria: many(groupCriteria)` from `groupRelations`. Leave the `groupMembershipSource` enum declaration in place for now.
- Run `npm run db:generate` → generates migration with `ALTER TABLE users_to_groups DROP COLUMN source` and `DROP TABLE group_criteria`.
- Run `npm run db:migrate`.

**Migration 2 — drop enum:**
- Edit `src/db/schema/group.ts`: remove the `groupMembershipSource` pgEnum declaration.
- Run `npm run db:generate` → generates migration with `DROP TYPE group_membership_source`.
- Run `npm run db:migrate`.

**Test scenarios:**
- Happy path: after migration 1, `SELECT source FROM users_to_groups` fails (column not found) ✓
- Happy path: after migration 1, `SELECT * FROM group_criteria` fails (table not found) ✓
- Happy path: after migration 2, `SELECT enum_range(NULL::group_membership_source)` fails (type not found) ✓

**Verification:**
- Migration applies cleanly on a local DB restore.
- `npm run db:studio` shows `users_to_groups` without `source` column, and no `group_criteria` table.
- Application starts without error after migration.

---

## System-Wide Impact

- **Interaction graph**: `cockpit/user.updated` consumers: `reconcileUserGroupMembershipWorkflow` deleted. New consumer: `syncUserSystemGroups` on `cockpit/user.system-groups-sync`. `group/criteria.changed` event: deleted, replaced by `group/membership.changed` for manual group sync. Position assignment action: gains `cockpit/positions.system-groups-sync` event emission (one per affected user), consumed by new `syncPositionSystemGroups` function. Batch creation action: gains `cockpit/batch.created` event emission, consumed by new `bootstrapBatchSystemGroup` function. New daily cron: `syncSystemGroupsCron`.
- **Error propagation**: Google API failures in Inngest sync steps are retried automatically by Inngest. The daily reconcile provides a catch-all for any drift that survives retries. `DISABLE_GOOGLE_WORKSPACE=true` silences all Google calls in dev.
- **State lifecycle risks**: No pre-migration data cleanup is required — all relevant tables are empty and Google Workspace groups will be cleared manually before deployment. The two-migration split in U10 handles enum ordering safely.
- **API surface parity**: `src/app/api/groups/[id]/criteria/route.ts` is deleted. Any external caller of this endpoint will receive 404 after deploy. Verify no external integrations depend on it.
- **Integration coverage**: The event-driven sync is the primary path; the daily reconcile is the safety net. Integration tests should cover the full path: emit event → Inngest function runs → Google API called. Inngest dev server makes this testable locally.
- **Unchanged invariants**: Manual group creation, member add/remove, and Google sync for manual groups remain mechanically identical — only the trigger event name changes from `group/criteria.changed` to `group/membership.changed`. Existing `triggerGoogleSync()` call sites in the group actions are not affected.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Drizzle generates DROP TYPE before DROP COLUMN, causing migration failure | Resolved: U10 uses a two-migration split — migration 1 drops the column and table, migration 2 drops the enum. Ordering is deterministic. |
| `cockpit/user.system-groups-sync` event not emitted by all lifecycle paths | Research confirmed 6 emission sites for `cockpit/user.updated` plus `import-google-user-action.ts`. U2 audits each and adds the new emission. Deferred paths (future department/batch edits) documented in Scope Boundaries. |
| Position changes not covered if `updatePositionsAction` is missed | U3 is a targeted, self-contained change to a single server action. Risk is low. |
| Bulk-add regression for manual groups | Acknowledged in Scope Boundaries. Manual groups are hand-managed one-by-one post-refactor. |
| System group detail pages accessible to all authenticated users (no member gate) | Intentional decision. System groups are informational; all members can see group composition. Admin export is still gated. |

---

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-24-system-groups-architecture-requirements.md](docs/brainstorms/2026-05-24-system-groups-architecture-requirements.md)
- Related code: `src/lib/groups/`, `src/inngest/sync-groups-cron.ts`, `src/inngest/reconcile-group-membership.ts`, `src/lib/google-workspace/directory.ts`
- Related institutional learnings: `docs/solutions/architecture-patterns/member-lifecycle-entry-points-and-application-flow-2026-05-10.md`, `docs/solutions/architecture-patterns/membership-journey-vs-payment-journey-2026-05-12.md`
