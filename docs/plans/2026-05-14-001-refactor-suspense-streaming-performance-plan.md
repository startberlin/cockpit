---
title: "refactor: Suspense streaming and per-request cache deduplication"
type: refactor
status: active
date: 2026-05-14
---

# refactor: Suspense Streaming and Per-Request Cache Deduplication

## Summary

Replace the universal "await-all-then-render" pattern with co-located data fetching and React Suspense boundaries across all main app routes. Pages will stream their shell immediately after auth checks complete, then each section will independently populate as its DB queries resolve — each showing a `<Skeleton>` fallback until ready. React's `cache()` deduplicates shared per-request queries (`getUserAuthority`, `getActiveLegalMembership`) so splitting fetching across sub-components does not multiply DB round-trips.

---

## Problem Frame

Every authenticated page today blocks on its slowest DB query before streaming a single byte. `page.tsx` awaits a `Promise.all` of all data, passes the resolved bundle to a `page-client.tsx` client component, and only then does the browser receive anything. The one exception is the GoCardless payment history table (Suspense + `React.use()`) — this plan extends that proven approach to the rest of the application.

---

## Requirements

- R1. Pages begin streaming HTML before all DB queries complete.
- R2. Each distinct page section shows a skeleton fallback independently while its data loads.
- R3. No data staleness is introduced — only React `cache()` (per-request deduplication) is used. No ISR, route cache, `unstable_cache`, or `cache: 'force-cache'` is introduced.
- R4. Shared per-request queries (`getCurrentUser`, `getUserAuthority`, `getActiveLegalMembership`) are deduplicated across concurrent Suspense subtrees within the same request.
- R5. Existing client-side behaviour (TanStack Query polling in `MembershipHeroCard`, server actions, URL search params via Nuqs) is preserved without regression.

---

## Scope Boundaries

- No traditional caching — all data must reflect the latest DB state on every request.
- `MembershipHeroCard` client-side TanStack Query polling is not changed (appropriate for its live-status use case).
- Inngest background jobs, API routes, and server actions are not in scope.
- Email and external service integrations are not in scope.
- No new UI features — pure data-loading and streaming refactor.
- `getMemberSinceDate()` and `getGroupDetail()` have internal sequential DB queries; parallelising those query internals is follow-up work.

### Deferred to Follow-Up Work

- Parallelising the 3 sequential queries inside `getGroupDetail()`: deferred — the Suspense wrapper helps perceived performance even without internal parallelism.
- Instrumenting DB query durations to measure before/after improvement: valuable but separate.
- Adding `cache()` to `getDepartmentHeadForDepartment()`: assess during U3 implementation; add if called from multiple subtrees. `getMemberSinceDate()` uses a 3-query sequential waterfall with early returns — wrapping it in `cache()` provides no benefit since it is called exactly once in any render tree.

---

## Context & Research

### Relevant Code and Patterns

- `src/db/user.ts` — only existing `cache()` usage; `getCurrentUser = cache(async () => {...})` is the reference pattern.
- `src/db/authority.ts:125` — `getUserAuthority()` called by every `can()` invocation; not yet cached; multiple `can()` calls per page cause redundant queries.
- `src/db/membership.ts:12` — `getActiveLegalMembership()` called independently from `membership/page.tsx` and `membership/application/[step]/layout.tsx`; no deduplication today.
- `src/app/(authenticated)/(app)/payments/page.tsx` + `page-client.tsx:821` — the one existing Suspense example: `gcHistoryPromise` (unsettled `Promise`) passed as prop; client reads via `React.use()` inside `<React.Suspense fallback={<GcHistorySkeleton />}>`.
- `src/components/ui/skeleton.tsx` — primitive `<Skeleton className="...">` component; all new skeletons compose from it.

### Institutional Learnings

- No prior solutions documented for this area. When this work lands it is worth capturing conventions for: where `cache()` wrappers live (co-located with the DB function, not at call sites), and any interaction surprises between nested Suspense and the `(authenticated)` route-group layout auth awaits.

---

## Key Technical Decisions

- **`cache()` co-located with the DB function, not at call sites.** Matches the `getCurrentUser` pattern; callers automatically benefit with no changes required.
- **Co-located data fetching for server sub-components.** Sections become async server components that fetch their own data slice. `cache()` ensures shared queries run only once per request even when multiple subtrees call them.
- **Promise-passing for complex client components.** Where the page content is a full-featured client component that cannot be split (e.g., `DirectoryPageClient`, `GroupDetailClient`), the page creates promises without awaiting and the client reads them via `React.use()` inside a `<Suspense>` boundary.
- **`loading.tsx` for route-level instant shell.** Covers the gap between navigation click and when `page.tsx` completes its auth checks — different from component-level Suspense. Both layers are used together.
- **Skeleton components colocated with the feature.** Each feature area owns its own skeleton — avoids a centralised skeleton registry that becomes hard to navigate.
- **No `error.tsx` files exist today.** Unhandled promise rejections inside a Suspense boundary will cause an unrecoverable render crash. Adding `error.tsx` at the route level is part of this work.

---

## Open Questions

### Resolved During Planning

- **Is `cache()` safe for `getUserAuthority`?** Yes — `cache()` is per-request; no cross-request data bleed. Authority is constant within a single request.
- **`loading.tsx` or component-level Suspense only?** Both. `loading.tsx` covers the auth-check window; component-level Suspense handles independent section loading.
- **Is the promise-passing pattern safe with React 19?** Yes — already in production in this codebase (GC history).

### Deferred to Implementation

- Whether `getMemberSinceDate()` warrants `cache()` wrapping — depends on how many subtrees call it after the membership page refactor.
- Exact skeleton visual sizing for each section — match section dimensions during implementation.
- Whether the payments history table (search + pagination) should remain synchronous — if URL-driven re-fetch logic is simpler that way, keeping it synchronous is acceptable.

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

**Before (current universal pattern):**
```
layout.tsx: await getCurrentUser() + getUserAuthority()
  └─ page.tsx: await Promise.all([A, B, C, D])   ← browser receives nothing until slowest query
       └─ PageClient: renders with all resolved data
```

**After (streaming pattern):**
```
layout.tsx: await getCurrentUser() + getUserAuthority()  ← cached, fast
  loading.tsx: instant skeleton shell while page.tsx runs
    └─ page.tsx: await getCurrentUser() + can()   ← fast with cache()
         │
         │  Pattern A — server sub-component (preferred: display-only, independent data)
         ├─ <Suspense fallback={<ASkeleton/>}><AsyncSectionA userId/>
         │                                         └─ await focusedQueryA(userId)
         │
         │  Pattern B — URL-driven dialog state (preferred over client boolean state)
         ├─ <GroupList groups={await listGroups()} />
         │  <CreateGroupDialog open={nuqsParam} />  ← no client boundary for data
         │
         │  Pattern C — promise-passing (only for genuinely interactive client components)
         └─ <Suspense fallback={<CSkeleton/>}><ClientComponent promiseC={promiseC}/>
                                                └─ React.use(promiseC) inside child
```

Prefer Pattern A for sections that are pure display. Use Pattern B to eliminate client boundaries driven by dialog state. Fall back to Pattern C only when the component has URL-driven state or complex optimistic mutations that require client ownership.

---

## Implementation Units

### U1. Add cache() to getUserAuthority and getActiveLegalMembership

**Goal:** Deduplicate the two most-called shared per-request DB functions so concurrent Suspense subtrees don't multiply DB round-trips.

**Requirements:** R3, R4

**Dependencies:** None

**Files:**
- Modify: `src/db/authority.ts`
- Modify: `src/db/membership.ts`

**Approach:**
- Wrap `getUserAuthority()` with `cache()` from `react`, matching the `getCurrentUser` pattern in `src/db/user.ts`. Every `can()` invocation in a single render will share the same DB result.
- Wrap `getActiveLegalMembership()` with `cache()`. The membership application layout and page currently call it independently; with `cache()` this collapses to one round-trip per request.
- No callers need to change.

**Patterns to follow:**
- `src/db/user.ts` lines 4–8 — `import { cache } from "react"` + `export const fn = cache(async () => {...})` pattern.

**Test scenarios:**
- Happy path: a page that calls `can()` twice in sequence issues exactly one `getUserAuthority` DB query (verify via mock/spy on the DB call).
- Happy path: membership application layout + page both call `getActiveLegalMembership` with the same userId; DB query count is 1.
- Integration: two concurrent requests each see their own independent `cache()` scope — no cross-request data bleed (React guarantees this; document the invariant in a comment).

**Verification:**
- `getUserAuthority` and `getActiveLegalMembership` are wrapped with `cache()` in their respective source files.
- No call sites changed.
- Existing `can()` and permission check tests pass.

---

### U2. Add loading.tsx route-level skeleton shells and error.tsx boundaries

**Goal:** Every main app route shows a skeleton instantly on navigation (before `page.tsx` auth checks complete) and has an error boundary so a failed section doesn't crash the page.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Create: `src/app/(authenticated)/(app)/membership/loading.tsx`
- Create: `src/app/(authenticated)/(app)/payments/loading.tsx`
- Create: `src/app/(authenticated)/(app)/people/directory/loading.tsx`
- Create: `src/app/(authenticated)/(app)/people/directory/[id]/loading.tsx`
- Create: `src/app/(authenticated)/(app)/groups/loading.tsx`
- Create: `src/app/(authenticated)/(app)/groups/[id]/loading.tsx`
- Create: `src/app/(authenticated)/(app)/membership/error.tsx`
- Create: `src/app/(authenticated)/(app)/payments/error.tsx`
- Create: `src/app/(authenticated)/(app)/people/directory/error.tsx`
- Create: `src/app/(authenticated)/(app)/groups/error.tsx`

**Approach:**
- Each `loading.tsx` exports a default component returning a coarse skeleton matching that page's rough layout (card grids, table rows) using `<Skeleton>`. These are intentionally coarse — inner Suspense boundaries in U3–U7 provide finer-grained skeletons.
- Each `error.tsx` is a client component that renders a simple error card ("Something went wrong") with a retry button (`reset` prop). This prevents a rejected promise inside a Suspense boundary from crashing the entire page.
- `loading.tsx` covers the window between navigation click and when `page.tsx` completes its initial auth checks; inner Suspense (U3–U7) handles section-level loading after that.

**Patterns to follow:**
- `src/components/ui/skeleton.tsx` for the primitive.
- Existing `GcHistorySkeleton` in `src/app/(authenticated)/(app)/payments/page-client.tsx` for skeleton composition style.
- Next.js `error.tsx` convention — must be `"use client"`, receive `{ error, reset }` props.

**Test scenarios:**
- Test expectation: none — these are pure UI/infrastructure files with no domain logic to unit-test.

**Verification:**
- Navigating to each listed route in a throttled browser shows a skeleton immediately rather than a blank content area.
- Deliberately throwing inside a page section shows the error card rather than a blank or crashed page.

---

### U3. Membership page — co-located data fetching with independent Suspense sections

**Goal:** Refactor the membership page so each visible section fetches its own data and resolves independently, rather than blocking on the slowest of four parallel queries.

**Requirements:** R1, R2, R3, R4, R5

**Dependencies:** U1, U2 (error.tsx required before introducing Suspense boundaries)

**Files:**
- Modify: `src/app/(authenticated)/(app)/membership/page.tsx`
- Modify: `src/app/(authenticated)/(app)/membership/onboarding.tsx`
- Modify: `src/app/(authenticated)/(app)/membership/membership-details-card.tsx`
- Modify: `src/app/(authenticated)/(app)/membership/contact-details-card.tsx`
- Create: `src/app/(authenticated)/(app)/membership/membership-details-skeleton.tsx`
- Create: `src/app/(authenticated)/(app)/membership/contact-details-skeleton.tsx`

**Approach:**
- `page.tsx` retains only `getCurrentUser()` and the redirect guards. The `Promise.all` and all data queries are removed.
- `MembershipPageContent` (in `onboarding.tsx`) transitions from a pure render component (receiving resolved data as props) to an async server component receiving just `user` as the fast, already-resolved value. It initiates data fetches directly using the `cache()`-wrapped functions from U1.
- Sections that resolve immediately (hero card — only needs `user` + `activeLegalMembership` from the cache) render without an inner Suspense boundary.
- `MembershipDetailsCard` (needs `getMemberSinceDate` — up to 3 sequential DB queries — plus `getDepartmentHeadForDepartment`) is wrapped in `<Suspense fallback={<MembershipDetailsSkeleton />}>`.
- `ContactDetailsCard` needs only user profile fields already on the `user` object — no additional query needed; renders without Suspense.
- `MembershipHeroCard` is a client component using TanStack Query — unchanged.
- The conditional logic (`showBillingInfo`, `user.department` guard) moves into `MembershipPageContent` where it has direct access to the user object.

**Patterns to follow:**
- `src/app/(authenticated)/(app)/payments/page-client.tsx:821` — Suspense + fallback structure.
- `src/db/user.ts` — how `cache()` wrapping works.

**Test scenarios:**
- Happy path: membership page renders hero card and contact card without a skeleton delay; details card shows skeleton then resolves.
- Edge case: `showBillingInfo = false` — payment term query not initiated; no orphaned pending promise.
- Edge case: `user.department = null` — `getDepartmentHeadForDepartment` is not called.
- Edge case: `activeLegalMembership = null` — hero and notice sections render appropriate empty state, not a broken UI.
- Integration: `getActiveLegalMembership` called from multiple subtrees in the same request — DB query count is 1 (deduplication from U1).
- Regression: `MembershipHeroCard` TanStack Query polling behaviour is unaffected.

**Verification:**
- `page.tsx` contains no `Promise.all` and no data query awaits (only `getCurrentUser` + redirect guards).
- In throttled browser: hero card and contact card appear immediately; details card shows skeleton then populates.
- Existing `membership-hero-card.test.tsx` and `membership-notice-block.test.tsx` pass.

---

### U4. Payments page — server components for display sections, slim client for interactive parts

**Goal:** The payments page renders payment stats and proposed payments (both pure display, no client state) inside a large client component today. Extract these as async server components that stream independently. Shrink `PaymentsPageClient` to own only the URL-driven interactive parts.

**Requirements:** R1, R2, R5

**Dependencies:** U1, U2

**Files:**
- Modify: `src/app/(authenticated)/(app)/payments/page.tsx`
- Create: `src/app/(authenticated)/(app)/payments/payment-stats-section.tsx` — async server component
- Create: `src/app/(authenticated)/(app)/payments/proposed-payments-section.tsx` — async server component
- Create: `src/app/(authenticated)/(app)/payments/payment-stats-skeleton.tsx` (or colocate)
- Create: `src/app/(authenticated)/(app)/payments/proposed-payments-skeleton.tsx` (or colocate)
- Modify: `src/app/(authenticated)/(app)/payments/page-client.tsx` — remove stats and proposed rendering

**Approach:**
- Extract `PaymentStatsSection` as an async server component that calls `getPaymentStats()` directly. Wrap in `<Suspense fallback={<PaymentStatsSkeleton />}>` in `page.tsx`.
- Extract `ProposedPaymentsSection` as an async server component that calls `getProposedPayments()` directly. Wrap in `<Suspense fallback={<ProposedPaymentsSkeleton />}>` in `page.tsx`. The `selectedRow` lookup (currently `proposed.find(r => r.id === selected)`) moves into this section or is passed as a resolved prop to a client drawer wrapper.
- `PaymentsPageClient` is reduced to: the history table with its nuqs URL state (search, page, statuses), the status filter dropdown, search input, and the drawer Sheet.
- Payment history remains synchronously awaited in `page.tsx`. The history table is driven by URL params (search, page, statuses) via Nuqs that trigger full server re-renders — promise-passing would race against URL-driven re-renders and produce stale data. Synchronous is the correct approach here, not a tradeoff.
- The existing `gcHistoryPromise` pattern for the GoCardless drawer stays as-is (it depends on `selectedRow` client state).

**Patterns to follow:**
- U3 — async server sub-components fetching their own data as the reference shape.
- `src/app/(authenticated)/(app)/payments/page-client.tsx:821` — for the retained gcHistoryPromise + Suspense boundary.

**Test scenarios:**
- Happy path: payments page shell renders immediately; stats section shows skeleton then resolves; proposed section shows skeleton then resolves; history table renders synchronously; GC history continues working.
- Edge case: no proposed payments — proposed section resolves to empty state, not stuck skeleton.
- Edge case: `can("payments.manage")` check fails — redirect fires before any server components are rendered.
- Integration: `getPaymentStats` and `getProposedPayments` queries start concurrently; neither blocks the other.
- Regression: GC history Suspense section and drawer continue working unchanged.

**Verification:**
- Stats and proposed sections stream independently as server-rendered HTML.
- `PaymentsPageClient` no longer imports or renders stats or proposed data.
- GC history and history table behaviour unchanged.

---

### U5. People directory page — promise-passing for the heavy user table query

**Goal:** The people directory has two compounding performance issues: `getAllUserPublicData()` over-fetches (15+ columns selected for a 9-field type, full `legalMemberships` join for a single boolean) and the page blocks until this heavy query resolves. This unit fixes both: scope the query to the minimum needed, then pass it as a promise so the page shell renders while the query runs.

**Requirements:** R1, R2, R5

**Dependencies:** U1, U2

**Files:**
- Modify: `src/db/people.ts` — scope `getAllUserPublicData()` columns and replace legalMemberships join
- Modify: `src/app/(authenticated)/(app)/people/directory/page.tsx`
- Modify: `src/app/(authenticated)/(app)/people/directory/page-client.tsx`
- Create: `src/app/(authenticated)/(app)/people/directory/directory-table-skeleton.tsx` (or colocate)

**Approach:**
- **Query scoping first:** Audit `getAllUserPublicData()` in `src/db/people.ts` and remove all columns not present in the `PublicUser` type from the SELECT. Replace the `legalMemberships` join (which returns full rows) with an `EXISTS` or `COUNT` subquery that returns only the boolean/count needed for `hasActiveTenure`. This reduces DB row bytes and wire size independently of the Suspense changes.
- `page.tsx` initiates the three queries (`users`, `batches`, `pendingActions`) as unsettled promises without `await all(...)`, and passes them as props to `DirectoryPageClient`.
- `DirectoryPageClient` renders the page header (title, Add User button, Import button) and dialog components unconditionally — these must not suspend. A child `UserTableSection` component holds the `React.use(usersPromise)` call and is wrapped in `<Suspense fallback={<DirectoryTableSkeleton />}>` inside `DirectoryPageClient`. The `React.use()` call must not be at the top level of `DirectoryPageClient` itself, or the entire component (including header and dialogs) will suspend.
- `batches` and `pendingActions` are typically fast queries. During implementation, decide whether to also promise-pass them or await them eagerly — either is valid.
- `DirectoryTableSkeleton` matches the table's column structure (header row + multiple `<Skeleton>` rows) to minimise layout shift when the table resolves.

**Patterns to follow:**
- `src/app/(authenticated)/(app)/payments/page-client.tsx` — promise-passing + `React.use()` reference.

**Test scenarios:**
- Happy path: directory page renders shell and table skeleton immediately; table populates as user data resolves.
- Edge case: zero users — table resolves to the empty state, not a stuck skeleton.
- Edge case: `currentUser` is null — `pendingActions` resolves to `[]` (existing guard preserved).
- Regression: directory sorting, filtering, and search work correctly after the Suspense boundary resolves.

**Verification:**
- In throttled browser, directory page shell appears immediately and the table skeleton resolves to the populated table.
- Sorting and filtering are functionally identical after Suspense resolves.

---

### U6. People directory detail page — decomposed per-card queries with independent Suspense

**Goal:** Decompose the monolithic `getUserById` into focused per-card queries so each card resolves independently — profile details first, group memberships and authority data later. Each card fetches only the data it needs.

**Requirements:** R1, R2, R4

**Dependencies:** U1, U2

**Files:**
- Modify: `src/db/people.ts` — add `getUserDetails(id)`, `getUserGroupMemberships(id)`, `getUserAuthorityData(id)` as `cache()`-wrapped focused query functions
- Modify: `src/app/(authenticated)/(app)/people/directory/[id]/page.tsx`
- Modify: `src/app/(authenticated)/(app)/people/directory/[id]/profile-card.tsx`
- Modify: `src/app/(authenticated)/(app)/people/directory/[id]/contact-card.tsx` — refactor to server component
- Create: `src/app/(authenticated)/(app)/people/directory/[id]/copyable-field.tsx` — thin `"use client"` component for clipboard interactions only
- Modify: `src/app/(authenticated)/(app)/people/directory/[id]/groups-card.tsx`
- Modify: `src/app/(authenticated)/(app)/people/directory/[id]/authority-card.tsx`

**Approach:**
- Introduce focused query functions in `src/db/people.ts`, each wrapped with `cache()`:
  - `getUserDetails(id)` — user scalar fields (name, email, status, department, batch, etc.). Fast. Used by `ProfileCard` and `ContactCard`.
  - `getUserGroupMemberships(id)` — `usersToGroups` join with group data. Used by `GroupsCard`.
  - `getUserAuthorityData(id)` — `organizationPositions` and `accessGrants` joins. Used by `AuthorityCard`. Likely the slowest of the three.
- Each card becomes a pure async server component that calls its own focused query function. No data flows through `page.tsx` for these cards.
- `ContactCard` currently carries `"use client"` for copy-to-clipboard. Refactor: remove the `"use client"` directive, extract the clipboard interaction into a focused `CopyableField` client component that receives only a value and label as props. `ContactCard` becomes a server component calling `getUserDetails`.
- `page.tsx` wraps each card in its own `<Suspense fallback={<CardSkeleton />}>`. `ProfileCard` and `ContactCard` (sharing the fast `getUserDetails` query) resolve first. `GroupsCard` and `AuthorityCard` resolve as their respective queries complete.
- The two `can()` calls in `page.tsx` remain awaited (fast with U1).
- `getUserById` may be kept for any existing callers elsewhere but is no longer the source for these cards.

**Patterns to follow:**
- `src/db/user.ts` — `cache()` pattern.
- `src/app/(authenticated)/(app)/payments/page-client.tsx:821` — Suspense fallback structure.

**Test scenarios:**
- Happy path: ProfileCard and ContactCard populate first (fast scalar query); GroupsCard and AuthorityCard populate independently thereafter.
- Edge case: user not found — `getUserDetails` returns null; all cards redirect or render empty state.
- Edge case: requester lacks `users.view_details` permission — redirect fires in `page.tsx` before any cards render.
- Edge case: user has no group memberships — GroupsCard resolves to empty state, not stuck skeleton.
- Integration: `getUserDetails` called from two cards (ProfileCard + ContactCard) in the same render — DB query count is 1 (cache() deduplication).
- Regression: `CopyableField` clipboard functionality works after ContactCard is refactored to server component.

**Verification:**
- In throttled browser, ProfileCard and ContactCard populate before GroupsCard and AuthorityCard.
- DB query log shows three distinct focused queries, not one monolithic join.

---

### U7. Groups and batches pages — server rendering with URL-driven dialog state

**Goal:** Eliminate the client boundary for data rendering on the groups list and batches pages (their client components exist only to hold dialog open state). Move dialog open/close state to URL params via Nuqs, making these pages fully server-rendered. Apply streaming to group detail via promise-passing and parallelise its internal queries.

**Requirements:** R1, R2

**Dependencies:** U1, U2

**Files:**
- Modify: `src/app/(authenticated)/(app)/groups/page.tsx` — render groups list as server component
- Delete or gut: `src/app/(authenticated)/(app)/groups/page-client.tsx` — dialog state moves to URL
- Modify: `src/app/(authenticated)/(app)/groups/create-group-dialog.tsx` — read open state from Nuqs URL param
- Modify: `src/app/(authenticated)/(app)/groups/[id]/page.tsx`
- Modify: `src/app/(authenticated)/(app)/groups/[id]/page-client.tsx` — wrap group data in Suspense + React.use()
- Modify: `src/db/groups.ts` — parallelise `getGroupDetail()` internal queries
- Modify: `src/app/(authenticated)/(app)/people/batches/page.tsx` — render table as server component
- Modify: `src/app/(authenticated)/(app)/people/batches/page-client.tsx` — dialog state moves to URL (or extract minimal client components)
- Create skeleton files colocated with each page

**Approach:**

**Groups list (eliminate client boundary):**
- `GroupsPageClient`'s only client state is a dialog open boolean. Move dialog open/close to a Nuqs URL param (e.g., `?create=true`). `CreateGroupDialog` reads and writes the URL param using `useQueryState`.
- `GroupsPage` becomes a pure async server component: awaits `listGroupsForViewer()` / `listMemberGroupsForViewer()`, renders the group list and the dialog inline. No `page-client.tsx` needed for data rendering. Wrap the group list in `<Suspense>` if the query is meaningfully slow; otherwise await directly.

**Group detail (promise-passing + query parallelisation):**
- `getGroupDetail()` in `src/db/groups.ts` currently runs 3 sequential awaits (group lookup, members join, criteria). All three use the same `groupId` and are independent. Restructure to run all three with `Promise.all` (check group existence after resolution; return null if group is empty). This cuts wall time from `sum(q1+q2+q3)` to `max(q1,q2,q3)`.
- `GroupDetailClient` holds complex optimistic member-mutation state (member add/remove/role-change, criteria changes) — promise-passing is correct here. Pass the `getGroupDetail()` promise as an unsettled prop; wrap in `<Suspense>` in `page.tsx`.

**Batches (eliminate or minimise client boundary):**
- The batches query (`db.select().from(batch)`) is a single-table SELECT with no joins — trivially fast (< 1ms). Do not apply promise-passing here; await it synchronously.
- `BatchesPageClient` holds create/edit form state. Move dialog open/close to Nuqs URL params where practical; otherwise extract the minimal client components needed for forms. The table itself should be server-rendered.

**Patterns to follow:**
- Nuqs `useQueryState` for URL-driven dialog state — established pattern in the codebase.
- U4's `ProposedPaymentsSection` and `PaymentStatsSection` for the server component approach.
- `src/app/(authenticated)/(app)/payments/page-client.tsx:821` for the `GroupDetailClient` promise-passing shape.

**Test scenarios:**
- Happy path: groups list page is fully server-rendered; Create Group dialog opens/closes via URL param.
- Happy path: navigating to `/groups?create=true` directly opens the dialog.
- Happy path: group detail page shows skeleton while `getGroupDetail()` resolves; group info, members, and criteria populate.
- Happy path: batches page renders synchronously with table data.
- Edge case: user has no groups (member view) — list renders appropriate empty state.
- Edge case: group not found — `not-found.tsx` fires, not a stuck skeleton.
- Integration: `getGroupDetail()` executes group, members, and criteria queries in parallel — DB time is `max(q1,q2,q3)` not `sum`.
- Regression: group management interactions (member management, create group) work after refactor.

**Verification:**
- Groups list renders as server HTML with no client-side data fetching.
- Group detail page shows skeleton in throttled browser, then populates.
- Group and criteria queries in `getGroupDetail()` run concurrently (verifiable via query log).
- Batches page does not use promise-passing.

---

## System-Wide Impact

- **Interaction graph:** The `(app)` layout still awaits `getCurrentUser()` + `getUserAuthority()` synchronously before any page content streams — this is the shared latency floor for every route. U1 reduces authority query cost; the layout structure is unchanged. Each `loading.tsx` (U2) covers this window.
- **Error propagation:** Suspense does not catch errors. The `error.tsx` files added in U2 are the error boundary for all Suspense-wrapped sections within each route. Without them, a rejected promise crashes the page render. No `error.tsx` files exist today — U2 adds them.
- **State lifecycle risks:** `cache()` is per-request only (React guarantees this). No cross-request data bleed is possible. Promise payloads passed from server to client components must be JSON-serializable — all current data types (plain objects, date strings, arrays) are; class instances or non-serializable types must not be included in promise payloads.
- **API surface parity:** Server actions (next-safe-action) operate independently of the render tree and are not affected. URL-driven search parameters (Nuqs) on the directory and payments pages continue to work — Suspense boundaries do not affect URL state.
- **Integration coverage:** The payments page Suspense boundary is a live production example. All new boundaries follow the same pattern.
- **Unchanged invariants:** `MembershipHeroCard` TanStack Query polling, all server actions, all form behaviours, and all navigation patterns are unchanged.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| No `error.tsx` files exist today; a rejected promise inside Suspense crashes the page | U2 adds `error.tsx` at the route level before U3–U7 introduce Suspense boundaries — sequence matters |
| A section depends on another section's already-resolved data (implicit coupling) | Identify shared data, move it to `cache()`-wrapped functions callable from both; never pass resolved values between Suspense siblings |
| `MembershipPageContent` conditional rendering logic (`noticeType`, `showBillingInfo`, `showTools`) breaks when props change shape | Touch only the data-fetching layer; preserve all conditional display logic in place |
| Promise serialisation: non-serializable values in a promise payload cause a runtime error | Audit each promise payload type before passing to a client component; plain objects and primitives only |
| `cache()` confusion with persistent caching | Add a comment at each `cache()` call: `// Per-request deduplication only — not a persistent cache` |

---

## Sources & References

- Related code: `src/app/(authenticated)/(app)/payments/page-client.tsx:821` — existing Suspense reference implementation
- Related code: `src/db/user.ts:4–8` — `cache()` pattern reference
- Related code: `src/lib/permissions/server.ts` — `can()` helper that calls `getUserAuthority()`
