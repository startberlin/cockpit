---
title: "feat: Restructure payments page into three-table layout with decline reasons"
type: feat
status: active
date: 2026-05-12
---

# feat: Restructure payments page into three-table layout with decline reasons

## Summary

Restructure the admin payments page from a single combined table into three distinct sections: an always-visible unpaginated proposed payments table, a paginated approved payments table, and a collapsible paginated declined payments section. Adds a required decline reason field that is stored in the database and surfaced in a dedicated declined-payment drawer. Pagination state for approved and declined is persisted in the URL via nuqs.

---

## Requirements

- R1. **Proposed table** — always visible, unpaginated, includes search filter, rows are clickable and open the existing proposed drawer (charge + decline buttons). Empty state shown when no proposals exist.
- R2. **Approved table** — shows all non-proposed, non-declined payments; paginated (page size 20) ordered by activation date descending; rows are NOT clickable. Pagination state lives in `page` URL param via nuqs with `shallow: false`.
- R3. **Declined section** — collapsible (collapsed by default), contains a paginated table (page size 20) with rows clickable to open a declined drawer. Pagination state lives in `dpage` URL param via nuqs.
- R4. **Decline action** — requires a non-empty reason string; stores it in a new `declineReason` column on the `membershipPayments` table.
- R5. **Proposed drawer addition** — adds a "Reason for declining" textarea; the Decline button is disabled until the textarea is non-empty; reason is passed to the decline action on submit.
- R6. **Declined drawer** — shows member info, membership year, amount, status, declined-on date, and the stored decline reason. No charge/decline buttons.
- R7. **Stat cards** — unchanged; aggregations remain as-is regardless of table restructure.
- R8. **Selected row SSR gating** — existing pattern retained: server determines `selectedRow` from `searchParams.selected` using only proposed and declined rows; approved rows are never selectable.

---

## Scope Boundaries

- Search filter retained for proposed table only; approved and declined tables have no search.
- GoCardless payment history streaming (Suspense + skeleton) retained for the proposed drawer only.
- No changes to the charge action.
- No batch operations.
- No `declinedAt` column; `updatedAt` is used as a proxy for "declined on" date in the drawer.

### Deferred to Follow-Up Work

- Search/filter for approved and declined tables: separate PR if needed.
- Stat cards redesign or additional aggregations: separate iteration.

---

## Context & Research

### Relevant Code and Patterns

- `src/app/(authenticated)/(app)/payments/page.tsx` — server component, reads `searchParams`, passes `selectedRow` + `gcHistoryPromise`; streaming pattern via unawaited promise
- `src/app/(authenticated)/(app)/payments/page-client.tsx` — client component with all UI logic, current stat cards + combined table + sheet
- `src/db/membership-payments.ts` — `getAllPaymentsForPage()` (to be replaced), `advancePaymentStatus()` with optional `extra` partial
- `src/db/schema/membership-payments.ts` — `membershipPayments` table, status enum (proposed, declined, pending, submitted, confirmed, paid_out, failed, cancelled, charged_back)
- `src/app/(authenticated)/(app)/payments/decline-action.ts` — decline action, currently no reason field
- `src/components/ui/pagination.tsx` — shadcn Pagination with `PaginationPrevious`, `PaginationNext`, `PaginationLink`
- `src/components/ui/collapsible.tsx` — shadcn Collapsible, CollapsibleTrigger, CollapsibleContent
- Design reference: `START Cockpit New Nav (2)/payments-page.jsx` — collapsible declined section pattern with count badge and "Audit trail" description

### Institutional Learnings

- Query state must go through nuqs, never raw `useSearchParams` or manual URL construction (CLAUDE.md convention)
- Migration workflow: edit schema → `db:generate` → `db:migrate`; never edit migration files manually

---

## Key Technical Decisions

- **"Approved" definition** — all statuses except `proposed` and `declined` (i.e., `pending`, `submitted`, `confirmed`, `paid_out`, `failed`, `cancelled`, `charged_back`). These are payments that have been sent to GoCardless.
- **Reason storage** — nullable `decline_reason text` column on `membership_payments`. Simplest approach; no separate audit log needed. Existing rows get `NULL` (no reason, no action required).
- **Two pagination URL params** — `page` (approved) and `dpage` (declined) so both tables paginate independently without resetting each other.
- **Pagination wiring** — `PaginationPrevious` / `PaginationNext` driven by nuqs setters (`onClick`) rather than `href` generation, keeping nuqs as single source of truth for URL state.
- **Drawer type routing** — server passes `selectedRow` with `status` field; client renders `ProposedDrawer` or `DeclinedDrawer` based on `selectedRow.status === "declined"`. No separate URL param needed.
- **GC history scope** — only fetched when `selectedRow` is non-null and `selectedRow.status !== "declined"` (proposed/pending etc.); declined rows skip the GC fetch entirely (`Promise.resolve([])`).

---

## Open Questions

### Resolved During Planning

- **Do approved rows ever open a drawer?** No — per R2 and R8, only proposed and declined rows are selectable.
- **Where does the reason input appear in the proposed drawer?** In the footer actions area, as a labeled textarea above the Charge/Decline buttons. Decline button is disabled when the field is empty.
- **How is "declined on" shown?** Using the `updatedAt` timestamp on the row; acceptable since a declined row's `updatedAt` reflects when it was declined.

### Deferred to Implementation

- Whether to remove or keep the now-unused `getAllPaymentsForPage()` export after verifying no other callers.
- Exact page size constant (20 recommended; implementer can adjust).
- Approved table ordering (`activationDate DESC` recommended; `createdAt DESC` is an alternative).

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

**Page layout (top → bottom):**

```
[ Stat cards (4 columns, unchanged) ]

[ Proposed payments ]
  Search input          {n} of {m} proposed
  ┌─────────────────────────────────────────┐
  │ Member │ Coverage │ Amount │ Status │ > │  ← clickable
  └─────────────────────────────────────────┘
  (empty state if no proposals)

[ Approved payments ]
  ┌─────────────────────────────────────────┐
  │ Member │ Coverage │ Amount │ Status     │  ← not clickable
  └─────────────────────────────────────────┘
  [ Prev ]  Page N of M  [ Next ]

[ ▶ Declined  (3 badge)    Audit trail — not re-proposed ]  ← collapsible trigger
  (collapsed by default; expands to reveal:)
  ┌──────────────────────────────────────────────────────┐
  │ Member │ Coverage │ Declined on │ Reason             │  ← clickable
  └──────────────────────────────────────────────────────┘
  [ Prev ]  Page N of M  [ Next ]

[ Sheet (right): ProposedDrawer or DeclinedDrawer depending on selectedRow.status ]
```

**Server → client data flow:**

```
searchParams { selected, page, dpage }
     │
     ▼
page.tsx (RSC)
  ├─ getProposedPayments()              → proposed[]
  ├─ getApprovedPaymentsPage(page, 20)  → { rows, total }
  ├─ getDeclinedPaymentsPage(dpage, 20) → { rows, total }
  ├─ selectedRow = find in proposed ∪ declined by ?selected
  └─ gcHistoryPromise = selectedRow?.status !== "declined" ? fetch : resolve([])
     │
     ▼
page-client.tsx (client)
  nuqs: [page, setPage], [dpage, setDpage], [selectedId, setSelectedId]  (all shallow:false)
```

---

## Implementation Units

### U1. Add decline_reason column to schema

**Goal:** Add a nullable `declineReason` text column to the `membershipPayments` table so decline reasons can be persisted.

**Requirements:** R4

**Dependencies:** None

**Files:**
- Modify: `src/db/schema/membership-payments.ts`
- Create: `src/db/migrations/<auto-generated>` (via `db:generate`)

**Approach:**
- Add `declineReason: text("decline_reason")` to the table definition (nullable, no default)
- Run `npm run db:generate` then `npm run db:migrate`

**Patterns to follow:**
- Existing nullable text columns in `src/db/schema/membership-payments.ts` and `src/db/schema/auth.ts`

**Test scenarios:**
- Test expectation: none — pure schema migration with no behavioral change. Success is verified by `db:migrate` completing without error.

**Verification:**
- `npm run db:generate` creates a new migration file that adds `decline_reason text` (nullable)
- `npm run db:migrate` applies without error
- `MembershipPaymentCycle` type inferred by Drizzle includes `declineReason: string | null`

---

### U2. Refactor DB query layer for three-table layout

**Goal:** Replace the single `getAllPaymentsForPage()` with three focused functions: all proposed, paginated approved, and paginated declined. Update `MembershipPaymentCycleWithUser` to include `declineReason`. Extend `advancePaymentStatus` to accept `declineReason` in its `extra` argument.

**Requirements:** R1, R2, R3

**Dependencies:** U1

**Files:**
- Modify: `src/db/membership-payments.ts`

**Approach:**
- `getProposedPayments()` — returns `MembershipPaymentCycleWithUser[]` where `status = 'proposed'`, ordered `activationDate ASC`
- `getApprovedPaymentsPage(page, pageSize)` — returns `{ rows: MembershipPaymentCycleWithUser[], total: number }` for statuses not in `['proposed', 'declined']`, ordered `activationDate DESC`; uses `limit/offset` pagination plus a count query
- `getDeclinedPaymentsPage(page, pageSize)` — same shape for `status = 'declined'`, ordered `updatedAt DESC`
- `MembershipPaymentCycleWithUser` — add `declineReason: string | null` to the selected columns
- `advancePaymentStatus` `extra` generic — extend `Pick` to include `"declineReason"` alongside `"gocardlessPaymentId"`
- Verify `getAllPaymentsForPage()` has no callers outside `page.tsx`, then remove it

**Patterns to follow:**
- Existing `getAllPaymentsForPage()` for the join and column selection pattern
- Drizzle `count()` or `sql<number>` for the total query

**Test scenarios:**
- Test expectation: none — Drizzle query functions are validated via TypeScript compilation and browser integration; no unit test setup for DB queries exists in the project.

**Verification:**
- TypeScript compiles without errors
- `getProposedPayments()` returns only rows with `status = 'proposed'`
- `getApprovedPaymentsPage(1, 20)` returns `{ rows, total }` where rows exclude `proposed` and `declined`
- `getDeclinedPaymentsPage(1, 20)` returns `{ rows, total }` where all rows have `status = 'declined'` and `declineReason` is included in the type

---

### U3. Update decline action to require and store reason

**Goal:** Extend the decline action's input schema to require a non-empty reason string, and persist it to `declineReason` when the row transitions to `declined`.

**Requirements:** R4, R5

**Dependencies:** U1, U2

**Files:**
- Modify: `src/app/(authenticated)/(app)/payments/decline-action.ts`

**Approach:**
- Add `reason: z.string().min(1, "Reason is required")` to the Zod input schema
- Pass `{ declineReason: parsedInput.reason }` as the `extra` argument to `advancePaymentStatus`

**Patterns to follow:**
- `src/app/(authenticated)/(app)/payments/charge-action.ts` — same `actionClient` + `inputSchema` pattern
- `src/db/membership-payments.ts` — `advancePaymentStatus` with `extra` partial

**Test scenarios:**
- Error path: calling the action with `reason: ""` is rejected by Zod input validation before any DB write
- Happy path: calling with a non-empty reason transitions the row from `proposed` → `declined` and sets `declineReason` to the provided string
- Error path: calling against a row that is already not `proposed` returns `{ alreadyProcessed: true }` unchanged

**Verification:**
- `declineAction({ id, reason: "" })` fails Zod validation (serverError or validationError returned; DB untouched)
- `declineAction({ id, reason: "Moved to alumni" })` updates row to `status = 'declined'`, `declineReason = 'Moved to alumni'`
- TypeScript compiles without errors

---

### U4. Update server component for three-table data fetching

**Goal:** Refactor `page.tsx` to read `page` and `dpage` from searchParams and pass three datasets plus GC history promise to the client.

**Requirements:** R1, R2, R3, R8

**Dependencies:** U2

**Files:**
- Modify: `src/app/(authenticated)/(app)/payments/page.tsx`

**Approach:**
- Extend `searchParams` type to `{ selected?: string; page?: string; dpage?: string }`
- Parse `page` and `dpage` as integers (default `1`); clamp at `1` minimum
- Fetch in parallel via `Promise.all`: `getProposedPayments()`, `getApprovedPaymentsPage(page, PAGE_SIZE)`, `getDeclinedPaymentsPage(dpage, PAGE_SIZE)`
- Determine `selectedRow` by searching proposed rows first, then declined rows (approved rows are never selectable per R8)
- Start GC history fetch only when `selectedRow` is non-null and `selectedRow.status !== 'declined'` and `selectedRow.gocardlessCustomerId` is set; otherwise `Promise.resolve([])`
- Pass `proposed`, `approved: { rows, total }`, `declined: { rows, total }`, `selectedRow`, `gcHistoryPromise` to `PaymentsPageClient`

**Patterns to follow:**
- Current `src/app/(authenticated)/(app)/payments/page.tsx` — unawaited promise pattern for GC history streaming

**Test scenarios:**
- Test expectation: none — server component; verified by browser integration and TypeScript compilation.

**Verification:**
- TypeScript compiles without errors
- Navigating to `?page=2` causes the approved rows to shift by one page
- Navigating to `?selected=<declined-id>` resolves `selectedRow` from the declined dataset
- Navigating to `?selected=<approved-id>` resolves `selectedRow` as `null` (approved rows not selectable)

---

### U5. Restructure client component into three-table layout

**Goal:** Rewrite the client component to render proposed, approved, and declined sections; wire pagination via nuqs; and show the correct drawer type based on selected row status.

**Requirements:** R1, R2, R3, R5, R6, R7, R8

**Dependencies:** U3, U4

**Files:**
- Modify: `src/app/(authenticated)/(app)/payments/page-client.tsx`

**Approach:**

*Props interface update:*
- Replace `rows` with `proposed`, `approved: { rows, total }`, `declined: { rows, total }`
- Retain `selectedRow` and `gcHistoryPromise`

*URL state additions (all `shallow: false`):*
- `page` via `parseAsInteger.withDefault(1)` — approved pagination
- `dpage` via `parseAsInteger.withDefault(1)` — declined pagination
- `selected` — unchanged from current

*Proposed table* (unchanged columns, keep existing search filter and sorting):
- Clickable rows, ChevronRight, empty state text: "No proposed payments. All members are covered or in-flight."

*Approved table* (new):
- Columns: Member, Coverage period, Amount, Status
- No click handler, no ChevronRight, `cursor-default`, `opacity-75` on rows
- Below the table: Pagination component with `page` / `setPage`; show "Page N of M" or omit when total ≤ PAGE_SIZE

*Declined collapsible* (new, using shadcn `Collapsible`):
- `CollapsibleTrigger`: flex row with ChevronRight (rotates 90° when open via `data-[state=open]` CSS), "Declined" text, count badge, right-aligned muted "Audit trail — not re-proposed" span
- `CollapsibleContent`: table with columns Member, Coverage period, Declined on (`updatedAt` formatted), Reason (truncated with `truncate max-w-xs`)
- Clickable rows open the declined drawer; below the table: Pagination component with `dpage` / `setDpage`
- Default `open={false}`

*Drawer routing:*
- Sheet `open` condition: `selectedRow !== null` (unchanged)
- Inside `SheetContent`: render `DeclinedDrawer` when `selectedRow.status === "declined"`, else `ProposedDrawer`

*ProposedDrawer additions:*
- Add `declineReason` local state (string, `""`)
- Add a labeled `Textarea` (or `Input`) for the reason above the footer action buttons
- Decline `Button` gets `disabled={declineReason.trim().length === 0 || isAnyPending}`
- Pass `{ id: row.id, reason: declineReason }` to `decline()`
- Reset `declineReason` to `""` when `onClose` is called or `selectedRow` changes

*DeclinedDrawer* (new component):
- Member header (avatar, name, email, "Declined" badge) — same structure as ProposedDrawer header
- Detail list: Membership year, Amount, Status badge, Declined on (`formatDate(row.updatedAt)`)
- "Decline reason" section: muted labeled panel with `row.declineReason` text
- Footer: single "Close" button only; no charge/decline buttons

*Pagination component wiring:*
- `PaginationPrevious`: `onClick={() => setPage(p => Math.max(1, p - 1))}` with `aria-disabled` / pointer-events-none when `page === 1`
- `PaginationNext`: `onClick={() => setPage(p => Math.min(totalPages, p + 1))}` when `page < totalPages`
- Same pattern for `dpage`

**Patterns to follow:**
- Current `ProposedDrawer` in `src/app/(authenticated)/(app)/payments/page-client.tsx` for the drawer chrome pattern
- `src/components/ui/collapsible.tsx` for Collapsible usage
- `src/components/ui/pagination.tsx` for Pagination components
- `src/components/ui/textarea.tsx` if present; otherwise `src/components/ui/input.tsx`

**Test scenarios:**
- Happy path (proposed): clicking a proposed row opens the drawer; Decline button is disabled until reason textarea is non-empty; entering reason and clicking Decline calls the action with the reason
- Happy path (declined): clicking a declined row opens `DeclinedDrawer` showing the stored reason; no Charge or Decline buttons present
- Happy path (approved): approved table rows have no click handler; clicking a row does not open a drawer
- Edge case (proposed empty): proposed table shows the empty state message instead of a table
- Edge case (approved single page): pagination controls are hidden or disabled when `approved.total <= PAGE_SIZE`
- Edge case (pagination boundary): Previous disabled on page 1; Next disabled on last page for both approved and declined
- Edge case (declined collapsed): declined section is collapsed on initial render; clicking the trigger expands it
- Integration: after successful charge, `setSelectedId(null)` and `router.refresh()` close the drawer and reload data; after successful decline, same behaviour

**Verification:**
- Three sections render in the correct order with correct row interactivity
- Proposed rows open ProposedDrawer; declined rows open DeclinedDrawer; approved rows do not open anything
- Decline button in ProposedDrawer remains disabled with empty reason textarea
- Declined drawer shows stored reason text
- Stat cards are unchanged and still aggregate across all rows (passed separately or computed from all datasets)
- Pagination URL params update on navigation and trigger SSR re-render
- TypeScript compiles without errors; `npm run lint` passes

---

## System-Wide Impact

- **Interaction graph:** `declineAction` now writes `declineReason` to the DB; the client component that calls it must supply `reason` — no other callers exist.
- **Error propagation:** Empty reason caught by Zod at the action boundary; never reaches the DB.
- **State lifecycle risks:** `selectedRow` is resolved from proposed ∪ declined only; an approved row ID in `?selected` yields `null` — drawer stays closed (safe).
- **API surface parity:** None — no external API changes.
- **Unchanged invariants:** Charge action unaffected. GC history streaming pattern unchanged for proposed rows. Stat card aggregation logic unchanged (computed from all datasets client-side or passed from server).

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Nullable migration on existing table | Safe — `decline_reason text` with no default; existing rows get `NULL`, which is the correct value for historical declines with no recorded reason |
| `advancePaymentStatus` type widening | Additive-only; existing callers (charge action) omit `declineReason` in `extra`, which remains optional |
| Approved rows previously clickable in stat card calculations | Stat cards compute aggregates from all datasets; no clickability change needed there |
| Pagination URL param naming collision | Distinct names (`page`, `dpage`) eliminate cross-table state interference |

---

## Sources & References

- Design reference: `START Cockpit New Nav (2)/payments-page.jsx`
- Shadcn Pagination: `src/components/ui/pagination.tsx`
- Shadcn Collapsible: `src/components/ui/collapsible.tsx`
- Current DB queries: `src/db/membership-payments.ts`
- Current server component: `src/app/(authenticated)/(app)/payments/page.tsx`
- Current client component: `src/app/(authenticated)/(app)/payments/page-client.tsx`
- Decline action: `src/app/(authenticated)/(app)/payments/decline-action.ts`
