# System Groups Architecture

**Date:** 2026-05-24
**Status:** Ready for planning

## Problem

The current group system uses a generic rule engine (JSONB criteria → SQL where-clauses) to define group membership. In practice, every group START needs is fully derivable from fields already on the user record and the authority model. The generic engine adds carrying cost — criteria UI, rule builder, criteria actions, reconciliation complexity — without delivering value beyond the hardcoded use case.

Additionally, storing user↔group assignments for criteria-driven groups creates redundant state that can drift from reality. Since system group membership is always computable from user attributes, those rows don't need to exist.

## Proposed Design

A two-class group system:

- **System groups** — defined as TypeScript templates, synced to Google Workspace, zero DB presence
- **Manual groups** — user-created, hand-managed membership, stored in the `group` table and `usersToGroups` table

---

## System Group Definitions

System groups are defined as TypeScript constants in a single file. Each definition includes a slug template, display name, Google email prefix, and a membership predicate function over user attributes.

### Static groups

| Email | Members |
|---|---|
| `members@start-berlin.com` | status ∈ {onboarding, member, supporting_alumni} |
| `onboarding-members@start-berlin.com` | status = onboarding |
| `board@start-berlin.com` | any org position (president, VP, finance head, any dept head) |
| `legal-board@start-berlin.com` | position ∈ {president, vice_president, head_of_finance} |

### Per-department groups (×5 departments)

| Email | Members |
|---|---|
| `<dept>@start-berlin.com` | department_head position for that department |
| `<dept>-members@start-berlin.com` | department = dept AND status ∉ {cancelled, alumni} |

### Per-batch groups (×N batches)

| Email | Members |
|---|---|
| `batch-<x>@start-berlin.com` | batchNumber = x AND status ∉ {cancelled, alumni} |

Batch groups are generated dynamically: for every batch row in the database, a system group exists.

### Manual groups (not system-managed)

The following groups are created by admins and managed by hand:

- `it@start-berlin.com`
- `memberships@start-berlin.com`
- `finance@start-berlin.com`
- Any ad-hoc project groups (e.g. "Recruiting Batch #11 Team")

---

## Sync Model

### Event-driven path (primary)

When a user's relevant attributes change, the `user.updated` Inngest event must carry **both before and after values** of the fields that affect system group membership:

- `status`
- `department`
- `batchNumber`

The sync workflow:
1. Compute which system groups the user belonged to (from old attributes)
2. Compute which system groups the user should belong to (from new attributes)
3. Diff → execute adds/removes directly against the Google Admin SDK
4. No Google read required on this path

For org position changes (`board@`, `legal-board@`, `<dept>@`): the existing position assignment and removal Inngest workflows handle Google sync directly on the same event-driven pattern. The position change event carries enough information to compute the before/after effect on these groups without any Google read.

### New batch creation

When a new batch is created:
1. An Inngest step creates the Google Group (`batch-<x>@start-berlin.com`)
2. A second step queries all users with `batchNumber = x` and adds them to the Google Group
3. No DB rows are created for the group itself

### Daily reconcile (safety net)

Runs once per day. For each system group definition:
1. Load current members from Google API
2. Compute should-be members from user attributes via the TypeScript predicate
3. Execute any diff

Expected to find no drift when the event-driven path is working correctly.

Manual groups also reconcile: compare `usersToGroups` to Google Group membership, fix drift.

---

## Database Changes

### Deleted

- `group_criteria` table
- `group_membership_source` enum (all remaining `usersToGroups` rows are manual by definition — the column is dropped)

### Deleted code

- `src/lib/groups/rule.ts`
- `src/lib/groups/rule-sql.ts`
- `src/lib/groups/criteria.ts` (if it exists)
- `src/app/(authenticated)/(app)/(default)/groups/[id]/criteria-actions.ts`
- `src/app/(authenticated)/(app)/(default)/groups/page.tsx` and surrounding route files (Community > Groups list)
- Criteria section from the group detail UI

### `group` table (manual groups only)

No schema changes required beyond removing the criteria relation. Existing columns remain:

- `id`, `name`, `slug`, `emailEnabled`, `googleEmailPrefix`, `googleGroupEmail`, `googleSyncPending`

`googleSyncPending` remains useful for manual groups: when a member is manually added or removed, the flag is set and an Inngest workflow syncs to Google.

### `usersToGroups` table

The `source` column (currently `group_membership_source` enum with values `criteria | manual`) is dropped. Every row in this table is a manual assignment.

---

## UI

### Removed: Community > Groups

The existing member-facing groups list page (`src/app/(authenticated)/(app)/(default)/groups/page.tsx` and its surrounding route) is deleted. Members no longer browse all groups. Their group context is surfaced through the Personal page instead.

### Personal groups page (new)

A new page accessible to all authenticated members showing only the groups they personally belong to.

- **System group memberships** — computed from the user's current attributes via the TypeScript predicates. No DB or Google query required.
- **Manual group memberships** — fetched from `usersToGroups`
- Each group is clickable → group detail view showing all current members
- No export available on this surface

### Admin > Groups

Accessible to admins only. Shows all groups merged from two sources:

1. **System groups** — computed list from TypeScript definitions + current DB state (all batches, all departments). Read-only. Labeled as system-managed.
2. **Manual groups** — fetched from `group` table. Fully editable (create, rename, manage members).

**Export** restricted to users with role `super_admin`, `admin`, `people_admin`, or access grant `group.export`.

### Group detail page (system groups)

- Member list computed from user attributes via the predicate. Always fresh, no DB group-membership rows to query.
- No criteria section, no manual add/remove controls.
- Accessible from both the Personal page and Admin > Groups.
- URL uses the system group slug (e.g. `/groups/batch-7`, `/groups/members`). The routing layer checks system group definitions first, then falls back to the `group` table.

### Group detail page (manual groups)

- Member list from `usersToGroups`
- Add/remove members by hand (admin only)
- No criteria section (criteria are deleted entirely)
- Accessible from Admin > Groups; members can view (but not edit) if linked from their Personal page

---

## Out of Scope

- Any UI for configuring system group membership rules — rules live in code, changing them requires a deploy
- Admin overrides to manually add/remove people from system groups
- Alumni-specific email group (alumni and cancelled users fall out of all system groups)
- Criteria-based rules for manual groups

---

## Open Questions

- Should `<dept>-members@` include supporting_alumni members of that department, or only onboarding/member statuses?
- Should `batch-<x>@` groups be deleted from Google Workspace when a batch is somehow removed from the DB (currently no deletion concept exists on the batch table)?
