---
title: "feat: Admin members view revamp"
type: feat
status: active
date: 2026-05-23
origin: docs/brainstorms/2026-05-23-admin-member-view-revamp-requirements.md
---

# feat: Admin members view revamp

## Summary

Extends the permission model with two new actions (`users.view_inactive`, `user.payment.view`) and a dual-purpose rename (`user.view` → `user.view_details`), then rebuilds the Members listing and member detail pages so they are useful to department heads, legal officers, and finance viewers — not just admins. Adds three new sub-page routes (propose, remove, permissions) under the member detail and removes the old dialog-based action buttons.

---

## Problem Frame

(see origin: `docs/brainstorms/2026-05-23-admin-member-view-revamp-requirements.md`)

The admin People directory and member detail page were designed for full admins. Department viewers see unscoped member lists; legal and finance roles have no access to payment data or inactive-member filters; the detail page sections have no visual hierarchy; and consequential actions (remove member, propose membership) fire from single-click dialogs with no explanatory context.

---

## Requirements

- R1. Add `users.view_inactive` GlobalAction to the evaluator.
- R2. Add `user.payment.view` UserScopedAction to the evaluator.
- R3. Grant assignments for both new actions are determined in `evaluate.ts` only — not in pages or components.
- R4. All visibility gates use `can()` / `<Can>` / `useCan()` — no direct grant, position, or role checks in pages or components.
- R5–R13. Members listing: heading "Members", department-scoped results (R6), inactive-status filter presets gated by `users.view_inactive` (R7, R8, R9), legal membership state filter + join-date sort (R10), avatar+name column (R11), legal membership state badge+tooltip column (R12), existing columns/filters/pagination unchanged (R13).
- R6. `user.view_details` (renamed from `user.view`) replaces `users.view_all`; called without scope it gates the listing route; called with `targetDepartment` scope it filters rows and gates the detail page.
- R14–R15. Detail page: full-width sections in order (header → profile → contact → payment → onboarding → groups → admin actions), loading skeleton updated.
- R16–R19. Header + profile section with all required fields and admin-phrased contextual notices.
- R20. Contact section unchanged from current contact card.
- R21–R23. Payment section gated by `user.payment.view`; mandate status inferred from DB fields.
- R24–R25. Onboarding section: complete/not-complete badge + last active session timestamp.
- R26. Groups section gated by `groups.view_all`.
- R27–R29. Authority card removed; "Manage permissions" CTA for viewers with `users.manage_authority`.
- R30–R33. Admin action cards replace standalone buttons; admin actions section hidden when viewer has no applicable action; impersonate gets a confirmation dialog.
- R34, R34a, R35–R37. Propose membership sub-page with server-side auth; existing dialog removed.
- R38, R38a, R39–R41. Remove member two-step sub-page with server-side auth; existing dialog removed.
- R42–R43. Permissions sub-page at `[id]/permissions` gated by `users.manage_authority`; manages permission grants.

**Origin actors:** A1 (admin), A2 (legal/finance), A3 (dept head), A4 (subject member)
**Origin flows:** F1 (dept-scoped listing), F2 (propose membership sub-page), F3 (remove member sub-page)
**Origin acceptance examples:** AE1 (R6, R7, R8), AE2 (R8, R9), AE3 (R21, R23), AE4 (R19, R21, R23), AE5 (R31, R32), AE6 (R39, R40), AE7 (R28, R29)

---

## Scope Boundaries

- `targetStatus` in `UserScope` (unfinished from plan 2026-05-20-003) — not completed in this plan
- Business logic changes to the propose-membership or board-kick Inngest workflows
- GoCardless API integration beyond existing `getGcPaymentHistoryForMember` and `getActivePaymentTerm`
- Mobile-specific design optimizations; bulk actions from the listing page
- `user.edit.contact`, `user.edit.status`, `user.complete_onboarding` (also unfinished from plan 003)
- Authority (positions) sub-page — already exists separately; out of scope per R28

### Deferred to Follow-Up Work

- Complete `targetStatus` in `UserScope` (plan 003 intent): once landed, `user.payment.view` call sites must be updated to include `targetStatus`
- Dedicated `lastActiveAt` field on session table for more reliable "last active" display (see Risks)

---

## Context & Research

### Relevant Code and Patterns

- `src/lib/permissions/evaluate.ts` — add new actions here; switch case per action; no direct grant checks in UI
- `src/lib/permissions/server.ts` — `can()` overloads; extend for unscoped `user.view_details` call
- `src/components/can.tsx` — `<Can>`, `useCan()` — update to support unscoped `user.view_details`
- `src/db/people.ts` — `getAllUsersForAdmin` (listing query), `getUserDetails` (detail query); both extended in this plan
- `src/db/membership.ts` — `getMemberSinceDate(userId)` — reuse; do not reimplement
- `src/lib/membership-status.ts` — `getStructuredMembershipState()` — use for assembled membership + payment view
- `src/lib/gocardless/payments.ts` — `getGcPaymentHistoryForMember(gcCustomerId)`
- `src/db/membership-payments.ts` — `getActivePaymentTerm(userId)`
- `src/app/(authenticated)/(app)/(default)/membership/membership-notice-state.ts` — `deriveMembershipNotice()` pure function; reuse in a new admin-phrased block component
- `src/app/(authenticated)/(app)/(default)/admin/people/directory/[id]/update-grants-action.ts` — reuse for permissions sub-page
- `src/app/(authenticated)/(app)/(default)/admin/people/directory/[id]/authority-card.tsx` — extract `<AuthorityEditor>` grants-editing pattern, then delete file
- `src/app/(authenticated)/(app)/(default)/membership/cancel/[step]/(steps)/step-confirm.tsx` — remove-member Step 1 layout pattern
- `src/app/(authenticated)/(app)/(default)/membership/cancel/[step]/(steps)/step-details.tsx` — remove-member Step 2 checkboxes pattern

### Institutional Learnings

- Permission policy convention (`docs/solutions/conventions/reusable-permission-policy-api-2026-05-02.md`): server `can()` for enforcement, `<Can>`/`useCan()` for UI affordances only; add actions to `evaluate.ts` switch case; write allow/deny tests for every new action
- Pagination convention (`docs/solutions/conventions/pagination-server-pagecount-pattern-2026-05-18.md`): page-size constants must be unexported local constants in `src/db/`; never import DB modules in client components; server returns `{ rows, total, pageCount }`
- Member lifecycle (`docs/solutions/architecture-patterns/member-lifecycle-entry-points-and-application-flow-2026-05-10.md`): `legalMembershipState` and `status` are independent fields; use `getStructuredMembershipState()` for the combined view
- Payment journey (`docs/solutions/architecture-patterns/membership-journey-vs-payment-journey-2026-05-12.md`): mandate status = `gocardlessMandateId !== null`; never check `user.status` for payment gating
- Skeleton sync (`CLAUDE.md`): update `loading.tsx` and component skeletons whenever page structure changes — treat as a hard requirement

---

## Key Technical Decisions

- **`user.view_details` unscoped overload:** `can()` in `server.ts` gains a new overload for calling `user.view_details` without a resource; internally evaluates `admin || peopleAdmin || isDeptHead(any)` from the already-loaded authority object — no DB query. `<Can>` and `useCan()` are updated to support the same unscoped form. `users.view_all` is removed from the evaluator entirely. Implementation note: the existing `evaluateAuth` type guard at `evaluate.ts:262-265` blocks unscoped UserScopedAction calls at runtime — the unscoped overload in `server.ts` must evaluate `hasAdminGrant || hasPeopleAdminGrant || isDepartmentHead` directly (without routing through `evaluateAuth`) rather than patching the evaluator's dispatch logic. This means the unscoped path lives entirely in `server.ts` and is tested via the server.ts test scenarios, not `evaluateAuth`.
- **Grant assignments for new actions:** `users.view_inactive` and `user.payment.view` both granted to: admin grant, `isLegalOfficer` (president/VP/head_of_finance), `hasFinanceAdminGrant`. Not granted to `people_admin` or department heads.
- **Dept-head scoping in listing page:** viewer's department is extracted from their authority positions server-side and passed as the forced `department` filter — URL `?department=` param is ignored for dept heads, preventing bypasses.
- **Mandate status inferred from DB:** `gocardlessMandateId !== null` → active; `gocardlessCustomerId` non-null + `gocardlessMandateId` null → cancelled; both null → never set up. No live GoCardless API call needed.
- **`deriveMembershipNotice` reused unchanged:** a new `admin-membership-notice-block.tsx` component calls the same pure function from `membership-notice-state.ts` but renders admin-phrased copy ("This member needs to set up their direct debit" rather than "Set up your direct debit").
- **`image` field added to `getUserDetails`:** the field exists on the user table but is not currently returned; added alongside the profile section refactor.
- **Impersonate dialog:** R33 requires a confirmation dialog; the existing `impersonate-action.ts` is unchanged — only the button component gains a `<Dialog>` wrapper.
- **Sub-page auth at route level:** `propose/` and `remove/` sub-pages enforce their respective `can()` checks server-side on every load, redirecting to `[id]` on failure, regardless of how the URL was reached.

---

## Open Questions

### Resolved During Planning

- Which grants receive `users.view_inactive` and `user.payment.view`: admin, isLegalOfficer, hasFinanceAdminGrant (see Key Technical Decisions)
- Listing dept-head scoping approach: authority-derived forced filter, server-side (see Key Technical Decisions)
- Mandate status fetch: inferred from DB fields, no live API call (see Key Technical Decisions)

### Deferred to Implementation

- Whether `<Can permission="user.view_details">` unscoped in `can.tsx` is best implemented as a new CanProps union overload or a duck-typed no-context fallback — both produce equivalent runtime behavior; TypeScript shapes are an implementation detail. Note: the existing `evaluateAuth` type guard at `evaluate.ts:262-265` (`if (!hasUserScope(scope) || !isUserScopedAction(action)) { return false; }`) blocks unscoped UserScopedAction calls at runtime — the server.ts overload must route the unscoped `user.view_details` case before the main `evaluateAuth` dispatch or handle it directly (admin || peopleAdmin || isDeptHead(any)) without calling `evaluateAuth` with a missing scope.

### Resolved During Review

- Exact query path for `LegalMembershipStatus | null` fed to `deriveMembershipNotice`: `getActiveLegalMembership(userId)` from `src/db/membership.ts` — already resolved in U6 approach above. Note: `LegalMembershipState` from the user record (`"not_member" | "active_member" | "former_member"`) is a distinct, coarser type — it cannot substitute for `LegalMembershipStatus | null`.

---

## Implementation Units

### U1. Permission model — evaluator + can() API

**Goal:** Rename `user.view` → `user.view_details`; add `users.view_inactive` and `user.payment.view`; implement unscoped `can("user.view_details")` overload; remove `users.view_all`.

**Requirements:** R1, R2, R3, R4, R6

**Dependencies:** None

**Files:**
- Modify: `src/lib/permissions/evaluate.ts`
- Modify: `src/lib/permissions/server.ts`
- Modify: `src/lib/permissions/index.ts`
- Modify: `src/components/can.tsx`
- Test: `src/lib/permissions/permissions.test.ts`
- Test: `src/lib/permissions/permissions.typecheck.ts`

**Approach:**
- In `evaluate.ts`: rename `"user.view"` → `"user.view_details"` in `userScopedActions` array and `UserScopedAction` union; add `"users.view_inactive"` to `globalActions` with evaluator logic `hasAdminGrant || isLegalOfficer || hasFinanceAdminGrant`; add `"user.payment.view"` to `userScopedActions` with evaluator logic `hasAdminGrant || isLegalOfficer || hasFinanceAdminGrant`; remove `"users.view_all"` from `globalActions`; update all switch cases
- In `server.ts`: add new overload `can("user.view_details")` with no resource — evaluates from authority only (admin || peopleAdmin || isDeptHead(any)); update existing user-scoped overload from `user.view` → `user.view_details`
- In `can.tsx`: update `<Can>` and `useCan()` to support calling `user.view_details` without a `context` prop, mirroring the unscoped server-side overload
- In `permissions.typecheck.ts`: update the `@ts-expect-error` guard comment (currently reads `can("user.view")` — must read `can("user.view_details")`); remove `evaluateAuth(authority, "users.view_all")` call and replace with a call to `evaluateAuth(authority, "users.view_inactive")`
- In `permissions.test.ts`: rename the `describe("users.view_all", ...)` block (7 test cases) to `describe("users.view_inactive", ...)` and update its test cases to reflect the new action name and evaluator logic; update all `"user.view"` references in `isUserScopedAction` tests to `"user.view_details"`

**Patterns to follow:**
- Existing switch-case structure in `evaluate.ts`; permission convention doc

**Test scenarios:**
- Happy path: admin authority → `user.view_details` scoped to any dept → `true`
- Happy path: `isLegalOfficer` → `users.view_inactive` → `true`
- Happy path: `hasFinanceAdminGrant` → `user.payment.view` (any dept) → `true`
- Happy path: admin → unscoped `can("user.view_details")` → `true`
- Happy path: any dept head → unscoped `can("user.view_details")` → `true`
- Happy path: dept head (Engineering) → `can("user.view_details", { department: "engineering" })` → `true`
- Edge case: dept head (Engineering) → `can("user.view_details", { department: "growth" })` → `false`
- Error path: plain member → `users.view_inactive` → `false`
- Error path: `people_admin` → `users.view_inactive` → `false`
- Error path: `people_admin` → `user.payment.view` → `false`
- Error path: dept head → `user.payment.view` → `false`
- Error path: any authority → `"users.view_all"` → TypeScript compile error (action removed)
- Integration: `isUserScopedAction("user.view_details")` → `true`; `isGlobalAction("users.view_inactive")` → `true`

**Verification:**
- `npm run lint` passes with no type errors
- All new test scenarios pass; existing tests updated to new action names
- `users.view_all` not referenced in any non-test source file

---

### U2. Call site updates — rename user.view, replace users.view_all

**Goal:** Update all runtime call sites from `user.view` → `user.view_details` and from `users.view_all` → unscoped `user.view_details`.

**Requirements:** R4, R6

**Dependencies:** U1

**Files:**
- Modify: `src/app/(authenticated)/(app)/(default)/admin/people/layout.tsx`
- Modify: `src/app/(authenticated)/(app)/(default)/admin/people/directory/page.tsx`
- Modify: `src/app/(authenticated)/(app)/(default)/admin/people/directory/[id]/page.tsx`
- Modify: `src/components/nav-main.tsx`
- Modify: `src/app/(authenticated)/(app)/(default)/groups/[id]/page-client.tsx`
- Modify: `src/components/people-table.tsx`
- Test: `src/lib/permissions/permissions.typecheck.ts`

**Approach:**
- `admin/people/layout.tsx`: `can("users.view_all")` → unscoped `can("user.view_details")`
- `directory/page.tsx`: same replacement for the page-level guard
- `[id]/page.tsx`: `can("user.view", user)` → `can("user.view_details", { targetDepartment: member.department })` — pass the *member's* department, not the viewer's, so a dept head for Engineering cannot access a Growth member's detail page via direct URL
- `nav-main.tsx`: `<Can permission="users.view_all">` → `<Can permission="user.view_details">` (no context prop)
- `groups/[id]/page-client.tsx` and `people-table.tsx`: `"user.view"` → `"user.view_details"` in `useCan` / `can()` calls

**Test scenarios:**
- TypeScript compilation is the completeness check — any missed call site fails to compile
- Integration: dept head navigating to `/admin/people/directory` is not redirected
- Integration: plain member navigating to `/admin/people/directory` is redirected
- Integration: Directory nav item visible for admin, people_admin, any dept head; hidden for plain member and finance_admin

**Verification:**
- Zero TypeScript errors after rename
- `users.view_all` not referenced in any non-test file

---

### U3. Listing query — extend data layer + dept-head scoping

**Goal:** Extend `getAllUsersForAdmin` to return `legalMembershipState` and support join-date sort; enforce dept-head department scoping server-side in the listing page.

**Requirements:** R6, R7, R10, R12

**Dependencies:** U2

**Files:**
- Modify: `src/db/people.ts`
- Modify: `src/app/(authenticated)/(app)/(default)/admin/people/directory/page.tsx`

**Approach:**
- In `getAllUsersForAdmin`: add `legalMembershipState` and `memberSinceDate` to selected columns; add `sortBy?: "name" | "joinDate"` parameter; `"joinDate"` orders by `memberSinceDate asc nulls last, createdAt asc` as fallback; update the return type to include both new fields
- In `directory/page.tsx`: load viewer's authority; if viewer is a dept head (not admin or peopleAdmin), extract their department from positions and force the `department` filter — URL `?department=` param is ignored; dept heads cannot set status to include inactive statuses; pass `sortBy` from nuqs param

**Patterns to follow:**
- Pagination convention: local unexported page-size constant; return `{ rows, total, pageCount }`; no DB constants exported
- Existing `getAllUsersForAdmin` column selection pattern
- Authority positions array iteration to derive `targetDepartment` for the viewer

**Test scenarios:**
- Happy path: dept head for Engineering — query forced to `department = "engineering"` regardless of URL param
- Happy path: admin with no dept filter — all departments returned
- Happy path: `sortBy: "joinDate"` — results ordered ascending by memberSinceDate
- Edge case: dept head with `?department=growth` in URL — "growth" ignored, dept head's dept forced
- Edge case: `memberSinceDate` is null — falls back to `createdAt` in sort order
- Error path: dept head with inactive status params in URL — inactive statuses excluded

**Verification:**
- Dept head sees only their department's members
- `legalMembershipState` and `memberSinceDate` present in row data
- Join-date sort works with null fallback

---

### U4. Listing page UI — filter presets, sort, columns, skeleton

**Goal:** Add filter presets (Alumni/Cancelled gated by `users.view_inactive`), join-date sort control, avatar+name column, legal membership state badge+tooltip column; update loading skeleton.

**Requirements:** R5, R7, R8, R9, R10, R11, R12, R13, R15

**Dependencies:** U3

**Files:**
- Modify: `src/components/people-table.tsx`
- Modify: `src/app/(authenticated)/(app)/(default)/admin/people/directory/page-client.tsx`
- Modify: `src/app/(authenticated)/(app)/(default)/admin/people/directory/loading.tsx`

**Approach:**
- Filter presets are convenience buttons that write to the existing `?status=` (multi-value) URL param — they are not their own URL parameter. Clicking "Active members" sets `?status=member,supporting_alumni`; "Onboarding" sets `?status=onboarding`; "Alumni" sets `?status=alumni`; "Cancelled / Former" sets `?status=cancelled`. Default = no `?status=` param → server applies active-status filter (onboarding, member, supporting_alumni) per R7 for viewers without `users.view_inactive`; for viewers with `users.view_inactive`, no `?status=` param shows all statuses.
- "Alumni" and "Cancelled / Former" preset buttons rendered only when `useCan("users.view_inactive")` is true
- Legal membership state filter: nuqs param; maps to `legalMembershipState` column
- Sort control: "Name" (default) / "Join date" nuqs param, `shallow: false`
- Name column: `<Avatar>` + `<AvatarImage src={user.image}>` + `<AvatarFallback>` initials, alongside name
- Legal membership state column: `<Badge>` + shadcn `<Tooltip>` with descriptive text per state value; use `LEGAL_MEMBERSHIP_STATE_LABELS` pattern
- Page heading: "Members"
- `loading.tsx`: update skeleton to reflect filter bar + sort control additions

**Patterns to follow:**
- Nuqs `useQueryState` with `shallow: false` for filter/sort params
- `<Avatar>` pattern from `membership-details-card.tsx`
- Tooltip pattern from existing badge usage; `LEGAL_MEMBERSHIP_STATE_LABELS` from `profile-card.tsx`

**Test scenarios:**
- Covers AE1: dept head → "Alumni" and "Cancelled / Former" preset buttons absent from DOM
- Covers AE2: viewer with `users.view_inactive` → "Cancelled / Former" preset shows only cancelled members; "Alumni" preset shows only alumni members
- Happy path: legal membership state filter applied → only matching members shown
- Happy path: join-date sort → table reorders correctly
- Happy path: avatar shown next to name; initials fallback when `image` is null
- Happy path: legal membership state badge renders with tooltip for all three values (`not_member`, `active_member`, `former_member`)
- Edge case: no members match active filter → empty state, not an error

**Verification:**
- Filter presets work end-to-end (URL param → server fetch → filtered rows)
- Legal membership state badge + tooltip present for all state values
- Loading skeleton matches updated filter bar layout

---

### U5. Detail page structure + header + loading skeleton

**Goal:** Replace the 2×2 card grid with ordered full-width sections each wrapped in a Suspense boundary; build the member header component; update `loading.tsx`.

**Requirements:** R14, R15, R16

**Dependencies:** U1

**Files:**
- Modify: `src/app/(authenticated)/(app)/(default)/admin/people/directory/[id]/page.tsx`
- Modify: `src/app/(authenticated)/(app)/(default)/admin/people/directory/[id]/loading.tsx`
- Create: `src/app/(authenticated)/(app)/(default)/admin/people/directory/[id]/member-header.tsx`

**Approach:**
- `page.tsx`: replace `md:grid-cols-2` div with vertically-stacked `<Suspense>` boundaries in order: header → profile → contact → payment (gated) → onboarding → groups (gated) → admin actions (gated); each section has its own Suspense fallback skeleton
- `member-header.tsx`: server async component; calls `getUserDetails(userId)`; renders `<Avatar>` (image + initials fallback), full name, START email, status badge using `USER_STATUS_INFO`
- `loading.tsx`: replace 2×2 grid skeleton with vertical section stubs matching new layout order

**Patterns to follow:**
- Existing per-card Suspense pattern in `[id]/page.tsx`
- `USER_STATUS_INFO` badge from `profile-card.tsx`
- Avatar pattern from `membership-details-card.tsx`

**Test scenarios:**
- Happy path: page renders sections vertically in the defined order
- Happy path: header shows avatar, name, email, status badge
- Edge case: `user.image` null → avatar shows initials fallback
- Integration: one section's Suspense failing does not block other sections from rendering

**Verification:**
- No 2×2 grid in rendered output; sections are full-width and stack vertically
- `loading.tsx` skeleton matches section count and order

---

### U6. Profile section + contextual notices

**Goal:** Build the full-width profile section with all R17 fields; add admin-phrased contextual notice block inline; extend `getUserDetails` to return `image`.

**Requirements:** R17, R18, R19, R23

**Dependencies:** U5

**Files:**
- Create: `src/app/(authenticated)/(app)/(default)/admin/people/directory/[id]/profile-section.tsx`
- Create: `src/app/(authenticated)/(app)/(default)/admin/people/directory/[id]/admin-membership-notice-block.tsx`
- Modify: `src/db/people.ts` (add `image` to `getUserDetails` return)
- Delete: `src/app/(authenticated)/(app)/(default)/admin/people/directory/[id]/profile-card.tsx`

**Approach:**
- `profile-section.tsx`: server async component; calls `getUserDetails(userId)`, `getMemberSinceDate(userId)`, and `getActiveLegalMembership(userId)` from `src/db/membership.ts` for the `LegalMembershipStatus | null` value required by `deriveMembershipNotice()` — `legalMembershipState` on the user record is a different, coarser type and cannot be substituted; fetches dept head info (name + avatar) from authority data for the member's department; displays all R17 fields; renders `<AdminMembershipNoticeBlock>` inline adjacent to relevant fields
- `admin-membership-notice-block.tsx`: calls `deriveMembershipNotice()` from `membership-notice-state.ts`; renders admin-phrased copy for each notice type; payment-related notices (`payment_cancelled`, `payment_not_started`) wrapped in `<Can permission="user.payment.view" context={user}>` so they only appear when the viewer has that permission
- `getUserDetails` in `people.ts`: add `image` column to the Drizzle select

**Patterns to follow:**
- `getMemberSinceDate(userId)` from `src/db/membership.ts` — do not reimplement fallback logic
- `getStructuredMembershipState()` for assembled state
- `LEGAL_MEMBERSHIP_STATE_LABELS` + badge+tooltip pattern from U4

**Test scenarios:**
- Covers AE4: viewer with `user.payment.view`, member with no mandate → "This member needs to set up their direct debit" notice shown in profile section
- Covers AE3: dept viewer (no `user.payment.view`) → no payment-related notice shown anywhere on page
- Happy path: `memberSinceDate` set → shows correct date and duration
- Edge case: `memberSinceDate` null → `getMemberSinceDate()` fallback to `createdAt` respected
- Edge case: member has no batch → batch field shows empty state gracefully
- Edge case: dept head of the member's department → dept head name + avatar displayed correctly

**Verification:**
- All R17 fields present in section output
- Payment-related notices absent when viewer lacks `user.payment.view`
- `getMemberSinceDate()` used, not reimplemented inline
- `profile-card.tsx` deleted; no orphaned imports

---

### U7. Payment section

**Goal:** Build the payment section gated by `user.payment.view`; show mandate status (inferred from DB), recent payment history, and next payment due.

**Requirements:** R21, R22, R23

**Dependencies:** U5

**Files:**
- Create: `src/app/(authenticated)/(app)/(default)/admin/people/directory/[id]/payment-section.tsx`
- Modify: `src/db/people.ts` (add `gocardlessMandateId`, `gocardlessCustomerId` to `getUserDetails` return type and Drizzle select)

**Approach:**
- `payment-section.tsx`: server async component; rendered in `page.tsx` only when `can("user.payment.view", user)` is true; calls `getUserDetails(userId)` for `gocardlessMandateId` / `gocardlessCustomerId` — these fields are currently fetched by the query but absent from the `UserDetails` interface; adding them here is required before U7 can infer mandate status; calls `getGcPaymentHistoryForMember(gocardlessCustomerId)` for up to 5 recent payments (slice to 5 in the component — `getGcPaymentHistoryForMember` has no limit parameter); calls `getActivePaymentTerm(userId)` for next payment due date
- Mandate status: active (`gocardlessMandateId !== null`), cancelled (`gocardlessCustomerId` non-null + `gocardlessMandateId` null), never set up (both null); null `gocardlessCustomerId` → skip the GC API call entirely
- `getActivePaymentTerm` returns `{ activationDate }` from which next-due date is derived

**Patterns to follow:**
- `getGcPaymentHistoryForMember` and `getActivePaymentTerm` existing signatures
- Payment/membership independence: check `gocardlessMandateId`, not `user.status`

**Test scenarios:**
- Covers AE3: viewer without `user.payment.view` → section absent from rendered output
- Happy path: active mandate → shows "Active", up to 5 recent payments listed, next due date shown
- Edge case: mandate never set up (both null) → shows "Not set up"; GC API not called
- Edge case: `gocardlessCustomerId` set, `gocardlessMandateId` null → shows "Cancelled"
- Edge case: no payment history returned → empty state, not an error
- Edge case: `getActivePaymentTerm` returns null → next payment due shows appropriate empty state

**Verification:**
- Payment section absent for viewers without `user.payment.view`
- All three mandate statuses render correctly
- Payment list capped at 5 entries
- No GoCardless API call when `gocardlessCustomerId` is null

---

### U8. Onboarding section, groups section, admin action cards

**Goal:** Add onboarding section (last active + complete status); migrate groups to full-width section style; replace standalone action buttons with descriptive action cards; add impersonate confirmation dialog; add "Manage permissions" CTA.

**Requirements:** R24, R25, R26, R27, R28, R29, R30, R31, R32, R33

**Dependencies:** U5 (structure); U10 must exist before U8's "Manage permissions" CTA link can be tested end-to-end — implement U10 before marking U8 verified

**Files:**
- Create: `src/app/(authenticated)/(app)/(default)/admin/people/directory/[id]/onboarding-section.tsx`
- Modify: `src/app/(authenticated)/(app)/(default)/admin/people/directory/[id]/groups-card.tsx`
- Create: `src/app/(authenticated)/(app)/(default)/admin/people/directory/[id]/admin-action-cards.tsx`
- Modify: `src/app/(authenticated)/(app)/(default)/admin/people/directory/[id]/impersonate-button.tsx`
- Delete: `src/app/(authenticated)/(app)/(default)/admin/people/directory/[id]/board-kick-button.tsx`
- Delete: `src/app/(authenticated)/(app)/(default)/admin/people/directory/[id]/propose-membership-button.tsx`
- Delete: `src/app/(authenticated)/(app)/(default)/admin/people/directory/[id]/authority-card.tsx`

**Approach:**
- `onboarding-section.tsx`: server async component; queries most recent session record for the target user (`ORDER BY updatedAt DESC LIMIT 1`); shows onboarding complete/incomplete badge and `session.updatedAt` as "Last active"; visible to all detail page viewers (gated by `user.view_details` only, same as the page)
- `groups-card.tsx`: keep query logic; change layout from card style to full-width section with heading; section only rendered when viewer has `groups.view_all`
- `admin-action-cards.tsx`: client component; renders a set of action cards with title + description; section only rendered when the viewer holds at least one applicable action (`users.impersonate`, `user.membership.propose`, or `membership.cancel_member`); impersonate card triggers an inline dialog; propose and remove cards are links navigating to their sub-pages
- `impersonate-button.tsx`: wrap existing immediate action in a `<Dialog>` with cancel + confirm buttons; `impersonate-action.ts` is unchanged
- `page.tsx`: add "Manage permissions" CTA link (gated by `can("users.manage_authority")`) in the authority section area; R28 — this is a link to `[id]/permissions`, not part of the action cards

**Patterns to follow:**
- Session query: `db.query.session.findFirst({ where: eq(session.userId, ...), orderBy: [desc(session.updatedAt)] })`
- Dialog pattern from `board-kick-button.tsx` (before deletion)
- `<Can>` wrapping for all permission-gated sections

**Test scenarios:**
- Covers AE5: dept viewer with only `user.membership.propose` → only "Propose for membership" card shown; impersonate and remove absent
- Covers AE7: viewer without `users.manage_authority` → no "Manage permissions" CTA shown
- Happy path: admin viewer → all three action cards shown; "Manage permissions" CTA shown
- Happy path: onboarding complete → "Complete" badge + last session timestamp shown
- Edge case: no session records for user → "Last active" shows "Never" or graceful empty state
- Edge case: viewer has no applicable action permissions → admin actions section not rendered (no empty section)
- Error path: impersonate dialog cancel → no action taken; dialog closes

**Verification:**
- Admin actions section hidden when viewer has no applicable action
- Impersonate requires confirmation dialog before firing
- Authority card deleted; groups rendered as full-width section
- Old button files deleted; `impersonate-action.ts` and action strings unchanged

---

### U9. Propose membership + remove member sub-pages

**Goal:** Create `[id]/propose/` and `[id]/remove/` sub-page routes; enforce server-side auth; implement the flows; delete old dialog button components.

**Requirements:** R34, R34a, R35, R36, R37, R38, R38a, R39, R40, R41

**Dependencies:** U8

**Files:**
- Create: `src/app/(authenticated)/(app)/(default)/admin/people/directory/[id]/propose/page.tsx`
- Create: `src/app/(authenticated)/(app)/(default)/admin/people/directory/[id]/propose/loading.tsx`
- Create: `src/app/(authenticated)/(app)/(default)/admin/people/directory/[id]/remove/page.tsx`
- Create: `src/app/(authenticated)/(app)/(default)/admin/people/directory/[id]/remove/page-client.tsx`
- Create: `src/app/(authenticated)/(app)/(default)/admin/people/directory/[id]/remove/loading.tsx`

**Approach:**
- `propose/page.tsx`: server component; checks `can("user.membership.propose", user)` — redirects to `../` on failure; renders explanatory copy (what proposing means, board approval required), single confirm button, and back link; on confirm calls existing `proposeMembershipAction`; redirects to `../` on success
- `remove/page.tsx`: server component; checks `can("membership.cancel_member")` — redirects to `../` on failure; uses a `step` nuqs param (`"1"` default, `"2"` after Continue) to drive two-step UI via `page-client.tsx`
- `remove/page-client.tsx`: client component; step 1 renders consequences list + Continue button; step 2 renders two boolean checkboxes + destructive confirm button (disabled until both checked); on confirm calls existing `boardKickAction`; redirects to listing on success
- Both sub-pages have minimal `loading.tsx` skeletons

**Patterns to follow:**
- `membership/cancel/[step]/(steps)/step-confirm.tsx` for Step 1 layout
- `membership/cancel/[step]/(steps)/step-details.tsx` for Step 2 checkboxes + disabled state
- Server-side `can()` redirect guard from existing page patterns

**Test scenarios:**
- Covers AE6: remove Step 2, neither checkbox checked → confirm button disabled; both checked → confirm button enabled
- Covers F2: propose page loads with explanatory text; confirm triggers action; redirects to member detail
- Covers F3: remove Step 1 shows consequences; Continue → Step 2; both checkboxes required; confirm fires board-kick; redirects to listing
- Error path: direct URL to `/propose` without `user.membership.propose` → redirect to member detail
- Error path: direct URL to `/remove` without `membership.cancel_member` → redirect to member detail
- Edge case: back link on propose page → returns to member detail

**Verification:**
- Old `board-kick-button.tsx` and `propose-membership-button.tsx` deleted; `board-kick-action.ts` and `proposeMembershipAction` unchanged
- Sub-page auth enforced on every load regardless of navigation origin
- Remove flow requires both checkboxes before confirm becomes active

---

### U10. Permissions sub-page

**Goal:** Create `[id]/permissions/` sub-page for managing a member's permission grants; enforce `users.manage_authority` gate.

**Requirements:** R28, R42, R43

**Dependencies:** U8

**Files:**
- Create: `src/app/(authenticated)/(app)/(default)/admin/people/directory/[id]/permissions/page.tsx`
- Create: `src/app/(authenticated)/(app)/(default)/admin/people/directory/[id]/permissions/page-client.tsx`
- Create: `src/app/(authenticated)/(app)/(default)/admin/people/directory/[id]/permissions/loading.tsx`

**Approach:**
- `permissions/page.tsx`: server component; checks `can("users.manage_authority")` — redirects to `../` on failure; fetches current grants for the target user; passes to `page-client.tsx`
- `permissions/page-client.tsx`: client component; shows current `globalAccessGrants` as toggleable items; calls `updateGrantsAction` on change; includes back link to member detail
- Reuse `update-grants-action.ts` (already exists at `[id]/update-grants-action.ts`)
- The `<AuthorityEditor>` grants-editing pattern from the deleted `authority-card.tsx` can be adapted; position assignments (authority) are out of scope per R28

**Patterns to follow:**
- `update-grants-action.ts` existing signature
- Server-side `can()` redirect guard
- `globalAccessGrants` from `src/lib/authority/model.ts`

**Test scenarios:**
- Covers AE7: viewer without `users.manage_authority` → direct URL navigation redirects to member detail
- Happy path: admin opens permissions sub-page → current grants visible; can add/remove; changes take effect immediately
- Edge case: member with no grants → empty state rendered, not an error
- Error path: grant update action fails → error toast shown; displayed grants unchanged

**Verification:**
- Sub-page inaccessible (redirects) without `users.manage_authority`
- Grants visible and editable for authorized viewers
- `authority-card.tsx` fully deleted; `update-grants-action.ts` present and reused

---

## System-Wide Impact

- **Interaction graph:** `admin/people/layout.tsx` and `directory/page.tsx` route guards switch from `users.view_all` to unscoped `user.view_details`; `nav-main.tsx` Directory item visibility changes accordingly; all permissions tests updated to new action names
- **Error propagation:** sub-page server-side auth failures redirect silently to the member detail page; no separate error page
- **State lifecycle risks:** dept-head department filter is forced server-side — URL param bypass explicitly prevented; `getAllUsersForAdmin` must not export page-size constants or DB fields to client imports (pagination convention)
- **API surface parity:** `user.view_details` unscoped must behave identically across `can()` (server), `useCan()` (hook), and `<Can>` (component) — all three updated in U1
- **Integration coverage:** listing dept-head scoping and filter presets require end-to-end tests (URL param → server query → filtered rows); sub-page auth gates require direct URL navigation tests
- **Unchanged invariants:** `board-kick-action.ts`, `proposeMembershipAction`, `impersonate-action.ts`, and `update-grants-action.ts` server actions are not modified; authority (positions) sub-page is out of scope

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `users.view_all` removal breaks a missed call site | U2 sweeps all 4 runtime call sites; TypeScript compilation fails on any remaining reference — use `npm run lint` as completeness check |
| `LegalMembershipStatus` query path for `deriveMembershipNotice` unclear at plan time | Deferred to implementation: follow how the membership page fetches it; no new data architecture |
| `session.updatedAt` touched by system operations (token refresh), not only logins — "Last active" may be misleading | Noted in requirements FYI; acceptable for v1; follow-up can add a dedicated `lastActiveAt` field |
| Plan 003 `targetStatus` requirement: `user.payment.view` call sites will be missing `targetStatus` when 003 is completed | Explicitly deferred; documented in Scope Boundaries |
| Impersonate dialog adds friction for super admins who use it frequently | R33 explicitly requires it; implementation note in code review |

---

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-23-admin-member-view-revamp-requirements.md](docs/brainstorms/2026-05-23-admin-member-view-revamp-requirements.md)
- Permission conventions: `docs/solutions/conventions/reusable-permission-policy-api-2026-05-02.md`
- Pagination conventions: `docs/solutions/conventions/pagination-server-pagecount-pattern-2026-05-18.md`
- Lifecycle architecture: `docs/solutions/architecture-patterns/member-lifecycle-entry-points-and-application-flow-2026-05-10.md`
- Payment/membership independence: `docs/solutions/architecture-patterns/membership-journey-vs-payment-journey-2026-05-12.md`
- Related plan (partially landed): `docs/plans/2026-05-20-003-refactor-permission-system-granular-roles-plan.md`
