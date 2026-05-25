---
title: "feat: Admin > Tasks page — unified pending action items for admins"
type: feat
status: active
date: 2026-05-25
origin: docs/brainstorms/admin-tasks-page-requirements.md
---

# feat: Admin > Tasks page — unified pending action items for admins

## Summary

Adds a new `/admin/tasks` section surfacing all pending administrative action items in one table: board resolution votes, alumni/supporting-alumni transition approvals, and self-service cancellation acknowledgements. Each row links to a purpose-built detail page. Board resolutions move from the hidden `/people/resolutions/[id]` route; the two other task types have no UI at all today (their Inngest `transitionDecided` / `cancellationAcknowledged` events are waited on by workflows but never fired). This feature makes those workflows functional and gives every admin a single place to act on or monitor all pending membership tasks.

---

## Problem Frame

- `/people/resolutions/[id]` is only discoverable via email link; there is no admin-facing list.
- `transitionDecided` and `cancellationAcknowledged` Inngest events have no UI to fire them, making the transition and cancellation workflows non-functional in practice.
- Department heads and people_admin users have no visibility into pending membership actions even though they're involved in those processes.

---

## Requirements

- R1. Unified `/admin/tasks` table: board resolution votes, alumni/supporting-alumni approvals, cancellation acknowledgements in one place, oldest-first, completed below open, paginated.
- R2. Detail pages: `/admin/tasks/vote-admission/[legalMembershipId]`, `/admin/tasks/approve-alumni/[userId]`, `/admin/tasks/acknowledge-cancellation/[userId]`.
- R3. Permission renames: `membership.resolution.vote` → `membership.resolution.admission.vote`; `membership.resolution.view` → `membership.resolution.admission.view` (all refs updated).
- R4. New global view permissions: `membership.transition.view` (people_admin; also implied by `membership.transition.decide`), `membership.cancellation.view` (people_admin; also implied by `membership.cancellation.acknowledge`).
- R5. `membership.resolution.admission.view` broadened to include departmentHead (anyone who can propose a member).
- R6. New global action `tasks.view_any` gates nav item and layout route: `hasAdminGrant || hasPeopleAdminGrant || isLegalOfficer || isDepartmentHead(any)`.
- R7. Table filters: Type (multi-select, only types the viewer can see) and Member (multi-select, all members with any visible task across all pages — not just current page). Both powered by nuqs URL params.
- R8. Alumni approval: two-step destructive UI with consequences panel + two mandatory checkboxes (mirrors `admin/people/[id]/remove/page-client.tsx` pattern). Fires `transitionDecided` with `decision: "approved" | "rejected"`.
- R9. Supporting-alumni approval: single-step approve/reject, no consequences panel. Same `transitionDecided` event.
- R10. Cancellation acknowledgement: single "Acknowledge" button, no reject path. Fires `cancellationAcknowledged`. Only shown for `reason = 'resigned'`; board-initiated removals (`reason = 'removed_by_board'`) excluded from task list.
- R11. Redirect: `/people/resolutions/[id]` → `/admin/tasks/vote-admission/[id]`.
- R12. Update email CTA links in all three Inngest workflows.
- R13. Data retention: `legalMembership` and `membershipTransitionRequest` records must never be deleted. Add schema-file comments confirming this is intentional.
- R14. Deadline display: admission `startedAt + 90d`, alumni `requestedAt + 30d`, cancellation ack `requestedAt + 7d`. Past deadlines in destructive/red style.
- R15. Loading skeletons for all four routes.

---

## Scope Boundaries

- No real-time nav badge counts or push notifications.
- No separate open/completed tabs — single table with Status column and Sort.
- No UI for `reason = 'removed_by_board'` cancellations (audit log only).
- Admission vote UI is moved, not redesigned — it mirrors the existing `resolution-vote-client.tsx` layout.
- No changes to GoCardless or payment flows.

---

## Context & Research

### Relevant Code and Patterns

- `src/lib/permissions/evaluate.ts` — permission system core. `globalActions` and `userScopedActions` are `as const` arrays; adding a name here updates the type guard automatically, but the corresponding `switch` case in `evaluateGlobalAction` / `evaluateUserScopedAction` must also be added. Currently contains `membership.resolution.vote` and `membership.resolution.view` (both to be renamed).
- `src/lib/permissions/server.ts` — `can()` server helper; no changes needed here, additions to `evaluate.ts` are sufficient.
- `src/lib/permissions/permissions.test.ts` — test pattern: `node:test` + `node:assert/strict`, `authority(overrides)` helper, calls `evaluateAuth(authority({...}), "action", scope?)`. New actions need allowed/denied cases.
- `src/app/(authenticated)/(app)/(default)/people/resolutions/[id]/vote-action.ts` — vote action pattern: `actionClient.inputSchema().action()`, in-action `can()` recheck, atomic JSONB append with `@>` containment operator, `inngest.send()`, audit log write.
- `src/app/(authenticated)/(app)/(default)/people/resolutions/[id]/resolution-vote-client.tsx` — UI to move; uses local `useState` (not `useAction` hook). Currently redirects to `/people?view=actions` on success (update to `/admin/tasks`). Two states: participant+not-voted → vote form; otherwise → read-only.
- `src/app/(authenticated)/(app)/(default)/admin/people/[id]/remove/page-client.tsx` — two-step pattern for alumni approval UI. Step 1: consequences panel with destructive red border/bg and checklist items. Step 2: two mandatory checkboxes before the destructive confirm button enables.
- `src/app/(authenticated)/(app)/(default)/membership/become-alumni/[step]/(steps)/step-supporting-alumni.tsx` — lightweight single-step pattern for supporting alumni (no consequences panel, simple Alert + submit).
- `src/db/people-actions.ts` — `getPendingBoardActionsForUser(userId)` filters JSONB with `@> [{userId}]::jsonb`. Vote button href currently `/people/resolutions/${legalMembershipId}` — must update to `/admin/tasks/vote-admission/${legalMembershipId}`.
- `src/db/membership-transitions.ts` — `MembershipTransitionRequest` type; `reason` column: `resigned` = self-service (has ack task), `removed_by_board` = board-initiated (no ack task). `decidedByUserId` has `onDelete: "set null"` — UI must handle null.
- `src/components/nav-main.tsx` — Admin sidebar: `HidableSidebarGroup` + `Can` component. New Tasks item is a flat `SidebarMenuItem` (not collapsible) between People collapsible and Groups.
- `src/inngest/membership-admission-workflow.ts` line ~113: `resolutionUrl` → update to `/admin/tasks/vote-admission/${legalMembershipId}`.
- `src/inngest/membership-transition-workflow.ts` line ~126: `profileUrl` → update to `/admin/tasks/approve-alumni/${userId}`.
- `src/inngest/membership-cancellation-workflow.ts` line ~128: `profileUrl` → update to `/admin/tasks/acknowledge-cancellation/${userId}`.
- Pagination convention: `docs/solutions/conventions/pagination-server-pagecount-pattern-2026-05-18.md` — DB query returns `{ rows, total, pageCount }`. nuqs `useQueryState` only for URL params. Never import from `@/db/*` in client components.

---

## Key Technical Decisions

### D1: `legalMembershipId` as route param for admission tasks (not userId)

A user can have multiple `legalMembership` rows (one per admission cycle). Using `legalMembershipId` directly as the route param eliminates any ambiguity and is the same identifier the existing resolution voting page uses. The admission task route is `/admin/tasks/vote-admission/[legalMembershipId]`.

### D2: Unified `AdminTaskRow` type in a dedicated DB module

A new `src/db/admin-tasks.ts` normalises the three task sources (`legalMembership` + two `membershipTransitionRequest` variants) into a single `AdminTaskRow` discriminated union. This keeps all cross-source join/sort/filter logic in one place and avoids importing from `@/db/*` in client components (which causes `Cannot resolve 'net'` errors).

### D3: Separate paginated rows query and all-members query

The task index page needs two independent data shapes:
1. `getAdminTasksPage(...)` → `{ rows: AdminTaskRow[], total: number, pageCount: number }` — filtered + paginated, used to render the table.
2. `getAllVisibleTaskMembers(authority)` → `{ id: string; name: string }[]` — all distinct subject users with any visible task across all pages/filters, used to populate the Member filter dropdown.

Both run server-side on page load; only the first changes on page/filter navigation.

### D4: Implication rules implemented as rule broadening, not runtime checks

Rather than adding runtime `can("view") || can("decide")` logic in multiple places, the view permissions (`membership.transition.view`, `membership.cancellation.view`) are evaluated with rules that include everyone who can act (`isLegalOfficer || isDepartmentHead`) plus people_admin directly. This means the implication is structural, not procedural.

### D5: Alumni vs supporting-alumni UX differentiation

Alumni (full exit): two-step destructive confirmation matching `remove/page-client.tsx`. Step 1 shows consequences (Google account deletion, access revocation). Step 2 requires two checkboxes before the confirm button enables.

Supporting alumni (status change only): single-step. Simple Approve / Reject buttons with request details. No consequences panel.

The distinction is based on `membershipTransitionRequest.type`: `alumni_request` → two-step, `supporting_alumni_request` → single-step.

### D6: Pagination with nuqs

Page number, type filter, and member filter are all nuqs URL params. The server component reads them via `createSearchParamsCache`. `pageSize` is a constant (e.g. 20). The table skeleton height is fixed to avoid layout shift on page change (see skeleton rule from CLAUDE.md).

---

## Implementation Units

### U1 — Permission system updates

**Files:**
- `src/lib/permissions/evaluate.ts`
- `src/lib/permissions/permissions.test.ts`

**Changes:**
- Rename `"membership.resolution.vote"` → `"membership.resolution.admission.vote"` in `globalActions` array and `evaluateGlobalAction` switch case. Same rule: `isLegalOfficer(authority)`.
- Rename `"membership.resolution.view"` → `"membership.resolution.admission.view"` in `globalActions` array and switch case. Broaden rule: `hasAdminGrant(authority) || isLegalOfficer(authority) || isDepartmentHead(authority)` (departmentHead added).
- Add `"membership.transition.view"` to `globalActions`. Rule: `hasPeopleAdminGrant(authority) || isLegalOfficer(authority) || isDepartmentHead(authority)`.
- Add `"membership.cancellation.view"` to `globalActions`. Rule: `hasPeopleAdminGrant(authority) || isLegalOfficer(authority) || isDepartmentHead(authority)`.
- Add `"tasks.view_any"` to `globalActions`. Rule: `hasAdminGrant(authority) || hasPeopleAdminGrant(authority) || isLegalOfficer(authority) || isDepartmentHead(authority)`.

**All callers of the renamed actions** must be updated in the same unit:
- `src/app/(authenticated)/(app)/(default)/people/resolutions/[id]/vote-action.ts` — `can("membership.resolution.vote")` → `can("membership.resolution.admission.vote")`
- `src/app/(authenticated)/(app)/(default)/people/resolutions/[id]/page.tsx` — any `can("membership.resolution.view")` refs
- `src/components/nav-main.tsx` — any resolution permission check (if present)

**Test scenarios (permissions.test.ts):**
- `membership.resolution.admission.vote`: legalOfficer → true; admin (non-officer) → false; departmentHead → false; people_admin → false.
- `membership.resolution.admission.view`: admin → true; legalOfficer → true; departmentHead → true; people_admin → false.
- `membership.transition.view`: people_admin → true; legalOfficer → true; departmentHead (any dept) → true; admin (no officer/depthead) → true (admin has admin grant, covered); member without grant → false.

  Wait — admin does NOT get `membership.transition.view` directly. Looking at the requirements: "people_admin; also implied by membership.transition.decide (legalOfficer, departmentHead)". Admin grant alone does not get this. Correct rule: `hasPeopleAdminGrant || isLegalOfficer || isDepartmentHead`.

  Revised: admin without officer/depthead position → false; people_admin → true; legalOfficer → true; departmentHead → true.

- `membership.cancellation.view`: same distribution as transition.view.
- `tasks.view_any`: admin → true; people_admin → true; legalOfficer → true; departmentHead (any) → true; plain member → false.

---

### U2 — DB query layer

**Files:**
- `src/db/admin-tasks.ts` (new)

**`AdminTaskRow` type:**

```typescript
type AdminTaskRow =
  | { kind: "admission"; legalMembershipId: string; userId: string; userName: string; department: Department | null; startedAt: Date; deadline: Date; status: "open" | "completed"; completedStatus?: "admitted" | "cancelled" | "manual_followup" }
  | { kind: "alumni_request" | "supporting_alumni_request"; transitionRequestId: string; userId: string; userName: string; department: Department | null; requestedAt: Date; deadline: Date; status: "open" | "completed"; completedStatus?: "executed" | "retracted" | "expired" }
  | { kind: "cancellation"; transitionRequestId: string; userId: string; userName: string; department: Department | null; requestedAt: Date; deadline: Date; status: "open" | "completed"; completedStatus?: "executed" | "retracted" | "expired" };
```

**`getAdminTasksPage(authority, filters, pagination)`:**
- Takes `authority: UserAuthority`, `filters: { types?: TaskType[]; memberIds?: string[] }`, `pagination: { page: number; pageSize: number }`.
- Builds the visible task set by unioning the three sources, filtered to what `authority` can view per the permission rules.
- Admission rows: included if `can("membership.resolution.admission.view")` (checked from authority directly, not via `can()`).
- Transition rows: included if `hasPeopleAdminGrant || isLegalOfficer || isDepartmentHead`.
- Cancellation rows: same as transition (only `reason = 'resigned'` rows).
- Sorts: open rows first (oldest `createdAt`), then completed rows (oldest first within).
- Returns `{ rows: AdminTaskRow[]; total: number; pageCount: number }`.

**`getAllVisibleTaskMembers(authority)`:**
- Returns all distinct `{ id, name }` for subject users who have at least one visible task (any status, any type). Does not paginate — used only for filter dropdown population.

**Data sources:**
- Admission: `legalMembership` where `boardResolutionText IS NOT NULL`. Open = `status IN ('pending_board_approval')`. Completed = `status IN ('active', 'cancelled', 'manual_followup')`.
- Alumni/supporting: `membershipTransitionRequest` where `type IN ('alumni_request', 'supporting_alumni_request')`. Open = `status = 'pending'`. Completed = `status IN ('executed', 'retracted', 'expired')`.
- Cancellation: `membershipTransitionRequest` where `type = 'cancellation' AND reason = 'resigned'`. Open = `status = 'pending'`. Completed = `status IN ('executed', 'retracted', 'expired')`.

**Test scenarios:**
- Authority with only `people_admin` grant sees transition + cancellation rows, no admission rows.
- Authority as legalOfficer sees all three types.
- Authority as departmentHead(dept=A) sees all three types for dept A members (transition/cancellation scoped to dept; admission unscoped globally since view is unscoped).
- Pagination: page 2 with pageSize 5 returns rows 6–10.
- Filter by type `["admission"]`: only admission rows returned.
- Filter by memberId: only rows for that member returned.
- `getAllVisibleTaskMembers` returns members across all pages regardless of page param.

---

### U3 — New server actions

**Files:**
- `src/app/(authenticated)/(app)/(default)/admin/tasks/approve-alumni/[userId]/approve-alumni-action.ts` (new)
- `src/app/(authenticated)/(app)/(default)/admin/tasks/acknowledge-cancellation/[userId]/acknowledge-cancellation-action.ts` (new)

**`approveAlumniAction`:**
- Input schema: `{ transitionRequestId: string; decision: "approved" | "rejected" }`.
- Fetches `membershipTransitionRequest` to get subject user's department.
- Rechecks `can("membership.transition.decide", { department })` inside action; throws if false.
- Fires `inngest.send({ name: "membership/transition.decided", data: { transitionRequestId, decision, decidedByUserId: currentUser.id } })`.
- Writes audit log entry.

**`acknowledgeCancellationAction`:**
- Input schema: `{ transitionRequestId: string }`.
- Fetches `membershipTransitionRequest` to get subject user's department; verifies `reason = 'resigned'`.
- Rechecks `can("membership.cancellation.acknowledge", { department })` inside action; throws if false.
- Fires `inngest.send({ name: "membership/cancellation.acknowledged", data: { transitionRequestId, acknowledgedByUserId: currentUser.id } })`.
- Writes audit log entry.

**Test scenarios:**
- `approveAlumniAction`: caller with `membership.transition.decide` for subject's dept → fires event; caller from different dept → returns forbidden.
- `acknowledgeCancellationAction`: caller with `membership.cancellation.acknowledge` for subject's dept → fires event; `reason = 'removed_by_board'` record → throws (guard).

---

### U4 — Tasks layout + index page + loading skeleton

**Files:**
- `src/app/(authenticated)/(app)/(default)/admin/tasks/layout.tsx` (new)
- `src/app/(authenticated)/(app)/(default)/admin/tasks/page.tsx` (new)
- `src/app/(authenticated)/(app)/(default)/admin/tasks/tasks-table-client.tsx` (new)
- `src/app/(authenticated)/(app)/(default)/admin/tasks/loading.tsx` (new)

**`layout.tsx`:** Server component. Calls `can("tasks.view_any")`; redirects to `/membership` if false. Renders `{children}`.

**`page.tsx`:** Server component.
- Reads nuqs params server-side via `createSearchParamsCache`: `page` (int, default 1), `types` (array of TaskType), `memberIds` (array of string).
- Loads authority, calls `getAdminTasksPage(authority, filters, { page, pageSize: 20 })` and `getAllVisibleTaskMembers(authority)` in parallel.
- Passes data to `<TasksTableClient>`.

**`tasks-table-client.tsx`:** Client component.
- nuqs `useQueryState` for `page`, `types`, `memberIds`.
- Renders filter bar (Type multi-select, Member multi-select) + table + pagination controls.
- Type filter options: only shows types the current user can view (derived from permission props passed from server).
- Member filter options: always `allVisibleMembers` regardless of current page/filters.
- Table columns: Type | Member | Submitted | Deadline | Status | Action.
- Deadline cell: absolute date string; `text-destructive` class when past.
- Action cell: first open+actionable row → `variant="default"` button; all others → `variant="outline"`. Completed rows → `variant="outline"` "View" button.
- Action labels: admission → "Vote"; alumni/supporting-alumni → "Approve / Reject"; cancellation → "Acknowledge".
- Read-only users (view permission only, no action permission) → "View" button on open tasks too.

**`loading.tsx`:** Fixed-height table skeleton matching the loaded page structure (per CLAUDE.md skeleton sync rule).

**Test scenarios:**
- Layout redirects to `/membership` when `tasks.view_any` is false.
- Type filter options shown match user's view permissions (people_admin sees transition + cancellation types only; admin sees all three).
- Member filter always shows full list regardless of page param.
- First open+actionable row gets primary button; second gets outline.
- Past deadline renders with destructive style.

---

### U5 — Vote-admission detail page (move from /people/resolutions)

**Files:**
- Move `src/app/(authenticated)/(app)/(default)/people/resolutions/[id]/` → `src/app/(authenticated)/(app)/(default)/admin/tasks/vote-admission/[legalMembershipId]/`
  - `page.tsx`, `resolution-vote-client.tsx`, `vote-action.ts` all move as-is
- `src/app/(authenticated)/(app)/(default)/admin/tasks/vote-admission/[legalMembershipId]/loading.tsx` (new or moved)

**Changes inside moved files:**
- `page.tsx`: gate on `can("membership.resolution.admission.view")` (renamed); redirect to `/membership` if false. Route param name changes from `id` to `legalMembershipId`.
- `resolution-vote-client.tsx`: update success redirect from `/people?view=actions` to `/admin/tasks`.
- `vote-action.ts`: rename permission string `"membership.resolution.vote"` → `"membership.resolution.admission.vote"`.

**Old `/people/resolutions/[id]/page.tsx`:** Becomes a simple redirect to `/admin/tasks/vote-admission/${params.id}`. Keep the file; it renders nothing, just `redirect()`.

**Test scenarios:**
- User with `membership.resolution.admission.view` (admin, legalOfficer, departmentHead) → page renders.
- people_admin → redirected (no admission view permission).
- Participant who hasn't voted → vote form visible.
- Participant who voted / non-participant → read-only.
- `/people/resolutions/[id]` → redirects to new route.

---

### U6 — Approve-alumni detail page

**Files:**
- `src/app/(authenticated)/(app)/(default)/admin/tasks/approve-alumni/[userId]/page.tsx` (new)
- `src/app/(authenticated)/(app)/(default)/admin/tasks/approve-alumni/[userId]/approve-alumni-client.tsx` (new)
- `src/app/(authenticated)/(app)/(default)/admin/tasks/approve-alumni/[userId]/loading.tsx` (new)

**`page.tsx`:** Server component.
- Fetches subject user + their active `membershipTransitionRequest` of type `alumni_request` or `supporting_alumni_request`.
- Returns 404 if no matching request exists.
- Checks `can("membership.transition.view", { department })` for at-least-view access; redirect `/membership` if false.
- Determines if actor can act: `can("membership.transition.decide", { department })`.
- Passes `{ request, subjectUser, canAct }` to `<ApproveAlumniClient>`.

**`approve-alumni-client.tsx`:** Client component.
- Shows subject name, transition type, submitted date, reason (if provided).
- If `request.type === "alumni_request"` and `canAct`:
  - Step 1: Consequences panel (destructive red border/bg, CircleXIcon items: "membership ends", "Google account suspended then deleted after 7 days", "all START Berlin access revoked"). Approve (destructive) + Reject buttons. Reject fires immediately (no step 2).
  - Step 2: Two checkboxes ("I understand this action is irreversible", "I have confirmed this with the member") + Confirm (destructive, disabled until both checked).
- If `request.type === "supporting_alumni_request"` and `canAct`: single-step. Approve / Reject buttons.
- If `!canAct` or task completed: read-only view of request details + outcome (if decided).
- Both paths use `approveAlumniAction`.

**Test scenarios:**
- alumni_request + canAct → two-step flow renders; Confirm button disabled until both checkboxes checked.
- alumni_request + !canAct → read-only, no buttons.
- supporting_alumni_request + canAct → single-step renders.
- Completed request → outcome (decided by, when, decision) shown; no action buttons regardless of permission.
- Missing/expired request → 404.

---

### U7 — Acknowledge-cancellation detail page

**Files:**
- `src/app/(authenticated)/(app)/(default)/admin/tasks/acknowledge-cancellation/[userId]/page.tsx` (new)
- `src/app/(authenticated)/(app)/(default)/admin/tasks/acknowledge-cancellation/[userId]/acknowledge-cancellation-client.tsx` (new)
- `src/app/(authenticated)/(app)/(default)/admin/tasks/acknowledge-cancellation/[userId]/loading.tsx` (new)

**`page.tsx`:** Server component.
- Fetches subject user + active `membershipTransitionRequest` where `type = 'cancellation' AND reason = 'resigned'`.
- Returns 404 if no matching request (board-initiated cancellations are excluded by the reason filter).
- Checks `can("membership.cancellation.view", { department })`; redirect if false.
- Determines `canAct: can("membership.cancellation.acknowledge", { department })`.
- Passes `{ request, subjectUser, canAct }` to `<AcknowledgeCancellationClient>`.

**`acknowledge-cancellation-client.tsx`:** Client component.
- Shows subject name, submitted date, reason text (if any).
- If `canAct` and status open: single "Acknowledge" button. Uses `acknowledgeCancellationAction`. No reject path.
- If `!canAct` or completed: read-only. Shows acknowledged-by and when if completed.

**Test scenarios:**
- Open request + canAct → Acknowledge button shown.
- Open request + !canAct → read-only panel, no button.
- Completed request → acknowledged-by shown, no button regardless of canAct.
- `reason = 'removed_by_board'` → 404 (excluded by query filter).

---

### U8 — Nav, redirect, email links, people-table, schema comments

**Files:**
- `src/components/nav-main.tsx`
- `src/app/(authenticated)/(app)/(default)/people/resolutions/[id]/page.tsx`
- `src/inngest/membership-admission-workflow.ts`
- `src/inngest/membership-transition-workflow.ts`
- `src/inngest/membership-cancellation-workflow.ts`
- `src/db/people-actions.ts`
- `src/db/schema/legal-membership.ts`
- `src/db/schema/membership-transition-request.ts`

**Nav (`nav-main.tsx`):**
- Add flat `SidebarMenuItem` for Tasks between People collapsible group and Groups, inside the Admin `HidableSidebarGroup`.
- Wrap in `<Can action="tasks.view_any">` so the item auto-hides when the user has no task visibility.
- Icon: `ListTodoIcon` (Lucide). Label: "Tasks". Href: `/admin/tasks`.

**Redirect (`/people/resolutions/[id]/page.tsx`):**
- Replace page content with `redirect(\`/admin/tasks/vote-admission/${params.id}\`)`.

**Email links:**
- `membership-admission-workflow.ts`: `resolutionUrl` → `${env.NEXT_PUBLIC_COCKPIT_URL}/admin/tasks/vote-admission/${legalMembershipId}`
- `membership-transition-workflow.ts`: `profileUrl` → `${env.NEXT_PUBLIC_COCKPIT_URL}/admin/tasks/approve-alumni/${userId}`
- `membership-cancellation-workflow.ts`: `profileUrl` → `${env.NEXT_PUBLIC_COCKPIT_URL}/admin/tasks/acknowledge-cancellation/${userId}`

**People-table vote button (`src/db/people-actions.ts`):**
- Update vote button href in `PendingBoardAction` result from `/people/resolutions/${legalMembershipId}` to `/admin/tasks/vote-admission/${legalMembershipId}`.

**Schema comments:**
- `src/db/schema/legal-membership.ts`: add comment on table definition — records must never be deleted; onDelete "no action" is intentional.
- `src/db/schema/membership-transition-request.ts`: same.

**Test scenarios (manual):**
- Tasks nav item visible for admin, people_admin, legalOfficer, departmentHead; hidden for plain member.
- Navigating to `/people/resolutions/[id]` redirects to `/admin/tasks/vote-admission/[id]`.
- Email-rendered URLs in all three workflows point to new routes.

---

## Sequencing

1. **U1** first — all subsequent units depend on the renamed/new permission strings compiling.
2. **U2** next — DB query layer needed by U4 page.tsx.
3. **U3** next — server actions needed by U6 and U7 client components.
4. **U5, U6, U7** can proceed in parallel once U1–U3 are done.
5. **U4** after U2 (and conceptually after U5/U6/U7 so their routes exist to link to, though not a hard code dependency).
6. **U8** last — nav item links to `/admin/tasks` (needs U4), redirect references U5's route, email links are standalone string changes.

---

## Risks and Mitigations

- **`evaluateAuth` status guard**: `evaluateAuth` short-circuits false if user status is not in `["member", "supporting_alumni"]`. Board members and legalOfficers are active members so this is fine — but verify no case where an admin user with a non-standard status can't vote. (Low risk; existing voting already works.)
- **`decidedByUserId` null**: `onDelete: "set null"` on the FK. Detail page UI must handle null gracefully (show "Unknown" or omit the "decided by" line).
- **JSONB board vote query performance**: existing `@>` containment operator query in `getPendingBoardActionsForUser` already works. The new admin-tasks query extends the same pattern for the admission task list. No new index required.
- **Inngest event name exact strings**: `transitionDecided` and `cancellationAcknowledged` — verify exact event name strings against the workflow `waitForEvent` calls before wiring the new actions.
