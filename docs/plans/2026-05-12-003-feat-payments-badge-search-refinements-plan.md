---
title: "feat: Payments page — badge component consolidation and search relocation"
type: feat
status: active
date: 2026-05-12
---

# feat: Payments page — badge component consolidation and search relocation

## Summary

Two focused UX refinements to the Payments page: move the search field from the "Proposed payments" table (which doesn't benefit from it) to the "Payment history" table (where it's more useful), and consolidate all badge rendering behind the existing `PaymentStatusBadge` component so that styling, labels, and tooltips come from a single source of truth. A companion `GcPaymentStatusBadge` handles the GoCardless-native status values shown in the payment history drawer.

---

## Problem Frame

`page-client.tsx` duplicates the badge type, label map, and variant map that already live in `payment-status-badge.tsx`, so tooltip copy and styling can drift. The search field on the "Proposed" table filters a typically short list that admins scan at a glance; moving it to "Payment history" (the paginated, growing archive) makes it far more useful. Because "Payment history" is server-paginated, the search must be implemented as a URL query param so the server filters before pagination, not after.

---

## Requirements

- R1. The "Proposed payments" section has no search field.
- R2. The "Payment history" section has a search field that filters by member name or email.
- R3. Payment history search is server-side (filters before pagination) and expressed as a URL query param so it survives reload and is shareable.
- R4. All status badges in `page-client.tsx` use `PaymentStatusBadge` or `GcPaymentStatusBadge` — no inline `Badge` with ad-hoc label/variant lookups.
- R5. `PaymentStatusBadge` and `GcPaymentStatusBadge` each include a tooltip that explains the status in clear, approachable language aligned with the GoCardless documentation.

---

## Scope Boundaries

- No changes to the "Declined" table's search behaviour (it stays collapsed with no search).
- No changes to stat cards, drawer action buttons, or pagination logic.
- No new database columns or migrations.
- No changes to the "Proposed" table's columns or row click behaviour.

### Deferred to Follow-Up Work

- Ability to filter "Payment history" by status (dropdown): separate iteration.

---

## Context & Research

### Relevant Code and Patterns

- `src/app/(authenticated)/(app)/payments/payment-status-badge.tsx` — existing `PaymentStatusBadge` with `STATUS_CONFIG` covering all internal payment cycle statuses. Already wraps a `Tooltip`. This is the canonical badge; `page-client.tsx` must defer to it.
- `src/app/(authenticated)/(app)/payments/page-client.tsx` — duplicates `MembershipPaymentCycleStatus`, `STATUS_LABELS`, `STATUS_BADGE_VARIANT`, `GC_STATUS_LABELS`, `GC_STATUS_BADGE_VARIANT`. All of these should be removed after the badge consolidation.
- `src/app/(authenticated)/(app)/payments/page.tsx` — server component that reads `page`, `dpage`, `selected` from `searchParams`. Needs to read `q` for the history search.
- `src/db/membership-payments.ts` — `getApprovedPaymentsPage(page, pageSize)` needs an optional `search` param that adds an ILIKE filter on `userName` and `userEmail`.
- URL query state uses **Nuqs** (`useQueryState`, `parseAsString`) — see `page-client.tsx` for existing usage pattern.
- `src/components/ui/badge.tsx`, `tooltip.tsx` — shadcn/ui primitives already in use.

### GoCardless Payment Statuses (sandbox data, from MCP)

GoCardless-native payment statuses (used in the GC history table inside the drawer, distinct from our internal cycle statuses):

| GC status | Meaning |
|---|---|
| `pending_submission` | Created in GoCardless; not yet sent to the banks. |
| `submitted` | Submitted to the banking network. Funds typically collected within 1–3 business days. |
| `confirmed` | Collected from the customer's account; funds are on their way. |
| `paid_out` | Settled into START Berlin's bank account. |
| `cancelled` | Cancelled before reaching the bank. No funds were collected. |
| `customer_approval_denied` | The customer denied authorisation — no payment was taken. |
| `pending_customer_approval` | Awaiting the customer's authorisation before submission. |
| `failed` | Rejected by the customer's bank — usually insufficient funds or a cancelled mandate. |
| `charged_back` | Reversed following a dispute. Funds were returned to the customer. |

### Institutional Learnings

- URL state for pagination and selection already lives in `page-client.tsx` via `useQueryState`. Adding `q` follows the same pattern with `parseAsString.withDefault("")` and `shallow: false` to trigger a server re-fetch.

---

## Key Technical Decisions

- **Server-side search for Payment history**: `approved` rows are paginated server-side (20 per page), so client-side filtering on `approved.rows` would only search the visible page. The `q` param must travel through `searchParams` → `page.tsx` → `getApprovedPaymentsPage`. This also resets `page` to 1 when the search term changes.
- **Separate `GcPaymentStatusBadge`**: GoCardless-native statuses (`pending_submission`, `customer_approval_denied`, etc.) are distinct from our internal status enum. A separate export from the same badge file avoids polluting `PaymentStatus` with GC-specific values and keeps each badge's tooltip copy clearly scoped.
- **No GC history search**: The GC history table in the drawer is a short, non-paginated list per member. No search needed there.
- **Remove duplicate types from page-client.tsx**: After consolidation, `MembershipPaymentCycleStatus`, `STATUS_LABELS`, `STATUS_BADGE_VARIANT`, `GC_STATUS_LABELS`, `GC_STATUS_BADGE_VARIANT` are all dead code and should be deleted.

---

## Open Questions

### Resolved During Planning

- **Should history search reset page to 1?** Yes — changing the search term implicitly jumps to page 1 to avoid showing an empty page. Implement by calling `setPage(1)` alongside `setQ(value)` in the onChange handler.
- **Which GoCardless statuses need tooltips?** All nine GC statuses listed in the table above — each gets a short tooltip in the same conversational tone as the existing internal statuses.

### Deferred to Implementation

- Whether to use a utility function or inline logic for the metacharacter-escaping step — the escaping requirement itself is resolved (escape `%` and `_` before use in ILIKE).

---

## Implementation Units

### U1. Add `GcPaymentStatusBadge` to the badge component file

**Goal:** Create a `GcPaymentStatusBadge` that handles GoCardless-native payment statuses with correct labels, variants, and tooltips. Export it from the same file as `PaymentStatusBadge`.

**Requirements:** R4, R5

**Dependencies:** None

**Files:**
- Modify: `src/app/(authenticated)/(app)/payments/payment-status-badge.tsx`

**Approach:**
- Add a `GcPaymentStatus` type covering the nine GC-native status strings.
- Add a `GC_STATUS_CONFIG` record (same shape as `STATUS_CONFIG`) with label, variant, and tooltip for each status.
- Export a `GcPaymentStatusBadge` component following the same pattern as `PaymentStatusBadge`.
- Tooltip copy should be concise and approachable (same tone as existing entries), grounded in the GC documentation meanings above.
- **Label disambiguation:** `pending_submission` shares the string value with our internal `pending` status. Use a distinct label — e.g. "Queued" — so the two cannot be confused when both appear on screen (internal `pending` in the history table, GC `pending_submission` in the drawer's GC history).

**Patterns to follow:**
- `src/app/(authenticated)/(app)/payments/payment-status-badge.tsx` — mirror `STATUS_CONFIG` / `PaymentStatusBadge` shape exactly.

**Test scenarios:**
- Test expectation: none — pure presentational config; visual correctness is verified by rendering the component in the browser (each status renders the right label, variant, and tooltip text).

**Verification:**
- `GcPaymentStatusBadge` renders for all nine GC statuses with correct label and tooltip.
- Falls back to raw status string in an outline badge when given an unknown status (same fallback as `PaymentStatusBadge`).

---

### U2. Replace inline badge logic in page-client.tsx with the badge components

**Goal:** Delete the duplicated type/label/variant maps in `page-client.tsx` and replace all inline badge rendering with `PaymentStatusBadge` or `GcPaymentStatusBadge`.

**Requirements:** R4, R5

**Dependencies:** U1

**Files:**
- Modify: `src/app/(authenticated)/(app)/payments/page-client.tsx`

**Approach:**
- Remove: `MembershipPaymentCycleStatus` type, `STATUS_LABELS`, `STATUS_BADGE_VARIANT`, `GC_STATUS_LABELS`, `GC_STATUS_BADGE_VARIANT`.
- Import `PaymentStatusBadge`, `GcPaymentStatusBadge`, and their status types from `./payment-status-badge`.
- Update usages:
  - **Payment history table** status column: replace `<Badge variant={STATUS_BADGE_VARIANT[...]}>...</Badge>` with `<PaymentStatusBadge status={row.status as PaymentStatus} />`.
  - **ProposedDrawer** status row: replace `<Badge variant={STATUS_BADGE_VARIANT.proposed}>Proposed</Badge>` with `<PaymentStatusBadge status="proposed" />`.
  - **DeclinedDrawer** header badge and status row: replace with `<PaymentStatusBadge status="declined" />`.
  - **GcHistoryTable** status column: replace `<Badge variant={GC_STATUS_BADGE_VARIANT[...]}>{GC_STATUS_LABELS[...]}</Badge>` with `<GcPaymentStatusBadge status={p.status} />`.
- Keep the `Tooltip`, `TooltipContent`, and `TooltipTrigger` imports — they are used by the stat card info icons (lines ~275 and ~296) and must not be removed.

**Patterns to follow:**
- Existing `PaymentStatusBadge` import in `payment-status-badge.tsx` for the import path convention.

**Test scenarios:**
- Happy path: Payment history table row with `paid_out` status shows "Paid out" badge with correct variant; hovering reveals tooltip.
- Happy path: GC history table row with `pending_submission` shows "Queued" label from `GcPaymentStatusBadge` (distinct from internal `pending` → "Pending").
- Edge case: Payment history row with an unrecognised status string falls back gracefully (outline badge, raw string).
- Integration: No TypeScript errors after removing the duplicate type definitions.

**Verification:**
- `page-client.tsx` contains no `STATUS_LABELS`, `STATUS_BADGE_VARIANT`, `GC_STATUS_LABELS`, or `GC_STATUS_BADGE_VARIANT` references.
- `npm run lint` passes with no unused imports.
- All badge usages in the payment page and drawer render correctly in the browser.

---

### U3. Move search from Proposed to Payment history (server-side)

**Goal:** Remove the search field from the "Proposed payments" section; add a server-driven search field to the "Payment history" section that filters by member name or email.

**Requirements:** R1, R2, R3

**Dependencies:** None (independent of U1/U2 — can be implemented in parallel)

**Files:**
- Modify: `src/db/membership-payments.ts`
- Modify: `src/app/(authenticated)/(app)/payments/page.tsx`
- Modify: `src/app/(authenticated)/(app)/payments/page-client.tsx`

**Approach:**

*`membership-payments.ts`*
- Add an optional `search?: string` param to `getApprovedPaymentsPage`.
- When `search` is non-empty, escape ILIKE metacharacters in the search value (`%` → `\%`, `_` → `\_`) before use, and add `ESCAPE '\\'` to the LIKE clause. Apply this pattern via `sql\`...\`` template since `userName` is a SQL expression (`user.firstName || ' ' || user.lastName`), not a real column — Drizzle's `ilike()` helper requires a `Column` type and cannot be applied directly to it. Use Drizzle's `ilike()` helper for `user.email` (a real column), and raw `sql\`...\`` for the name expression.
- **Critical:** The existing count sub-query (`db.select({ total: count() }).from(membershipPayments).where(...)`) queries `membershipPayments` alone with no join. When `search` is active, add `innerJoin(user, eq(user.id, membershipPayments.userId))` to the count sub-query as well, so the filtered total reflects the join and matches the rows query result.
- Trim and cap `search` to 200 characters before use (callers should also validate, but the DB function is the last line of defence).

*`page.tsx`*
- Extend the `searchParams` type to include `q?: string`: `Promise<{ selected?: string; page?: string; dpage?: string; q?: string }>`.
- Read `q` from `searchParams` (alongside `page`, `dpage`, `selected`), trim it, and pass it to `getApprovedPaymentsPage`.
- **Out-of-bounds page clamping:** After fetching `approved`, if `page > approvedTotalPages`, re-fetch with `page = 1` or simply pass `Math.min(page, approvedTotalPages)` to the query so an out-of-range bookmarked URL doesn't silently return zero rows.
- Do not pass `q` as a prop to `PaymentsPageClient` — `useQueryState` reads it from the URL directly, matching the same pattern used for `page` and `dpage`.

*`page-client.tsx`*
- Remove: `q` local state (`React.useState`), `filteredProposed` derived value, the search input and its container `div` from the "Proposed payments" section header. The proposal count span can remain, showing `proposed.length`.
- Add: a local controlled `inputValue` state for the input field, and a `q` URL query state using `useQueryState("q", parseAsString.withDefault("").withOptions({ shallow: false }))`. Keep them separate: `inputValue` updates on every keystroke; `q` (URL) is written after a 300 ms debounce. This avoids a server round-trip on every keypress while keeping the URL param clean.
- When the debounced value changes, also call `setPage(1)` to reset pagination.
- Add a search input to the "Payment history" section header (mirror the existing search input style — relative div, `SearchIcon`, `Input`, `h-8 text-sm`). Bind it to `inputValue`, not `q`.
- **Empty-state copy:** The approved table's empty state must branch on whether `q` is active: (1) `q` is empty → "No payments have been approved yet." (2) `q` is non-empty → "No payments match your search."
- The count span in the Payment history header should show `approved.total` (reflects server-filtered total).

**Patterns to follow:**
- Existing `useQueryState` usage with `shallow: false` for `page` / `dpage` in `page-client.tsx`.
- Existing search input UI in the "Proposed" section (reuse the same markup structure).

**Test scenarios:**
- Happy path: Typing a member name in the Payment history search shows only matching rows; URL updates with `?q=...`; page resets to 1.
- Happy path: Clearing the search shows all Payment history rows.
- Happy path: "Proposed payments" section has no search input and always shows all proposed rows.
- Edge case: Searching with a term that matches no rows shows "No payments match your search." (not the "No payments have been approved yet." copy).
- Edge case: Search term with `%` or `_` is treated as literal characters, not SQL wildcards — does not return unexpected extra rows.
- Edge case: `?q=Smith&page=99` (page out of range for the filtered result set) returns page 1 results, not an empty table.
- Integration: Navigating directly to `?q=Smith&page=2` from another tab applies both the filter and page correctly.
- Integration: Typing in the search box does not fire a server request on every keystroke — debounce fires ~300 ms after the user stops typing.

**Verification:**
- "Proposed payments" section renders no search input.
- Typing in the "Payment history" search triggers a server re-fetch (network tab shows a new request).
- `getApprovedPaymentsPage` count changes to reflect the filtered total.

---

## System-Wide Impact

- **Interaction graph:** The `q` URL param joins `page`, `dpage`, `selected` as shared navigation state. Navigation to a URL with `q` pre-filled correctly applies the search filter on first load.
- **State lifecycle risks:** Changing `q` must reset `page` to 1; otherwise page 2 with a narrow search returns an empty result set.
- **Unchanged invariants:** Proposed payment selection (drawer open/close), Declined table behaviour, stat cards, and GcHistory streaming are unaffected.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| ILIKE on SQL expression `userName` requires raw `sql\`...\`` template, not Drizzle's `ilike()` helper | Use raw SQL with parameterised binding for the name expression; `ilike()` for `user.email` |
| ILIKE metacharacter injection (`%`, `_`) produces incorrect results without escaping | Escape metacharacters before interpolation; covered in U3 approach |
| Count query must join `user` table when search is active | Explicit note in U3 approach: add `innerJoin(user, ...)` to count query |
| Removing duplicate types could surface hidden type mismatches with `row.status` casts | Fix any cast sites during U2 — treat TypeScript errors as verification |
| Reset `page` on search change could cause a double navigation flash | Nuqs batches URL updates within the same React render cycle |

---

## Sources & References

- Related code: `src/app/(authenticated)/(app)/payments/payment-status-badge.tsx`
- Related code: `src/app/(authenticated)/(app)/payments/page-client.tsx`
- Related code: `src/db/membership-payments.ts`
- GoCardless payment API (sandbox): MCP `gocardless://api/endpoints/payment`
