# Admin Tasks Page — Requirements

**Date:** 2026-05-25  
**Status:** Ready for planning

## Overview

Create a new Admin > Tasks section that surfaces all pending (and historical) administrative action items in one place. Currently, board resolution votes are buried at `/people/resolutions/[id]`, and no UI exists at all for approving alumni transitions or acknowledging cancellations — admins only receive email links pointing at the generic person profile page. This feature replaces that patchwork with a purpose-built, permission-aware tasks workflow.

## Problem

- Board resolution voting is only discoverable if you know the URL from an email. There's no admin-facing list.
- The `transitionDecided` Inngest event (alumni/supporting-alumni approval) and `cancellationAcknowledged` event are defined and waited on by workflows, but no UI has been built to send them — making these workflows non-functional in practice.
- Department heads and people_admin users currently have no visibility into pending membership actions even though they're involved in the process.

## Goals

1. Give every admin a single place to see and act on all pending tasks they are authorized to handle.
2. Make board resolution voting, alumni approval, and cancellation acknowledgement all accessible through a consistent, purpose-built UI.
3. Provide read-only visibility into the same tasks for people_admin and other non-voting admins.
4. Preserve a complete history of completed tasks.

## Non-Goals

- Real-time push notifications or nav badge counts
- Pagination (task count at small org scale is manageable)
- Separate "open" vs "completed" tab views (single table with filters covers this)

---

## Routes

### Index: `/admin/tasks`

Unified task table. Protected by a layout gate using `can("tasks.view_any")`: if false, redirect to `/membership`.

### Detail pages

| Route | Task type | ID semantics |
|---|---|---|
| `/admin/tasks/vote-admission/[legalMembershipId]` | Board resolution vote | The `legalMembership.id` — same identifier used by the existing resolution voting page |
| `/admin/tasks/approve-alumni/[userId]` | Alumni or supporting-alumni approval | Subject's userId; resolves to their active `membershipTransitionRequest` of type `alumni_request` or `supporting_alumni_request` |
| `/admin/tasks/acknowledge-cancellation/[userId]` | Cancellation acknowledgement | Subject's userId; resolves to their active `membershipTransitionRequest` of type `cancellation` with `reason = 'resigned'` |

The existing `/people/resolutions/[legalMembershipId]` page redirects to `/admin/tasks/vote-admission/[legalMembershipId]` (same ID, trivial redirect). Email links sent by the Inngest workflows are updated to point to the new detail routes.

---

## Task Table (Index Page)

### Columns

| Column | Notes |
|---|---|
| Type | "Board resolution", "Alumni approval", "Cancellation acknowledgement" |
| Member | Full name of subject user, linked to their admin profile |
| Submitted | `requestedAt` / `legalMembership.startedAt` (creation time) |
| Deadline | Calculated deadline; see below |
| Status | Open / Completed (with sub-status label for completed: approved, rejected, expired, retracted, executed) |
| Action | Button (see below) |

**Sorting:** Oldest first by creation time. Completed tasks appear below open tasks; within each group, oldest first.

### Deadline calculation

All three task types have calculable deadlines:

- **Admission vote:** `legalMembership.startedAt + 90 days` — approximation for round 1. The admission workflow supports up to 3 × 90-day rounds, but the DB only stores `startedAt`; later rounds are not individually tracked. This approximation is acceptable: if a vote timed out after round 1 it transitions to `manual_followup` and the row is no longer open.
- **Alumni/supporting-alumni approval:** `membershipTransitionRequest.requestedAt + 30 days`
- **Cancellation acknowledgement:** `membershipTransitionRequest.requestedAt + 7 days`

Show deadline as an absolute date. If the deadline has already passed, show it in a destructive/red style.

### Action button

- **Open task, user has action permission:** Navigates to the detail page. First open/actionable row in the table: `variant="default"` (primary). All other rows: `variant="outline"` (secondary). Button label matches the task type ("Vote", "Approve / Reject", "Acknowledge").
- **Open task, user has view permission only (no action):** Secondary "View" button, navigates to detail page in read-only mode.
- **Completed task:** Secondary "View" button.

### Filters

Both are multi-select, powered by nuqs URL params.

- **Type:** Only shows types the current user can view. A people_admin sees "Alumni approval" and "Cancellation acknowledgement" only. A departmentHead, legalOfficer, or admin sees all three including "Board resolution".
- **Member:** Only shows subject users who have at least one task visible to the current user (across any status/page). Displayed as full name.

---

## Detail Pages

### Common behavior

- Page is gated: user must have at least view permission for that task type.
- If the user has view permission only (no action permission), the action form/buttons are hidden and the page is read-only.
- If the task is completed, the page shows the outcome (decision, who decided, when) and is read-only regardless of permissions.
- If no matching task exists for the userId (wrong route, already deleted — shouldn't happen per data retention policy), return 404.

### Vote admission detail

Mirrors the current `resolution-vote-client` UI. Gated by `membership.resolution.admission.view`. Shows resolution text, participants, and existing votes. The vote form is only shown if the current user is a participant in this resolution and hasn't voted yet (i.e. they have `membership.resolution.admission.vote`). departmentHeads who can view but are not participants see the resolution in read-only mode.

### Approve-alumni detail

Shows subject name, transition type, submitted date, and reason (if provided).

**Alumni request (full exit):** Follows the two-step pattern from `src/app/(authenticated)/(app)/(default)/admin/people/[id]/remove/page-client.tsx`.
- Step 1: Consequences panel (destructive red styling) listing what approval means: membership ends, Google account suspended then permanently deleted after 7 days, all START Berlin access revoked. Approve (destructive) and Reject buttons.
- Reject: fires immediately, no confirmation step needed.
- Approve (step 2): Two checkboxes the approver must tick before the final destructive confirm button enables — matching the admin remove page pattern.

**Supporting alumni request (status change only):** Single-step. Simple Approve / Reject buttons with the request details shown, no consequences panel (mirrors the lightweight member-facing supporting alumni submission step).

On approve: fires `transitionDecided` Inngest event with `{ transitionRequestId, decision: "approved", decidedByUserId }`.  
On reject: fires `transitionDecided` with `decision: "rejected"`.

### Acknowledge-cancellation detail

Shows subject name, submitted date, and reason. The acknowledgement is a notification step — the cancellation proceeds regardless after the 7-day window, so there is no reject path. Only self-service cancellations (`reason = 'resigned'`) have an acknowledgement task; board-initiated removals (`reason = 'removed_by_board'`) do not appear in the task list at all (visible in the audit log instead).

Single Acknowledge button, only shown if user has `membership.cancellation.acknowledge` for this user's department scope. No two-step confirmation needed — the admin is confirming awareness, not taking an irreversible action themselves (the member already committed to the cancellation).

On acknowledge: fires `cancellationAcknowledged` Inngest event with `{ transitionRequestId, acknowledgedByUserId }`.

---

## Permission Model

### Permission renames

The existing resolution permissions are renamed to scope them to admission and leave room for future resolution types:

| Old name | New name |
|---|---|
| `membership.resolution.vote` | `membership.resolution.admission.vote` |
| `membership.resolution.view` | `membership.resolution.admission.view` |

All references in `src/lib/permissions/evaluate.ts`, `src/app/(authenticated)/(app)/(default)/people/resolutions/`, and the resolution vote action must be updated.

### New permissions

Two new global/unscoped view permissions:

| Permission | Who gets it | What it unlocks |
|---|---|---|
| `membership.resolution.admission.view` | admin, legalOfficer, departmentHead (anyone who can propose a member — mirrors `user.membership.propose`) | View admission board resolution tasks |
| `membership.transition.view` | people_admin; also implied by `membership.transition.decide` (legalOfficer, departmentHead) | View alumni/supporting-alumni approval tasks |
| `membership.cancellation.view` | people_admin; also implied by `membership.cancellation.acknowledge` (legalOfficer, departmentHead) | View cancellation acknowledgement tasks |

`membership.resolution.admission.view` is now broader than the old `membership.resolution.view`: departmentHeads gain read-only visibility into all admission resolutions (they can propose members but couldn't previously see the resolution status). people_admin remains excluded.

### Implication rule

Action permissions imply their corresponding view permission at evaluation time:
- `membership.resolution.admission.vote` → implies `membership.resolution.admission.view`
- `membership.transition.decide` (user-scoped) → implies `membership.transition.view`
- `membership.cancellation.acknowledge` (user-scoped) → implies `membership.cancellation.view`

### Tasks nav item visibility

Show the Tasks nav item when `can("tasks.view_any")` is true. Add a new global action `tasks.view_any` to `src/lib/permissions/evaluate.ts` with the rule: `hasAdminGrant || hasPeopleAdminGrant || isLegalOfficer || isDepartmentHead(any)`.

### Data filtering

The task table only shows rows the current user can actually view:
- Admission rows: user has `membership.resolution.admission.view` (admin, legalOfficer, or departmentHead — people_admin excluded)
- Alumni/supporting-alumni rows: user has `membership.transition.view` OR can `membership.transition.decide` for that user's department
- Cancellation rows: user has `membership.cancellation.view` OR can `membership.cancellation.acknowledge` for that user's department

---

## Navigation

New top-level item in the Admin sidebar group:

```
Admin
  ├─ People (collapsible)
  ├─ Tasks          ← new, top-level
  ├─ Groups
  ├─ Payments
  ├─ Audit log
  └─ Settings (collapsible)
```

Visibility gated by `evaluateCanViewAnyTask`. Icon: `ListTodo` or `ClipboardList` (Lucide).

---

## Email Links

Update all Inngest workflows to point email CTAs to the new task detail routes:

| Workflow | Current link | New link |
|---|---|---|
| `membership-admission-workflow` | `/people/resolutions/${legalMembershipId}` | `/admin/tasks/vote-admission/${legalMembershipId}` |
| `membership-transition-workflow` | `/admin/people/${userId}` | `/admin/tasks/approve-alumni/${userId}` |
| `membership-cancellation-workflow` | `/admin/people/${userId}` | `/admin/tasks/acknowledge-cancellation/${userId}` |

Previously-sent email links pointing to `/people/resolutions/[legalMembershipId]` continue to work via the redirect. Previously-sent links to `/admin/people/${userId}` continue to work since that page still exists.

---

## Data Retention

`legalMembership` and `membershipTransitionRequest` records must never be deleted. Both tables already enforce `onDelete: "no action"` on the `user_id` FK. No cleanup cron exists for either table (verified — the only data cleanup cron in `src/inngest/` targets GoCardless events, not membership records). This policy must be maintained: add a comment in the relevant schema files confirming this is intentional.

Completed task statuses to display in the history:
- **Admission votes:** `legalMembership` where `boardResolutionText IS NOT NULL` and status is `active` (admitted), `cancelled`, or `manual_followup`
- **Alumni/supporting-alumni approvals:** `membershipTransitionRequest` where `type IN ('alumni_request', 'supporting_alumni_request')` and status is `executed`, `retracted`, or `expired`
- **Cancellation acknowledgements:** `membershipTransitionRequest` where `type = 'cancellation'` AND `reason = 'resigned'` (self-service only — excludes board-initiated removals) and status is `executed`, `retracted`, or `expired`

---

## Loading Skeletons

Per project convention, add `loading.tsx` files for:
- `/admin/tasks` (table skeleton)
- `/admin/tasks/vote-admission/[userId]`
- `/admin/tasks/approve-alumni/[userId]`
- `/admin/tasks/acknowledge-cancellation/[userId]`
