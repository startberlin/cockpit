---
title: "fix: People table filter UX — links, back navigation, multi-select filters"
type: fix
status: active
date: 2026-05-31
---

# fix: People table filter UX — links, back navigation, multi-select filters

## Summary

Fix three related UX problems in the admin people table: convert table rows from JavaScript-only navigation to proper `<Link>` elements so right-click / middle-click works; replace the static "Back to members" link on the member detail page with `router.back()` so active filters survive the detail → list transition; and convert the Status and Legal Membership filters from single-select to multi-select to match the pattern already used by Batch and Department.

---

## Problem Frame

The admin people table has three compounding UX problems that make it frustrating to work through a filtered list. Rows use `router.push()` inside an `onClick` rather than an `<a>` element, so there is no browser affordance for opening multiple members in parallel tabs. The "Back to members" button on the detail page is a static `<Link href="/admin/people">` that discards all active URL query params, so returning from a filtered list always resets the view. And the Status and Legal Membership filters use a single-select `FilterDropdown` while Batch and Department already use the multi-select `FilterMenu` — the inconsistency is visible and the single-select behaviour is limiting.

---

## Requirements

- R1. Clicking a member row in the admin people table navigates to the detail page; the name cell renders a real `<a>` element so the browser exposes right-click / middle-click / Ctrl+Click affordances.
- R2. The "Back to members" button on `/admin/people/[id]` uses `router.back()` so the previous URL (including all active filter params) is restored.
- R3. The Status filter on the admin people listing accepts multiple selected values simultaneously.
- R4. The Legal Membership filter on the admin people listing accepts multiple selected values simultaneously.
- R5. The `canViewInactive` permission gate continues to control which status options are visible; the Alumni and Cancelled / Former options are only shown to viewers who hold `users.view_inactive`.
- R6. Multi-selected Legal Membership values are passed to the database query and filter results correctly.

---

## Scope Boundaries

- `src/components/groups-table.tsx` uses `window.location.href` on rows (same link bug) — out of scope for this fix, noted for follow-up.
- `src/app/(authenticated)/(app)/(default)/admin/people/[id]/remove/page-client.tsx` navigates to `/admin/people` after a successful board-kick action — intentionally kept as-is since returning to a clean list is appropriate UX after a destructive action.
- Department and Batch filters — already multi-select, no changes needed.
- Public `/people` directory — no per-member navigation, out of scope.

### Deferred to Follow-Up Work

- `groups-table.tsx` row link fix: separate small PR.

---

## Context & Research

### Relevant Code and Patterns

- `src/components/people-table.tsx` — row navigation via `router.push()` at line 298; name cell at lines 107–125.
- `src/app/(authenticated)/(app)/(default)/admin/groups/page-client.tsx` — reference pattern: `<Link href={g.href}>` in the name cell only; no full-row onClick.
- `src/app/(authenticated)/(app)/(default)/admin/people/[id]/page.tsx` — "Back to members" static link at lines 119–124; secondary empty-state link at lines 89–91.
- `src/app/(authenticated)/(app)/(default)/admin/people/page-client.tsx` — `FilterDropdown` for Status (lines 413–421) and Legal Membership (lines 422–430); `FilterMenu` for Department and Batch (already multi-select reference).
- `src/app/(authenticated)/(app)/(default)/admin/people/page.tsx` — Status parsing already handles comma-separated values (split + enum validation, lines 89–103); Legal Membership only handles a single value (line 123–127), needs updating.
- `src/db/people.ts` — `getAllUsersForAdmin` accepts `legalMembershipState?: LegalMembershipState` (single value) at line 241 using `eq(...)` at line 264.
- `src/app/(authenticated)/(app)/(default)/people/page-client.tsx` — reference pattern for multi-select Status filter using `FilterMenu` + `parseAsArrayOf(statusParser)`.

### Institutional Learnings

- Nuqs is the only approved mechanism for URL query state. All new filter params must use `useQueryState` with a typed parser and `shallow: false` when changes must trigger a server re-fetch (`docs/solutions/conventions/pagination-server-pagecount-pattern-2026-05-18.md`).
- Constants derived from `@/db/*` must not be imported into client components; pass valid option lists as props from the server component.

---

## Key Technical Decisions

- **`router.back()` for the back button, no `returnTo` URL encoding**: All filter state is already in the URL. When a user navigates from the list to the detail via a `<Link>`, the browser history entry contains the full filter URL. `router.back()` restores it for free. Encoding a `returnTo` param would add complexity without benefit for the common path.
- **Name cell gets the `<Link>`, not the full row**: Making a full table row a single `<a>` element is invalid HTML and conflicts with the actions column (dropdown menu). The name cell link is the browser-native affordance for right-click; the full-row `onClick` stays for click-anywhere convenience. This mirrors the groups table pattern.
- **Status options become individual values, not presets**: The `ALWAYS_VISIBLE_PRESETS` / `INACTIVE_PRESETS` approach (where "Active" maps to the opaque string `"member,supporting_alumni"`) does not compose with multi-select. Individual status checkboxes are simpler and consistent with the public people directory. The server-side `.split(",")` parsing already handles this without changes.
- **Legal Membership parsing upgraded in both server and DB layer**: The server currently does a single `has()` check which silently no-ops on comma-separated input. Both `page.tsx` and `getAllUsersForAdmin` need updating to handle an array and use `inArray(...)`.
- **Status and Legal Membership parsers defined locally in admin page-client**: No shared `search-params.ts` exists for the admin section. Defining parsers inline avoids premature abstraction; can be extracted to a shared file if a third admin filter needs the same pattern.

---

## Open Questions

### Resolved During Planning

- **Does Status server parsing need changes?** No — it already splits on commas and validates each value individually. Switching the client to `parseAsArrayOf` (which serialises as comma-separated) is transparent to the server.
- **Does the `remove/page-client.tsx` back navigation need fixing?** No — navigating to a clean `/admin/people` after a destructive remove action is appropriate and intentional.

### Deferred to Implementation

- Whether `router.back()` should have a "no history" fallback (e.g., checking `window.history.length`). In practice, the detail page is almost always reached from the list; direct-URL arrival is rare and `router.back()` failing gracefully (going to the previous browser page) is acceptable.

---

## Implementation Units

### U1. Fix "Back to members" back-navigation on member detail page

**Goal:** Replace the static "Back to members" `<Link>` with a `router.back()` call so the browser restores the full previous URL — including active filter params.

**Requirements:** R2

**Dependencies:** None

**Files:**
- Create: `src/app/(authenticated)/(app)/(default)/admin/people/[id]/back-button.tsx`
- Modify: `src/app/(authenticated)/(app)/(default)/admin/people/[id]/page.tsx`

**Approach:**
- Extract a small `BackButton` client component (`"use client"`) that calls `useRouter().back()` on click. Render it with the same visual appearance as the current ghost button + ArrowLeft icon.
- Replace both occurrences in `page.tsx` (primary button at lines 119–124 and empty-state button at lines 89–91) with `<BackButton />`.
- The component needs no props; the label text can be passed as `children` if the two call sites have different labels.

**Patterns to follow:**
- `src/app/(authenticated)/(app)/(default)/admin/people/[id]/remove/page-client.tsx` — example of a client component in the same route segment that uses `useRouter`.

**Test scenarios:**
- Happy path: navigate from `/admin/people?batchNumber=1&department=engineering` → detail page → click "Back to members" → lands back on `/admin/people?batchNumber=1&department=engineering` with filters visible.
- Edge case: open detail page URL directly in a new tab → click "Back to members" → `router.back()` navigates to previous browser history entry (acceptable; no crash).
- Happy path: the empty-state button ("Back to people") in the permission-denied branch also calls `router.back()`.

**Verification:**
- Filter state visible in the list URL is fully restored after the Back button click.
- The button renders identically to the current ghost + ArrowLeft style.

---

### U2. Convert `PeopleTable` name cell to a proper link

**Goal:** Render the member name in the admin people table as an `<a>` element so the browser exposes right-click → "Open in new tab", middle-click, and Ctrl+Click affordances.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/components/people-table.tsx`

**Approach:**
- In the `name` column cell definition (lines 107–125), wrap the avatar + name content in a `<Link href={`/admin/people/${row.original.id}`}>` — but only when `canOpenProfile` is true. When false, render a plain `<div>` as today.
- Keep the full-row `onClick` for click-anywhere convenience, but only as a fallback for non-name-cell clicks. The `actions` column already calls `e.stopPropagation()`, so that interaction is unaffected.
- Remove `useRouter` import if it becomes unused after this change.

**Patterns to follow:**
- `src/app/(authenticated)/(app)/(default)/admin/groups/page-client.tsx` name cell: `<Link href={g.href} className="hover:underline">`.

**Test scenarios:**
- Happy path: right-clicking the name cell shows "Open link in new tab" in the browser context menu.
- Happy path: Ctrl+Click on the name cell opens the detail page in a new tab.
- Happy path: clicking anywhere on the row (outside the name cell) still navigates to the detail page via the existing `onClick`.
- Edge case: a row where `canOpenProfile` is false — name cell renders as plain text with no link; row has no `onClick` and no cursor-pointer styling.
- Happy path: the actions column dropdown (copy email) continues to work without triggering row navigation.

**Verification:**
- Right-clicking the name cell in a browser shows native link context menu options.
- Clicking outside the name cell still navigates.
- No TypeScript errors; `useRouter` import removed if it becomes unused.

---

### U3. Convert Status filter to multi-select

**Goal:** Replace the single-select preset `FilterDropdown` for Status with a multi-select `FilterMenu` that accepts any combination of individual status values.

**Requirements:** R3, R5

**Dependencies:** None

**Files:**
- Modify: `src/app/(authenticated)/(app)/(default)/admin/people/page-client.tsx`

**Approach:**
- Remove `ALWAYS_VISIBLE_PRESETS`, `INACTIVE_PRESETS`, and the `FilterPreset` interface (lines 50–63). Remove the derived `presets` variable (lines 327–329).
- Define two constants: `ALWAYS_VISIBLE_STATUS_OPTIONS` (Onboarding, Member, Supporting Alumni) and `INACTIVE_STATUS_OPTIONS` (Alumni, Cancelled / Former). Derive the active option list from `canViewInactive` in the component body.
- Define a local `statusParser` using `parseAsStringEnum` or `parseAsStringLiteral` over `userStatus.enumValues` (needs the runtime enum import, not just the type).
- Change the `status` `useQueryState` call from `parseAsString` to `parseAsArrayOf(statusParser)`.
- Change `value={status ?? ""}` / `onChange` wiring from `FilterDropdown` to `FilterMenu` with `selected={activeStatus}` / `onChange={handleStatusChange}` — matching the Batch/Department pattern already in the same file.
- Update `handleReset` to set `status` to `null` (array) rather than an empty string.
- Server-side `page.tsx` requires **no changes** — it already splits on commas and validates each status value individually.

**Patterns to follow:**
- `src/app/(authenticated)/(app)/(default)/people/page-client.tsx` — `handleStatusChange`, `STATUS_OPTIONS`, `FilterMenu` wiring.
- Existing `handleDepartmentChange` / `handleBatchChange` in `admin/people/page-client.tsx` — same multi-select pattern already in the file.

**Test scenarios:**
- Happy path: selecting "Member" and "Alumni" simultaneously sets `?status=member%2Calumni` in the URL and the table shows only those two statuses.
- Happy path: a viewer without `users.view_inactive` sees only the three active status options; Alumni and Cancelled / Former options are absent from the dropdown.
- Happy path: a viewer with `users.view_inactive` sees all five options.
- Edge case: no status selected — table defaults to active statuses (server default behaviour unchanged).
- Happy path: Reset button clears all status selections.
- Happy path: URL param `?status=member,alumni` is pre-populated when the page loads, checkboxes reflect the state, and the table shows the right results.

**Verification:**
- Multiple status values can be checked simultaneously in the dropdown.
- The URL updates correctly for each combination.
- The `canViewInactive` gate is respected.

---

### U4. Convert Legal Membership filter to multi-select

**Goal:** Replace the single-select `FilterDropdown` for Legal Membership with a multi-select `FilterMenu`, and update the server-side parsing and DB query to handle an array of values.

**Requirements:** R4, R6

**Dependencies:** None

**Files:**
- Modify: `src/app/(authenticated)/(app)/(default)/admin/people/page-client.tsx`
- Modify: `src/app/(authenticated)/(app)/(default)/admin/people/page.tsx`
- Modify: `src/db/people.ts`

**Approach:**

*Client (`page-client.tsx`):*
- Define a local `legalMembershipParser` using `parseAsStringEnum` or `parseAsStringLiteral` over `legalMembershipState.enumValues` (needs the runtime enum import added alongside the existing type import).
- Change the `legalMembership` `useQueryState` call from `parseAsString` to `parseAsArrayOf(legalMembershipParser)`.
- Switch the `FilterDropdown` to `FilterMenu` with `selected` / `onChange` wiring matching the Batch/Department pattern.
- Update `handleReset` accordingly.

*Server (`page.tsx`):*
- Update the `legalMembership` parsing block (lines 123–127) from a single `has()` check to the same split-validate-array pattern already used for `status`: split on commas, filter valid enum values, pass as `LegalMembershipState[]`.
- Update `searchParams` type declaration to match the existing `string` shape (nuqs still serialises as a comma-separated string from the URL).

*DB query (`src/db/people.ts`):*
- Change the `legalMembershipState` parameter on `getAllUsersForAdmin` from `LegalMembershipState` to `LegalMembershipState[]`.
- Replace `eq(userTable.legalMembershipState, legalMembershipState)` with `inArray(userTable.legalMembershipState, legalMembershipState)`.

**Patterns to follow:**
- `src/db/people.ts` — existing `inArray` usage pattern for other multi-value filters in the same function.
- Batch and Department parsing in `admin/people/page.tsx` — same split-and-filter server pattern.

**Test scenarios:**
- Happy path: selecting "Active member" and "Former member" simultaneously filters the table to show only those two legal membership states.
- Happy path: selecting a single value behaves identically to the old single-select.
- Edge case: no legal membership selected — table shows all legal membership states (no filter applied).
- Error path: a malformed URL param (`?legalMembership=notvalid`) is silently ignored; the filter is treated as unset.
- Happy path: Reset button clears the legal membership selection.
- Integration: the multi-value `inArray` query returns the correct DB rows when two legal membership states are selected.

**Verification:**
- Multiple legal membership values can be checked simultaneously.
- The DB query uses `inArray` and returns results matching any of the selected values.
- TypeScript types for `getAllUsersForAdmin` parameter and return are correct with no `any` casts.

---

## System-Wide Impact

- **Interaction graph:** `getAllUsersForAdmin` signature change in `src/db/people.ts` affects only `admin/people/page.tsx` (the sole caller). Verify no other callers exist before changing the param type.
- **Error propagation:** Invalid multi-value URL params (e.g., non-enum strings) are sanitised server-side by the split + `has()` filter pattern; they degrade gracefully to "no filter applied".
- **Unchanged invariants:** The `canViewInactive` server-side status filter (lines 94–103 in `page.tsx`) continues to strip inactive statuses from the response for viewers without the permission, regardless of what the client sends. The URL-state-first filter pattern (nuqs) is unchanged.
- **API surface parity:** None of these changes affect the Inngest workflows, email system, or any non-people page.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `router.back()` with no prior in-app history navigates outside the app | Acceptable for the back button use case; document as known limitation. If jarring in practice, a `window.history.length` heuristic can be added post-ship. |
| `getAllUsersForAdmin` has undiscovered callers that break with the array param change | Verify with a grep for `getAllUsersForAdmin` before implementing U4; there is currently only one known caller. |
| nuqs comma serialisation interacting with URL-decoding edge cases | Same serialisation already works for Batch and Department; no new risk introduced. |

---

## Sources & References

- Related code: `src/components/people-table.tsx`, `src/app/(authenticated)/(app)/(default)/admin/people/`
- Reference pattern: `src/app/(authenticated)/(app)/(default)/admin/groups/page-client.tsx` (link pattern), `src/app/(authenticated)/(app)/(default)/people/page-client.tsx` (multi-select status pattern)
- Institutional learning: `docs/solutions/conventions/pagination-server-pagecount-pattern-2026-05-18.md`
