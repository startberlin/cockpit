---
title: "feat: Redesign admin member detail page"
type: feat
status: active
date: 2026-05-23
origin: docs/brainstorms/2026-05-23-admin-member-detail-redesign-requirements.md
---

# feat: Redesign admin member detail page

## Summary

The implementation extends existing patterns throughout — DropdownMenu for the three-dot menu, `@tanstack/react-table` for groups and payment tables, `getUserAuthorityData` for the permissions section, and the server-renders-data / client-handles-interaction split already established by `admin-action-cards.tsx`. One schema migration adds `joinedAt` to `usersToGroups`. The `ActiveSessionsCard` and `AdminActionCards` components are deleted; all their behaviour is redistributed into the new layout.

---

## Problem Frame

The current detail page is a flat stack of undifferentiated cards. Admin actions (Impersonate, Propose, Remove) sit disconnected at the bottom with no membership context. The groups section shows only group names with no counts, source type, or join dates. There is no at-a-glance summary strip. See origin doc for full framing.

---

## Requirements

- R1. Header: avatar, name, email, inline metadata badges (Batch, Department, membership status, legal membership status), Impersonate button (gated by `users.impersonate`)
- R2. Summary strip: four values — Status, Member since, Batch, Last sign-in — horizontal row on desktop, 2×2 grid on mobile; "—" for missing values
- R3. Membership card (formerly Profile): renamed, three-dot menu with Propose / Remove options (each independently permission- and eligibility-gated); fields include Department lead + avatar, Member-for duration, Last sign-in
- R4. Groups section: TanStack Table with Group name, Member count, Source ("Matching rule" / "Manual"), Joined date; summary text; empty state shown (section not hidden)
- R5. `joinedAt` timestamp added to `usersToGroups`; backfilled with member's `createdAt`; new group query returns source, joinedAt, memberCount
- R6. Payment section: total-collected summary + next collection month; TanStack Table with Date, Event, Amount columns; payment records only
- R7. Roles & permissions section: read-only inline display of positions and grants; "Edit permissions" button (gated by `users.manage_authority`)
- R8. Mobile: single-column layout, centered avatar header, summary strip as 2×2 grid, tables scroll horizontally via TanStack
- R9. `loading.tsx` updated to match new section order and structure
- R10. `ActiveSessionsCard` and `AdminActionCards` deleted; their behaviours redistributed

**Origin actors:** A1 (Admin viewer), A2 (Department viewer), A3 (Finance / legal viewer), A4 (Target member)
**Origin acceptance examples:** AE1 (R3 / three-dot visibility), AE2 (R3 / Propose eligibility), AE3 (R3 / Remove eligibility), AE4 (R1 / no buttons), AE5 (R2 / missing values), AE6 (R4 / empty state), AE7 (R2 / responsive strip), AE8 (R3 / menu navigates, no inline action)

---

## Target Layout

> *This describes the intended page structure. It is directional, not an implementation specification.*

**Desktop (full-width single column):**

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to members                                      │
│                                                         │
│  [Avatar]  Clara Werner                                 │
│            clara@start-berlin.com                       │
│            · Batch #9 · Partnerships · Active member    │
│            · Legal member          [Impersonate]        │
│                                                         │
│  ┌──────────┬───────────────┬──────────┬─────────────┐  │
│  │ Status   │ Member since  │ Batch    │ Last sign-in │  │
│  │ Active   │ 17 Mar 2025   │ #9       │ Today 09:14  │  │
│  └──────────┴───────────────┴──────────┴─────────────┘  │
│                                                         │
│  ┌─ Membership ──────────────────────────────── [⋯] ──┐ │
│  │ Status · Batch · Department · Dept lead             │ │
│  │ Legal membership · Member since · Member for        │ │
│  │ Onboarding · Last sign-in                           │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─ Contact ───────────────────────────────────────────┐ │
│  │ START email · Personal email · Phone · Address      │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─ Groups ────────────────────────────────────────────┐ │
│  │ 5 memberships, 4 by matching rules and 1 manually.  │ │
│  │ Group       │ Members │ Source          │ Joined     │ │
│  │ Partnerships │ 6      │ Matching rule   │ 17 Mar 25  │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─ Payments ──────────────────────────────────────────┐ │
│  │ €80 collected over 2 years. Next collection Mar 26. │ │
│  │ Date        │ Event            │ Amount              │ │
│  │ 20 Mar 2025 │ Payment received │ €40                 │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─ Roles & permissions ───────────────────── [Edit] ─┐  │
│  │ Positions: President (Org) · Head of Partnerships  │  │
│  │ App permissions: Super Admin · People Admin        │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Mobile (< tablet breakpoint):**

```
┌─────────────────────────┐
│   Directory             │
│                         │
│       [  CW  ]          │
│     Clara Werner        │
│  clara@start-berlin.com │
│  Active member          │
│  Legal member           │
│       [Impersonate]     │
│                         │
│  ┌──────────┬─────────┐ │
│  │ Status   │ Member  │ │
│  │ Active   │ since   │ │
│  ├──────────┼─────────┤ │
│  │ Batch    │ Last    │ │
│  │ #9       │ sign-in │ │
│  └──────────┴─────────┘ │
│                         │
│  ┌─ Membership ── [⋯] ─┐│
│  │ (single column)     ││
│  └─────────────────────┘│
│  ... (cards stacked)    │
└─────────────────────────┘
```

---

## Scope Boundaries

- Source / invitation tracking ("Invited by S. Peters") — no schema support, deferred
- Group source sub-type labels (Matching rule · dept / batch / position) — deferred
- SEPA mandate events in payment table — payments only
- Members listing page changes
- Propose / remove / permissions sub-page flow changes

### Deferred to Follow-Up Work

- `AdminMembershipNoticeBlock` contextual notices — currently rendered inside `profile-section.tsx`; removed from this redesign. Whether to re-introduce them elsewhere is a separate decision.

---

## Context & Research

### Relevant Code and Patterns

- **Three-dot menu pattern**: `src/components/people-table.tsx` — `DropdownMenu` + `MoreHorizontal` icon, `variant="ghost" h-8 w-8 p-0` trigger, `align="end"` content
- **TanStack Table pattern**: `src/components/people-table.tsx` and `src/app/(authenticated)/(app)/(default)/payments/page-client.tsx` — `useReactTable`, `getCoreRowModel`, shadcn `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableCell` always used (never raw `<table>`)
- **Server → client prop pattern**: `admin-action-cards.tsx` receives permission booleans from `page.tsx`; three-dot menu client component follows same shape
- **Permission checks**: `can()` in `src/lib/permissions/server.ts` for server gating; `<Can>` / `useCan()` from `src/components/can.tsx` for client affordances
- **Position labels**: defined inline in `src/app/(authenticated)/(app)/(default)/admin/settings/positions/page-client.tsx` — no shared constant; plan creates one locally
- **Grant labels**: defined inline in `src/components/authority-editor.tsx` (Super Admin, Admin, Finance Admin, People Admin)
- **`getUserAuthorityData`**: `src/db/people.ts` line 437 — returns `{ id, organizationPositions, accessGrants }`; already used by `permissions/page.tsx`
- **Session last sign-in**: `src/app/(authenticated)/(app)/(default)/admin/people/[id]/active-sessions-card.tsx` — query `session` table ordered by `desc(session.updatedAt)`, take first row's `updatedAt`
- **Migration conventions**: `drizzle/` directory, files auto-named by `drizzle-kit` (`0039_*.sql`); never edited by hand; workflow is schema edit → `npm run db:generate` → `npm run db:migrate`
- **Existing groups query**: `getUserGroupMemberships` at `src/db/people.ts` line 419 — returns only `{ id, name, slug }`; `source` is on the join table but not currently returned
- **GoCardless payment fields**: `getGcPaymentHistoryForMember` returns `{ id, status, amount, currency, chargeDate, description, createdAt }` — `amount` in cents, `chargeDate` is `"YYYY-MM-DD"` string or null

### Institutional Learnings

- Never import from `@/db/*` in a `"use client"` component — pulls Drizzle's Node.js adapter into the browser bundle; data must be fetched server-side and passed as props
- `legalMembershipState` and `status` are distinct fields; never use `user.status` to infer legal membership
- All section visibility and action gating must go through `can()` / `<Can>` / `useCan()` — no direct grant or position name checks in page or component code
- Per CLAUDE.md: whenever page structure changes, update `loading.tsx` before the PR lands

---

## Key Technical Decisions

- **Client component boundary**: the three-dot menu and TanStack tables are client components; their server-component wrappers fetch data and pass it as props. Permission booleans are resolved server-side in `page.tsx` and passed down — no client-side `useCan()` needed for the menu items (they're already filtered).
- **Last sign-in in `ProfileSection` server query block**: a single extra `db.query.session.findFirst` ordered by `desc(session.updatedAt)` is added alongside existing data fetches in `profile-section.tsx` (renamed `membership-card.tsx`). No new Suspense boundary.
- **New `getUserGroupMembershipsWithDetails` function**: replaces the existing `getUserGroupMemberships` for the detail page. Returns `{ id, name, slug, source, joinedAt, memberCount }`. Uses an inner join to `group` and a correlated count subquery for `memberCount`. Old function kept (used elsewhere if at all).
- **Payment event labels**: mapped from GoCardless status — `paid`/`confirmed`/`paid_out` → "Payment received", `failed`/`charged_back` → "Payment failed", `pending_submission`/`submitted` → "Payment pending", `cancelled` → "Payment cancelled". This makes the Event column informative even with payments only.
- **`profile-section.tsx` renamed to `membership-card.tsx`**: file rename matches the new card title and avoids confusion with any future profile-related components.
- **`AdminMembershipNoticeBlock` removed without replacement**: the design does not include it; the requirements doc does not require it. Deferred to follow-up work.
- **Position / grant label constants defined locally** in `membership-card.tsx` and `permissions-section.tsx` respectively — no shared module introduced until there is a second consumer.

---

## Open Questions

### Resolved During Planning

- **Where does last sign-in live?** Inside `membership-card.tsx`'s server query (alongside existing `profileSection` data). Not a separate Suspense boundary.
- **Member count per group approach?** Correlated count subquery in `getUserGroupMembershipsWithDetails` — one DB round-trip for all groups.
- **`joinedAt` nullable or non-nullable?** Non-nullable with a `defaultNow()` for future inserts; backfill sets it to user's `createdAt` via migration SQL. Planning deferred this — resolving here as non-nullable with backfill.

### Deferred to Implementation

- **Exact `joinedAt` backfill SQL**: the migration references the target user's `createdAt` via a correlated UPDATE. Exact SQL shape is implementation-time detail.
- **Summary strip label/value visual treatment**: field label size, spacing, dividers between the four items — follow the existing card field pattern and adjust to taste.

---

## Implementation Units

### U1. Schema migration — add `joinedAt` to `usersToGroups`

**Goal:** Add a `joinedAt` timestamp to the group membership join table and backfill existing rows.

**Requirements:** R5

**Dependencies:** None

**Files:**
- Modify: `src/db/schema/group.ts`
- Generate: `drizzle/` (new migration via `npm run db:generate`)

**Approach:**
- Add `joinedAt: timestamp("joined_at").notNull().defaultNow()` to the `usersToGroups` table definition in `group.ts`
- Run `npm run db:generate` to produce the migration SQL (auto-named `0039_*.sql`)
- The generated migration will add the column with `DEFAULT NOW()` for future rows; add a follow-up `UPDATE users_to_groups utg SET joined_at = u.created_at FROM "user" u WHERE utg.user_id = u.id` statement to the migration file — per CLAUDE.md, migration files are auto-generated but a backfill UPDATE is added inline as a second statement after the `ALTER TABLE`
- Run `npm run db:migrate` to apply

**Patterns to follow:**
- `src/db/schema/group.ts` — existing column definitions
- `drizzle/0038_*.sql` — recent migration format; use `--> statement-breakpoint` between statements

**Test scenarios:**
- Happy path: after migration, `usersToGroups` rows that existed before have `joinedAt` equal to the corresponding user's `createdAt`, not `NULL` and not the current timestamp
- Happy path: new membership assignments (post-migration) record `joinedAt` as the time of insert
- Edge case: user with no group memberships — migration runs without error, no rows to backfill

**Verification:**
- `npm run db:migrate` completes without error
- Drizzle Studio shows `joined_at` column on `users_to_groups` with non-null values on existing rows

---

### U2. Data layer — enriched group memberships query + last sign-in helper

**Goal:** Add `getUserGroupMembershipsWithDetails` returning source, joinedAt, and memberCount per group; and confirm the session query shape for last sign-in.

**Requirements:** R4, R5, R3 (last sign-in)

**Dependencies:** U1

**Files:**
- Modify: `src/db/people.ts`

**Approach:**
- Add `UserGroupMembershipDetail` interface: `{ id, name, slug, source: "criteria" | "manual", joinedAt: Date, memberCount: number }`
- Add `getUserGroupMembershipsWithDetails` as a `cache()`-wrapped async function; query `usersToGroups` inner-joined to `group`, with a correlated count subquery on `usersToGroups` for `memberCount`
- Keep the existing `getUserGroupMemberships` function (remove only if confirmed unused elsewhere)
- Last sign-in: no new exported function needed — `profile-section.tsx` (U5) will query `session` directly using the pattern from `active-sessions-card.tsx`; document the query shape here in approach only

**Patterns to follow:**
- `getUserGroupMemberships` at line 419 — `cache()` wrapper, Drizzle relational query shape
- `active-sessions-card.tsx` — `db.query.session.findFirst` ordered by `desc(session.updatedAt)` for last session

**Test scenarios:**
- Happy path: member in 3 groups — returns 3 rows with correct `name`, `source`, `joinedAt`, and `memberCount` matching the actual count of users in each group
- Edge case: member with no groups — returns empty array
- Edge case: group with only this one member — `memberCount` is 1
- Edge case: member added manually to one group, via criteria to another — `source` field correctly reflects "manual" vs "criteria" per row

**Verification:**
- TypeScript compiles without error
- `getUserGroupMembershipsWithDetails` returns the expected shape when called with a known test user ID

---

### U3. Member header redesign

**Goal:** Update `member-header.tsx` to show inline metadata badges, the Impersonate button, and a responsive centered-avatar mobile layout.

**Requirements:** R1, R8

**Dependencies:** None (data already available in `getUserDetails`)

**Files:**
- Modify: `src/app/(authenticated)/(app)/(default)/admin/people/[id]/member-header.tsx`

**Approach:**
- Add `canImpersonate: boolean`, `userId: string`, and `userEmail: string` props (resolved in `page.tsx`)
- Inline metadata row: Batch (#N or hidden if null), Department (badge or hidden if null), membership status label ("Active member" / "Onboarding" etc. derived from `user.status`), legal membership label ("Legal member" if `legalMembershipState === "active_member"` — hidden otherwise)
- Impersonate: render `<ImpersonateButton>` (already client component) when `canImpersonate` is true; hidden entirely otherwise
- Responsive layout: on mobile (`sm:` breakpoint as threshold), switch from flex-row (avatar left, text right) to flex-col with `items-center text-center`; metadata badges and button are centered below the name/email block on mobile
- The "Propose membership" button is NOT in the header (per R3 / AE8 — it lives in the three-dot menu)

**Patterns to follow:**
- `src/app/(authenticated)/(app)/(default)/admin/people/[id]/impersonate-button.tsx` — existing client component to reuse
- `src/components/people-table.tsx` — Badge rendering
- `src/lib/user-status.ts` — `USER_STATUS_INFO` for status label

**Test scenarios:**
- Covers AE4. Happy path: viewer without `users.impersonate` — Impersonate button absent; if they also have no three-dot options, no action buttons render at all
- Happy path: viewer with `users.impersonate` — Impersonate button appears in header
- Edge case: member with no batch — Batch metadata item hidden (not shown as "—" in header; summary strip handles "—")
- Edge case: member with no department — Department badge hidden
- Edge case: member with `legalMembershipState !== "active_member"` — "Legal member" badge absent from header metadata

**Verification:**
- Header renders correctly at desktop and mobile viewport widths
- All metadata items are hidden rather than shown as "—" when their data is null

---

### U4. Member summary strip

**Goal:** New server component showing the four at-a-glance values below the header.

**Requirements:** R2, R8

**Dependencies:** None (data from `getUserDetails` and session table)

**Files:**
- Create: `src/app/(authenticated)/(app)/(default)/admin/people/[id]/member-summary-strip.tsx`

**Approach:**
- Server component accepting `userId: string`
- Fetches `getUserDetails(userId)` for status, batch, and `memberSinceDate` (reuses the per-request cache — no duplicate query)
- Fetches last session's `updatedAt` via `db.query.session.findFirst` ordered by `desc(session.updatedAt)` for the Last sign-in value
- Four items: Status (from `USER_STATUS_INFO[user.status].label`), Member since (from `memberSinceDate` or `createdAt` fallback, formatted `"17 Mar 2025"`), Batch (`#N` or "—"), Last sign-in (relative format "Today, HH:MM" / formatted date, or "Never" if no session)
- Responsive layout: `grid grid-cols-4` on `sm:` and up; `grid grid-cols-2` below (2×2)
- Each item: small label above, value below; a subtle divider between items on desktop

**Patterns to follow:**
- `src/app/(authenticated)/(app)/(default)/admin/people/[id]/active-sessions-card.tsx` — session query pattern
- `src/app/(authenticated)/(app)/(default)/admin/people/[id]/profile-section.tsx` — `formatDate` helper

**Test scenarios:**
- Covers AE5. Edge case: member with no batch + never signed in — Batch shows "—", Last sign-in shows "Never"
- Covers AE7. Happy path: desktop viewport — four items in a single row; mobile viewport — 2×2 grid
- Happy path: member with all data — all four values render correctly formatted
- Edge case: `memberSinceDate` is null — falls back to `user.createdAt`

**Verification:**
- Renders without error for a member with missing batch and no sessions
- 2×2 layout verified at mobile viewport width

---

### U5. Membership card (rename + three-dot menu + Last sign-in field)

**Goal:** Rename "Profile" to "Membership", add the three-dot context menu for Propose/Remove actions, add Last sign-in field, remove `AdminMembershipNoticeBlock`.

**Requirements:** R3, AE1, AE2, AE3, AE8

**Dependencies:** None

**Files:**
- Rename: `src/app/(authenticated)/(app)/(default)/admin/people/[id]/profile-section.tsx` → `membership-card.tsx`
- Create: `src/app/(authenticated)/(app)/(default)/admin/people/[id]/membership-card-menu.tsx`
- Update: `src/app/(authenticated)/(app)/(default)/admin/people/[id]/page.tsx` (import path change)

**Approach:**

*`membership-card-menu.tsx`* (client component, `"use client"`):
- Props: `userId: string`, `firstName: string`, `canPropose: boolean`, `canRemove: boolean`
- Renders `<DropdownMenu>` with `<DropdownMenuTrigger>` (`MoreHorizontal` icon, `variant="ghost" h-8 w-8 p-0`) only when `canPropose || canRemove`
- `<DropdownMenuItem>` for "Propose for membership" → `href={/admin/people/${userId}/propose}` (rendered as `<Link>` via `asChild`); shown only when `canPropose`
- `<DropdownMenuItem>` for "Remove from START Berlin" → `href={/admin/people/${userId}/remove}`; shown only when `canRemove`; destructive styling

*`membership-card.tsx`* (server component):
- Change `<CardTitle>` from "Profile" to "Membership"
- Add `CardAction` slot (or `CardHeader` flex row) to place the `<MembershipCardMenu>` at top-right of the card header
- Add "Last sign-in" field: query `session` table (`db.query.session.findFirst` ordered by `desc(session.updatedAt)`) inside the existing `Promise.all`; display formatted datetime or "Never"
- Remove `<AdminMembershipNoticeBlock>` and its import and the `<Separator>` that follows it
- Keep all existing fields: Status, Batch, Department, Department lead + avatar, Legal membership, Member since, Member-for duration, Onboarding
- Add locally-defined position and grant label helpers as needed

**Patterns to follow:**
- `src/components/people-table.tsx` — three-dot menu shape
- `src/app/(authenticated)/(app)/(default)/admin/people/[id]/admin-action-cards.tsx` — server → client boolean props pattern
- `src/app/(authenticated)/(app)/(default)/admin/people/[id]/active-sessions-card.tsx` — session query

**Test scenarios:**
- Covers AE1. Viewer with neither `canPropose` nor `canRemove` — three-dot button not rendered
- Covers AE2. Viewer with `canPropose` but member is already a legal member — `canPropose` is `false` (computed in `page.tsx`); menu item absent
- Covers AE3. Viewer with `canRemove` but member status is "cancelled" — `canRemove` is `false`; menu item absent
- Covers AE8. Clicking "Remove from START Berlin" — navigates to remove sub-page; no action fires from the menu
- Happy path: viewer with both permissions, eligible member — both menu items visible
- Happy path: Last sign-in field shows correct datetime for a member who has signed in
- Edge case: Last sign-in "Never" for a member who has never created a session

**Verification:**
- Card renders with title "Membership"
- Three-dot button absent when `canPropose && canRemove` are both false
- Last sign-in field visible in card below Onboarding field
- `AdminMembershipNoticeBlock` import deleted; no references remain

---

### U6. Groups section redesign

**Goal:** Replace the current grid of links with a TanStack Table client component showing Group, Members, Source, and Joined columns.

**Requirements:** R4, AE6

**Dependencies:** U2

**Files:**
- Modify: `src/app/(authenticated)/(app)/(default)/admin/people/[id]/groups-card.tsx`
- Create: `src/app/(authenticated)/(app)/(default)/admin/people/[id]/groups-table-client.tsx`

**Approach:**

*`groups-table-client.tsx`* (client component, `"use client"`):
- Props: `groups: UserGroupMembershipDetail[]`
- Columns: Group name (linked to `/groups/${group.id}`, or `/groups/${group.slug}`), Member count (right-aligned), Source ("Matching rule" for `"criteria"`, "Manual" for `"manual"`), Joined (formatted date `"17 Mar 2025"`)
- Uses `useReactTable` with `getCoreRowModel()`
- Renders with shadcn `Table` components (same as `people-table.tsx`)
- No sorting / filtering in this iteration

*`groups-card.tsx`* (server component):
- Swap `getUserGroupMemberships` → `getUserGroupMembershipsWithDetails`
- When `groups.length === 0`: render the card with an empty state paragraph ("No group memberships.") instead of returning `null`
- Summary line calculation: count `criteria` vs `manual` entries; build summary text: "N memberships, X added by matching rules and Y manually." Special cases: all one type → "N memberships, all added by matching rules." / "all added manually."
- Pass `groups` array to `<GroupsTableClient>`

**Patterns to follow:**
- `src/components/people-table.tsx` — full TanStack Table render pattern
- `src/components/groups-table.tsx` — secondary reference for group-specific column shape

**Test scenarios:**
- Covers AE6. Member with no groups — card renders with "No group memberships." empty state; section is not hidden
- Happy path: member in 3 groups (2 criteria, 1 manual) — table shows 3 rows; summary reads "3 memberships, 2 added by matching rules and 1 manually."
- Edge case: all groups added by criteria — summary reads "N memberships, all added by matching rules."
- Edge case: single group, manually added — summary reads "1 membership, all added manually."
- Happy path: Group name column renders as a link to the group page
- Happy path: Source column shows "Matching rule" (not "criteria") for criteria-sourced memberships

**Verification:**
- Section visible with empty state when member has no groups
- Summary text accurate for mixed and homogenous source cases
- Group name links navigate correctly

---

### U7. Payment section redesign

**Goal:** Add a total-collected summary line and convert to a TanStack Table with Date, Event, Amount columns.

**Requirements:** R6

**Dependencies:** None (data sources unchanged)

**Files:**
- Modify: `src/app/(authenticated)/(app)/(default)/admin/people/[id]/payment-section.tsx`
- Create: `src/app/(authenticated)/(app)/(default)/admin/people/[id]/payment-table-client.tsx`

**Approach:**

*`payment-table-client.tsx`* (client component, `"use client"`):
- Props: `payments: GcPaymentRecord[]`
- Columns: Date (`chargeDate`, formatted "20 Mar 2025"), Event (mapped from status — see Key Technical Decisions), Amount (`formatAmount(payment.amount)`)
- Uses `useReactTable` with `getCoreRowModel()`
- Event label map: `paid`/`confirmed`/`paid_out` → "Payment received"; `failed`/`charged_back` → "Payment failed"; `pending_submission`/`submitted` → "Payment pending"; `cancelled` → "Payment cancelled"; fallback → status string

*`payment-section.tsx`* (server component):
- Keep all existing data fetches (`getGcPaymentHistoryForMember`, `getActivePaymentTerm`)
- Total collected: sum `amount` (in cents) of payments where `status` is `paid`, `confirmed`, or `paid_out`; convert to EUR string
- Duration label: if payment history spans < 12 months → "months"; ≥ 12 → "N year(s)"; derive from earliest `chargeDate` to today
- Summary line: "€X collected over N years." or "€X collected." when duration < 1 month
- Next collection: append " Next collection [Month Year]." when `nextDueDate` is available (existing logic)
- Show up to 5 most recent payments (existing cap), pass to `<PaymentTableClient>`
- Empty state strings remain: "No direct debit set up." / "No payment history."

**Patterns to follow:**
- `src/components/people-table.tsx` — TanStack Table client component shape
- `src/app/(authenticated)/(app)/(default)/payments/page-client.tsx` — payment status / amount formatting

**Test scenarios:**
- Happy path: member with 2 paid payments of €40 each over 2 years — summary reads "€80 collected over 2 years. Next collection March 2026."
- Happy path: member with 1 payment of €40 this year — summary reads "€40 collected. Next collection March 2027." (or relevant date)
- Edge case: member with no GoCardless customer — "No direct debit set up." empty state
- Edge case: member with mandate but no payments — "No payment history." empty state
- Edge case: failed payment — Event column shows "Payment failed"
- Edge case: pending payment — Event column shows "Payment pending"
- Happy path: total excludes `failed`/`cancelled` payments from the collected sum

**Verification:**
- Summary line amounts and duration text correct for known test data
- Event labels correctly map GoCardless status strings

---

### U8. Roles & permissions section

**Goal:** New inline read-only section showing the member's positions and app permission grants, with an "Edit permissions" button.

**Requirements:** R7

**Dependencies:** None (`getUserAuthorityData` already exists)

**Files:**
- Create: `src/app/(authenticated)/(app)/(default)/admin/people/[id]/permissions-section.tsx`

**Approach:**
- Server component accepting `userId: string`
- Calls `getUserAuthorityData(userId)` (per-request cache, no duplicate fetch if `page.tsx` also calls it)
- Section header: "Roles & permissions" with an "Edit permissions" `<Button asChild variant="outline" size="sm">` linking to `/admin/people/${userId}/permissions`
- Positions list: for each position in `authorityData.organizationPositions`, render `positionLabel — scopeLabel` (e.g. "President — Organization", "Head of Partnerships — Department"). Empty state: "No positions."
- Scope label: `"global"` → "Organization"; `"department"` → the `DEPARTMENT_NAMES[department]` string (e.g. "Partnerships")
- Position label map (local constant): `president → "President"`, `vice_president → "Vice President"`, `head_of_finance → "Head of Finance"`, `department_head → "Head of [Department]"` (uses department name for dept heads)
- Grants list: for each grant, render `grantLabel — resourceLabel`. Label map (local constant): `super_admin → "Super Admin — All resources"`, `admin → "Admin — All resources"`, `finance_admin → "Finance Admin — Payments"`, `people_admin → "People Admin — Members & batches"`. Empty state: "No app permissions."
- Visibility: this component is only rendered when `canManageAuthority` is true (gate in `page.tsx`)

**Patterns to follow:**
- `src/app/(authenticated)/(app)/(default)/admin/people/[id]/permissions/page.tsx` — `getUserAuthorityData` usage
- `src/components/authority-editor.tsx` — grant label strings

**Test scenarios:**
- Happy path: member is President (global) + Head of Partnerships (dept) — Positions list shows "President — Organization" and "Head of Partnerships — Department"
- Happy path: member has Super Admin grant — App permissions shows "Super Admin — All resources"
- Edge case: member with no positions — "No positions." shown under Positions
- Edge case: member with no grants — "No app permissions." shown under App permissions
- Happy path: "Edit permissions" button links to `/admin/people/${userId}/permissions`

**Verification:**
- Section renders with correct labels for a member with known authority data
- Empty states show for a member with no positions and no grants

---

### U9. Page orchestration — wire new components, remove old ones

**Goal:** Update `page.tsx` to use the new section components, remove `ActiveSessionsCard` and `AdminActionCards`, and thread the right permission booleans to the right components.

**Requirements:** R1–R10 (integration)

**Dependencies:** U3, U4, U5, U6, U7, U8

**Files:**
- Modify: `src/app/(authenticated)/(app)/(default)/admin/people/[id]/page.tsx`
- Delete: `src/app/(authenticated)/(app)/(default)/admin/people/[id]/active-sessions-card.tsx`
- Delete: `src/app/(authenticated)/(app)/(default)/admin/people/[id]/admin-action-cards.tsx`

**Approach:**
- Replace the `ProfileSection` import with `MembershipCard` (from `membership-card.tsx`)
- Add `MemberSummaryStrip` between the header and the first card
- Add `PermissionsSection` (gated by `canManageAuthority`) below the payment section
- Remove `ActiveSessionsCard` from the render tree and delete the file
- Remove `AdminActionCards` from the render tree and delete the file
- Thread to header: add `canImpersonate`, `userId`, `userEmail` props to `<MemberHeader>`
- Thread to membership card: add `canPropose: canProposeMembership`, `canRemove: canRemoveMember` props
- Ensure `canManageAuthority` (`users.manage_authority`) resolves in the `Promise.all` at the top (already present)
- Section order in JSX: breadcrumb → back button → `<MemberHeader>` → `<MemberSummaryStrip>` → `<MembershipCard>` → `<ContactCard>` → `<PaymentSection>` (gated) → `<GroupsCard>` (gated) → `<PermissionsSection>` (gated)
- Remove `canRemoveMember` and `canProposeMembership` from the `AdminActionCards` call site (those are now threaded to `MembershipCard`)

**Patterns to follow:**
- Existing `page.tsx` — `Promise.all` for permission checks, `Suspense` wrapper per section

**Test scenarios:**
- Integration: full page renders without error for an admin viewer (all sections visible)
- Integration: department viewer — payment section absent, permissions section absent
- Integration: viewer with `membership.cancel_member` only — payment section visible, Propose absent from menu
- Happy path: section order is header → summary strip → membership → contact → payment → groups → permissions

**Verification:**
- `npm run lint` passes
- TypeScript compiles without error
- No imports of `ActiveSessionsCard` or `AdminActionCards` remain

---

### U10. Update `loading.tsx` skeleton

**Goal:** Update the route-level skeleton to match the new section layout.

**Requirements:** R9

**Dependencies:** U9 (final section order confirmed)

**Files:**
- Modify: `src/app/(authenticated)/(app)/(default)/admin/people/[id]/loading.tsx`

**Approach:**
- New skeleton order mirrors U9 section order: back button → header (avatar centred on mobile, left-aligned on desktop) → summary strip (four skeleton pills in a row) → Membership card → Contact card → Payment section → Groups section → Roles & permissions section
- Remove the ActiveSessionsCard skeleton block
- Remove the AdminActionCards skeleton block
- Summary strip skeleton: four inline `<Skeleton className="h-10 w-24 rounded-md" />` items in a flex row

**Patterns to follow:**
- Existing `loading.tsx` — `Skeleton` component usage, `space-y-6` container

**Test scenarios:**
- Test expectation: none — pure visual skeleton; no behaviour to assert. Verify visually that the skeleton layout matches the loaded page structure at route navigation.

**Verification:**
- Skeleton section count matches the section count in the loaded page
- No references to removed components remain

---

## System-Wide Impact

- **Interaction graph:** `page.tsx` is the sole orchestrator; all permission booleans resolved there and passed down. No middleware or observer side-effects.
- **Error propagation:** each section is wrapped in `<Suspense>`; a data fetch failure in one section does not crash others.
- **State lifecycle risks:** `getUserDetails` and `getUserAuthorityData` are both `cache()`-wrapped — multiple calls within the same request share the result. No duplicate DB round-trips.
- **API surface parity:** `getMemberSinceDate` and `getActivePaymentTerm` in `src/db/membership.ts` are unchanged. `getUserGroupMemberships` is kept (remove only after verifying no other callers).
- **Unchanged invariants:** sub-pages (`/propose`, `/remove`, `/permissions`) are not modified; their routes remain valid. Contact card is unchanged.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `joinedAt` backfill produces approximate dates for long-standing members | Accepted per requirements; "best-guess" framing documented in origin doc |
| TanStack Table adds bundle weight to two new client components | Both are detail-page-only; no global bundle impact |
| Removing `AdminMembershipNoticeBlock` loses visibility of membership notices for admins | Documented in Deferred to Follow-Up Work; not a regression of any stated requirement |
| `getUserGroupMemberships` may be used elsewhere; renaming breaks callers | Check for other callers before deleting; keep old export if needed |

---

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-23-admin-member-detail-redesign-requirements.md](docs/brainstorms/2026-05-23-admin-member-detail-redesign-requirements.md)
- Design reference: `Desktop _ admin content area.html` and `Mobile _ iPhone (1).html` (provided by user)
- Related code: `src/components/people-table.tsx`, `src/db/people.ts`, `src/components/authority-editor.tsx`
- Related plan (listing page / permission model): `docs/plans/2026-05-23-001-feat-admin-member-view-revamp-plan.md`
