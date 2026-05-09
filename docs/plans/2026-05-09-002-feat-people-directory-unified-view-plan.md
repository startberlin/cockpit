---
title: "feat: Unified People Directory with Inline Action Indicators"
type: feat
status: completed
date: 2026-05-09
origin: docs/brainstorms/2026-05-09-people-directory-unified-view-requirements.md
---

# feat: Unified People Directory with Inline Action Indicators

## Summary

Replace the two-tab People page layout with a single directory view. Users with pending board votes are sorted to the top of the table with an inline Vote button and a visual separator; all other users see a plain directory with no action chrome.

---

## Requirements

- R1. The tab bar (Action required / Directory) is removed entirely.
- R2. The People page renders a single view: the full member directory table.
- R3. If the current user has pending board votes, the subjects of those votes are sorted to the top of the directory.
- R4. A visual separator distinguishes the "vote needed" group from the rest.
- R5. Each vote-needed row displays an inline Vote button linking to the board resolution page.
- R6. The pending-action badge/count is removed along with the tab.
- R7. When the current user has zero pending board votes, the directory renders with no action chrome.
- R8. The "You're all caught up" empty-state message is removed.

**Origin acceptance examples:** AE1 (covers R3, R4, R5), AE2 (covers R7, R8), AE3 (covers R7, R8)

---

## Scope Boundaries

- No nav-level badge or notification count outside the People page.
- No changes to data fetching logic or the `getPendingBoardActionsForUser` query.
- No changes to the board resolution voting page (`/people/resolutions/[id]`).
- No filtering or search scoped to the vote-needed group.

---

## Context & Research

### Relevant Code and Patterns

- `src/app/(authenticated)/(app)/people/page-client.tsx` — current tab implementation; `ActionRequiredList` component and `useQueryState` hook both live here
- `src/app/(authenticated)/(app)/people/page.tsx` — server component that fetches and passes `pendingActions` and `hasPendingActions` props
- `src/components/people-table.tsx` — TanStack Table implementation; columns currently defined as a module-level constant; `ProposeMembershipMenuItem` is a child component defined in the same file
- `src/db/people-actions.ts` — `PendingBoardAction` interface (fields: `legalMembershipId`, `subjectUserId`, `subjectName`, `subjectOperationalStatus`, `resolutionId`)
- `src/db/people.ts` — `PublicUser` interface (fields include `id`)

### Institutional Learnings

- No relevant entries in `docs/solutions/` for this area.

---

## Key Technical Decisions

- **Vote button in the existing `actions` column, not a new column:** adding a column for Vote-only users would shift the layout for all rows; rendering it conditionally in the existing actions cell keeps the column count stable.
- **Pre-sort data before TanStack Table via `useMemo`:** TanStack's built-in sort API is user-controlled. Pre-sorting the input array ensures "pending first" is a stable invariant that survives column-header sort interactions.
- **`columns` moves into `useMemo` inside the component:** the Vote button cell needs access to the pending-actions map (a derived value). Closing over it in a `useMemo` is idiomatic TanStack Table; no context or ref needed.
- **Separator as a full-width table row:** a `<TableRow>` with a single `<TableCell colSpan={columns.length}>` renders a divider that aligns with the table border without breaking the `<table>` DOM structure. It is inserted after the last pending-user row in the current page view.
- **`hasPendingActions` prop removed entirely:** `pendingActions.length > 0` is the authoritative signal; the boolean prop is redundant and removed at both ends (server and client).

---

## Open Questions

### Resolved During Planning

- *Does pre-sorting conflict with TanStack's sort?* No — TanStack sorts within the provided `data` array. Pre-sorting sets the initial order; user-triggered column sorts will re-order within the sorted data. Pending users may move away from the top if the user sorts by name descending, but the separator is computed from the live row model so it follows correctly. This is acceptable; the primary use case is the default (unsorted) view.

### Deferred to Implementation

- *Exact Tailwind classes for the separator row:* a thin `bg-border` divider or a row with `border-t` is both viable; pick whichever renders most consistently with the existing table border style.

---

## Implementation Units

### U1. Remove tab layout from page-client and page

**Goal:** Strip out the tab bar, `ActionRequiredList`, and related state. Pass `pendingActions` directly into `PeopleTable`. Remove `hasPendingActions` from both the server component and the client props interface.

**Requirements:** R1, R2, R6, R7, R8

**Dependencies:** None

**Files:**
- Modify: `src/app/(authenticated)/(app)/people/page-client.tsx`
- Modify: `src/app/(authenticated)/(app)/people/page.tsx`

**Approach:**
- In `page-client.tsx`:
  - Remove `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` imports and all usage
  - Remove `useQueryState`, `parseAsStringLiteral` imports (from `nuqs`)
  - Remove `hasPendingActions` from `PeoplePageClientProps`
  - Remove the `view` / `setView` state
  - Remove the `ActionRequiredList` component definition entirely
  - Remove the `userStatusLabel` helper (was only used by `ActionRequiredList`)
  - Pass `pendingActions` as a prop to `PeopleTable` (the interface extension happens in U2)
  - The component body becomes a flat render of `PeopleTable` + the two dialogs
- In `page.tsx`:
  - Remove the `hasPendingActions={pendingActions.length > 0}` prop

**Test scenarios:**
- Test expectation: none — pure UI restructuring of a client component; no business logic to unit-test. Verify visually: the page renders without tabs for all user roles.

**Verification:**
- No `<Tabs>`, `<TabsList>`, `<TabsTrigger>`, or `<TabsContent>` elements remain in `page-client.tsx`
- `nuqs` import is gone
- TypeScript compiles without errors
- The page renders a single directory view in the browser

---

### U2. Extend PeopleTable with pending action sorting, separator, and Vote button

**Goal:** Accept `pendingActions` in `PeopleTable`, pre-sort pending subjects to the top, render a visual separator between the pending group and the rest, and show an inline Vote button in the actions column for each pending row.

**Requirements:** R3, R4, R5, R7

**Dependencies:** U1

**Files:**
- Modify: `src/components/people-table.tsx`

**Approach:**

1. **Props:** Add `pendingActions?: PendingBoardAction[]` to `PeopleTableProps`. Import `PendingBoardAction` from `@/db/people-actions` and `Link` from `next/link`.

2. **Pending map:** Inside the component, derive a `pendingActionsMap: Map<string, PendingBoardAction>` keyed by `subjectUserId`. Use `useMemo` on `pendingActions`.

3. **Pre-sort:** Derive `sortedData` via `useMemo` — pending subjects first, all other users after. Pass `sortedData` to `useReactTable` instead of `data`.

4. **Columns:** Move the module-level `columns` constant into a `useMemo` inside the component so the cell renderers can close over `pendingActionsMap`. The `actions` column cell conditionally renders a Vote `<Button asChild>` / `<Link>` before the existing dropdown when `pendingActionsMap.has(user.id)`. Stop-propagation on the Vote button cell is already handled by the existing `actions` column click guard.

5. **Separator row:** After computing `table.getRowModel().rows`, find `lastPendingIndex` — the index of the last row whose `original.id` appears in `pendingActionsMap`. If `lastPendingIndex >= 0` and the group does not span all visible rows, render a full-width `<TableRow>` with a single `<TableCell colSpan={columns.length}>` containing a divider element immediately after the row at `lastPendingIndex`.

**Patterns to follow:**
- Existing `cell: ({ row })` pattern in `people-table.tsx` for column cell renderers
- `<Button asChild size="sm"><Link href="...">Vote</Link></Button>` — matches the Vote button pattern used in `ActionRequiredList` in page-client.tsx (pre-removal)
- `e.stopPropagation()` on `TableCell` click for the actions column — already present, verify the Vote button tap area is covered by it

**Test scenarios:**
- Test expectation: none — React component with no extractable business logic; no component test infrastructure in this project. Verify the three acceptance examples manually in the running dev server:
  - AE1: Board member with 2 pending votes → those 2 users appear first with Vote buttons; separator follows; remaining members show no Vote buttons. Covers AE1.
  - AE2: Regular member (pendingActions=[]) → plain directory, no separator, no Vote buttons, no action messaging. Covers AE2.
  - AE3: Board member who voted on all open resolutions (pendingActions=[]) → same plain directory as AE2. Covers AE3.

**Verification:**
- TypeScript compiles without errors (`tsc --noEmit` or `npm run lint`)
- `pendingActions` prop defaults correctly when omitted (no runtime error)
- Search/filter still works across both groups
- Clicking a Vote button navigates to the correct resolution page
- Row click-to-profile navigation still works for non-Vote cells

---

## System-Wide Impact

- **Interaction graph:** No callbacks or middleware touched. The `useQueryState` removal eliminates the `?view=` URL query param — any bookmarks or links to `?view=actions` will no longer do anything meaningful (URL param silently ignored by the new layout).
- **Unchanged invariants:** Data fetching in `page.tsx` is unchanged; `pendingActions` continues to be fetched and passed through. The board resolution voting page is untouched.

---

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-09-people-directory-unified-view-requirements.md](docs/brainstorms/2026-05-09-people-directory-unified-view-requirements.md)
- Related code: `src/app/(authenticated)/(app)/people/page-client.tsx`, `src/components/people-table.tsx`
