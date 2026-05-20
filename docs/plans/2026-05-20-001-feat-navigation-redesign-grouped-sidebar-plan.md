---
title: "feat: Navigation redesign — three-group sidebar with admin section"
type: feat
status: active
date: 2026-05-20
origin: docs/brainstorms/2026-05-20-navigation-redesign-requirements.md
---

# feat: Navigation redesign — three-group sidebar with admin section

## Summary

Restructures the flat 4-item sidebar into three named groups (Personal, Community, Admin) where every admin nav item is independently permission-gated and the Admin group itself only appears when at least one of its items would be visible. Introduces separate `/admin/*` routes with a server-side layout guard so admin and member views of people and groups are architecturally distinct pages. All list pages use server-side pagination and filtering via `searchParams` → DB query; Nuqs manages URL state on the client.

---

## Problem Frame

The current sidebar is a flat, undifferentiated list. Admin controls (propose membership, authority management, batches) are embedded in the same pages as member browsing flows, and there is no structural room to grow. An admin browsing the member directory as a peer encounters management controls they didn't ask for. (see origin: `docs/brainstorms/2026-05-20-navigation-redesign-requirements.md`)

---

## Requirements

- R1. Three named nav groups — Personal, Community, Admin — rendered with `SidebarGroupLabel` in the sidebar.
- R2. The Admin group appears if and only if the current user would see at least one item inside it. Each item is independently gated; no shared group-level permission check.
- R3. Per-item permission gates: People > Directory (admin/super_admin/people_admin grant or department_head); People > Batches (admin only); Groups (admin/super_admin/people_admin); Payments (head_of_finance position or finance_admin grant); Settings (admin/super_admin only).
- R4. All `/admin/*` routes are protected server-side by a layout-level redirect to `/membership` when the user holds no admin-level permission.
- R5. Community Directory (`/people/directory`) renders as a card grid showing only members with status `onboarding`, `member`, or `supporting_alumni`. Cards expose: name, avatar, START email, department, batch, status label. Cards are not clickable links.
- R6. Community Directory supports server-side filters by department, batch, and status; filter state lives in URL params via Nuqs (`shallow: false`).
- R7. The current `/people/directory/[id]` admin detail moves to `/admin/people/directory/[id]`. The old route is removed. All eight reference sites are updated.
- R8. A new admin table view at `/admin/people/directory` shows all users across all statuses with server-side pagination and filtering.
- R9. Community Groups (`/groups`) shows all groups regardless of the viewer's membership, with "Your groups" / "All groups" sections and join/leave actions. No admin management controls.
- R10. New admin pages at `/admin/groups` and `/admin/settings`. `/admin/people/batches` and `/admin/payments` expose the same page content as the existing routes at new admin-prefixed URLs (old URLs remain functional; no redirects).
- R11. Authority editing moves to Admin Settings. `AuthorityCard` on the admin detail page becomes a read-only summary.
- R12. All list pages — Community Directory, Admin People Directory, Admin Groups — use server-side pagination, filtering, and sorting. No client-side array operations for any of these concerns.

---

## Scope Boundaries

- No URL redirects for existing routes (`/people/batches`, `/payments` continue working unchanged).
- No new features not currently in the codebase: invitations, matching rules, audit log, profile self-editing.
- No sort UI on list pages (sort params can be plumbed server-side but UI controls are deferred).
- `people-table.tsx` is updated only where it references `/people/directory/[id]`; no broader refactor.
- The existing `/membership`, `/membership/settings`, and `/membership/application/*` routes are untouched.
- `AuthorityCard` on the admin detail page becomes read-only in this plan; the full authority editing UI on Settings is implemented in U10. Until U10 is complete, the detail page temporarily retains editing.

### Deferred to Follow-Up Work

- Sort controls on list pages: server-side sort params are in scope; the UI toggle for column sorting is a follow-up.
- Bulk action toolbar on admin directory (email, change batch, move to alumni): UI stubs are acceptable; actual actions require separate backend work.
- Group creation from the admin groups page: route and page are scaffolded; the create flow is a follow-up.

---

## Context & Research

### Relevant Code and Patterns

- `src/components/nav-main.tsx` — current flat nav; the `<Can permission="...">` wrapping pattern and `NavMainCollapsibleItem` for expandable sub-items are the patterns to extend.
- `src/components/ui/sidebar.tsx` — `SidebarGroup`, `SidebarGroupLabel`, `SidebarMenuSub`, `SidebarMenuSubButton` are all available; `SidebarGroupLabel` auto-hides in icon-collapse mode with no extra CSS needed.
- `src/lib/authority/model.ts` — `UserAuthority` shape: `{ grants: GrantAssignment[], positions: PositionAssignment[] }`. `department_head` is a `PositionAssignment` with `scope: "department"`, not a `GlobalAction` — meaning no single existing `GlobalAction` covers "is any kind of admin."
- `src/lib/permissions/server.ts` — `can(action)` for server-side guards; used in `payments/page.tsx` as `if (!(await can(...))) redirect(...)`.
- `src/db/people.ts` — `getAllUserPublicData` is the query to extend; `getUserDetails`, `getUserAuthorityData` are the detail queries.
- `src/db/groups.ts` — `listGroupsForViewer` returns `{ id, name, slug, memberCount, isMember }` scoped to viewable groups; a new unrestricted variant is needed.
- `src/app/(authenticated)/(app)/people/directory/page-client.tsx` — currently a table with admin controls (Create User dialog, Import dialog, PeopleTable, pendingActions); this content migrates to the admin directory; the community version is rewritten as a card grid.
- Eight files reference `/people/directory` or `/people/directory/[id]` and require updates (see U7).
- `src/app/(authenticated)/(app)/people/directory/[id]/update-authority-action.ts` — calls `revalidatePath`; must be updated when the route moves.

### Institutional Learnings

- **Pagination convention** (`docs/solutions/conventions/pagination-server-pagecount-pattern-2026-05-18.md`): server computes `pageCount`; client receives it as prop; `useQueryState` with `shallow: false` for `page`/`q`/filters; never import from `@/db/*` in client components — even a bare constant pulls the Node.js adapter into the browser bundle.
- **Permission API convention** (`docs/solutions/conventions/reusable-permission-policy-api-2026-05-02.md`): `<Can>` for conditional rendering; `useCan()` for behavioral affordances; server-side `can()` still required even when the nav item is hidden — client gates are UX affordances only. Any new permission check must add a case in `evaluateAuth()` in `src/lib/permissions/evaluate.ts`.
- **Membership field precedence** (`docs/solutions/architecture-patterns/member-lifecycle-entry-points-and-application-flow-2026-05-10.md`): status-gated UI should use `user.status` for display/operational membership; `user.legalMembershipState` for legal privileges. The directory filter uses `user.status`; this is intentional.
- **Better Auth field declaration** (`docs/solutions/architecture-patterns/member-lifecycle-entry-points-and-application-flow-2026-05-10.md`): Any new user field controlling nav visibility must be declared in `src/db/schema/auth-fields.ts`. The `image` field returned by `getAllUserPublicData` is already on the user table and is already in scope — confirm it is declared.

---

## Key Technical Decisions

- **Admin group gate via `useAuthority()` directly**: No single `GlobalAction` covers "is any kind of admin." Rather than adding a synthetic `"admin.any"` action to the permissions evaluator, `NavMain` reads `useAuthority()` and derives a local `showAdminGroup` boolean from `authority.grants` and `authority.positions`. The admin layout uses the same logic via `getUserAuthority()` for the server-side redirect. Rationale: avoids polluting the permissions model with a gate that has no data-access meaning; the evaluator is for resource-level checks, not UI visibility.
- **Admin layout redirect condition**: user is permitted through if they hold any of `[admin, super_admin, people_admin, finance_admin]` grants OR any of `[department_head, head_of_finance]` positions. President and vice-president alone (with no grant) do NOT pass — they have no admin nav items.
- **`getAllUserPublicData` extended in-place**: optional `status[]`, `department`, and `batchNumber` params are added; they become Drizzle `WHERE` clauses, not post-fetch JS filters. Default `status` filter is `['onboarding', 'member', 'supporting_alumni']` so the community directory excludes plain alumni automatically. The admin query (`getAllUsersForAdmin`) is a separate function with no default status filter.
- **New `listGroupsPublic` for community groups**: rather than making `listGroupsForViewer` aware of privilege mode, a new function with no scope check is introduced. It returns all groups with `isMember` computed per viewer. `listGroupsForViewer` is retained unchanged for admin/permission-aware uses.
- **`/people/directory/[id]` deleted, not redirected**: the old route is removed entirely. All eight reference sites are updated. The user confirmed no redirects are needed.
- **AuthorityCard editing deferred to U10**: until Admin Settings (U10) is complete, the admin detail retains the editable `AuthorityCard`. U10 extracts the editing form into a shared component, makes the card read-only, and wires editing through Settings.
- **Thin wrapper pattern for Batches and Payments**: `/admin/people/batches` and `/admin/payments` are new `page.tsx` files that import and re-export the same RSC page component as the originals. No duplication of logic.
- **Server-side-first for all lists**: filter/sort/pagination state is always URL params (Nuqs, `shallow: false`). The server `page.tsx` parses `searchParams`, calls the DB function with filter args, and passes computed results to the client component. Client components receive plain data props; they never call DB functions or import from `@/db/*`.

---

## Open Questions

### Resolved During Planning

- **Which users pass the admin layout guard?**: Resolved — users with `[admin, super_admin, people_admin, finance_admin]` grants OR `[department_head, head_of_finance]` positions. Presidents/VPs without grants are blocked.
- **Is `image` already accessible server-side?**: Research confirms it is on the `user` table. Confirm it is declared in `auth-fields.ts` before adding to the query return shape.
- **Does `people-table.tsx` need a full refactor?**: No — it is reused for the admin directory with its internal `/people/directory/[id]` link updated. Layout/column changes are admin-directory-specific work in U6, not a `people-table.tsx` refactor.

### Deferred to Implementation

- **Exact Drizzle `inArray`/`eq` filter composition** for the extended `getAllUserPublicData`: routine query work; defer to implementation.
- **Groups schema admin-specific columns** (Slack channel mapping, auto-add status, archived flag): need to verify which fields exist on the `group` table before writing `listAllGroupsForAdmin`. Check `src/db/schema/` during implementation.
- **Authority editor extraction shape** (U10): the exact component boundary between the read-only card and the editable form in Settings depends on what `authority-editor.tsx` currently accepts as props. Resolve during U10 implementation.

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### Server-side filtering flow (all list pages)

```
User selects filter pill
  → Nuqs updates URL param (shallow: false)
  → Next.js server navigation fires
  → page.tsx searchParams handler parses dept/batch/status/page/q
  → calls DB query with filter args as WHERE clauses
  → DB returns filtered + paginated { rows, total, pageCount }
  → server component passes plain props to client component
  → client component renders results; Nuqs state stays in sync with URL
```

No client-side array filtering at any step.

### Admin group visibility logic (NavMain, client)

```
authority = useAuthority()

showAdminGroup =
  authority.grants includes any of [admin, super_admin, people_admin, finance_admin]
  OR
  authority.positions includes department_head or head_of_finance

if showAdminGroup:
  render Admin SidebarGroup
  each item wrapped in <Can permission="...">
  People collapsible: shown if Directory or Batches <Can> passes
```

---

## Implementation Units

### U1. Admin route group with server-side permission guard

**Goal:** Create `/admin/layout.tsx` so every `/admin/*` route is protected server-side. A user who navigates directly to any admin URL without qualifying permissions is redirected to `/membership`.

**Requirements:** R4

**Dependencies:** None

**Files:**
- Create: `src/app/(authenticated)/(app)/admin/layout.tsx`

**Approach:**
- Server component. Call `getUserAuthority()` (already called and potentially cached in the parent `(app)/layout.tsx` — confirm whether React `cache()` applies).
- Check: user holds any of `[admin, super_admin, people_admin, finance_admin]` in `authority.grants` OR holds `department_head` or `head_of_finance` in `authority.positions`.
- If check fails → `redirect("/membership")`.
- Otherwise render `{children}`.
- No visual chrome — this layout only provides the redirect guard; the existing `(app)/layout.tsx` provides the sidebar.

**Patterns to follow:**
- `src/app/(authenticated)/(app)/payments/page.tsx` — server-side `can()` redirect pattern.
- `src/app/(authenticated)/(app)/layout.tsx` — where `getUserAuthority` is currently called.

**Test scenarios:**
- Happy path: user with `admin` grant → renders children without redirect.
- Happy path: user with `finance_admin` grant → renders children.
- Happy path: user with `department_head` position → renders children.
- Happy path: user with `head_of_finance` position → renders children.
- Error path: plain member (empty grants and positions) → redirected to `/membership`.
- Error path: user with only `president` position and no grants → redirected to `/membership`.
- Error path: user with only `vice_president` position and no grants → redirected to `/membership`.

**Verification:** Navigating to `/admin/payments` as a plain member redirects to `/membership`. Navigating as a `finance_admin` renders the page.

---

### U2. Nav restructure — three named groups with per-item permission gating

**Goal:** Rewrite `nav-main.tsx` to render three `SidebarGroup` blocks — Personal, Community, Admin — where the Admin group is conditionally rendered and each of its items is independently wrapped with `<Can>`.

**Requirements:** R1, R2, R3

**Dependencies:** None (nav URLs reference new admin routes that can be wired before those routes exist)

**Files:**
- Modify: `src/components/nav-main.tsx`

**Approach:**
- Remove the flat `NAV_ITEMS` array pattern; replace with three explicit group blocks.
- **Personal group**: single `SidebarMenuItem` for `/membership` (no gate).
- **Community group**: two `SidebarMenuItem` entries — `/people/directory` and `/groups` (no gate on either).
- **Admin group**: compute `showAdminGroup` from `useAuthority()` (see High-Level Technical Design). If false, render nothing. If true, render a `SidebarGroup` with `SidebarGroupLabel` and the following items:
  - People (collapsible, `SidebarMenuSub`): Directory sub-item shown when `canSeeAdminDirectory` is true (see below); Batches sub-item gated with `<Can permission="batches.manage">`. People parent visible only when at least one sub-item passes.
  - Groups: `<Can permission="groups.view_all">`.
  - Payments: `<Can permission="payments.manage">`.
  - Settings: gated via inline check `authority.grants.some(g => ['admin','super_admin'].includes(g.grant))` — admin/super_admin only per requirements; `batches.manage` (`hasAdminGrant`) is an acceptable `<Can>` proxy since it covers the same set.
- The People collapsible uses `defaultOpen={isParentActive}` — unchanged from current pattern.
- All item `href` values use the new admin paths: `/admin/people/directory`, `/admin/people/batches`, `/admin/groups`, `/admin/payments`, `/admin/settings`.

**Admin Directory nav gate**: No `GlobalAction` covers the union of admin/people_admin grants AND department_head positions. Compute `canSeeAdminDirectory` inline from the `authority` object already in scope: `authority.grants.some(g => ['admin','super_admin','people_admin'].includes(g.grant)) || authority.positions.some(p => p.position === 'department_head')`. Mirror the `showAdminGroup` derivation pattern; do not add a synthetic permission to the evaluator.

**Note on permission proxies for nav gates:** Where a `GlobalAction` closely matches the intended audience, use `<Can>`. Where it doesn't (Admin Directory, Settings), derive visibility directly from the `authority` object. Nav gates are UX affordances — the server-side layout (U1) and per-route `can()` checks are the authoritative guards.

**Patterns to follow:**
- Existing `<Can permission="...">` wrapping pattern from `nav-main.tsx`.
- `NavMainCollapsibleItem` component — retain or inline for the People collapsible.
- `SidebarGroupLabel` from `src/components/ui/sidebar.tsx`.

**Test scenarios:**
- Happy path: plain member → Personal and Community groups render; Admin group absent.
- Happy path: `department_head` only → Admin group with only People > Directory visible.
- Happy path: `people_admin` → Admin group with People (Directory + Batches) and Groups visible.
- Happy path: `finance_admin` or `head_of_finance` → Admin group with only Payments visible.
- Happy path: `admin` → Admin group with all five items.
- Edge case: user with both `people_admin` and `finance_admin` → People, Groups, Payments all visible.
- Edge case: active route is `/admin/people/batches` → People collapsible auto-opens, Batches sub-item active.
- Edge case: sidebar collapsed to icon mode → group labels hidden; items show tooltips.
- Edge case: mobile sidebar → closes on navigation (existing `closeMobile` pattern retained).

**Verification:** Each user type scenario above produces the correct visible item set. Sidebar collapsed state still shows icons with tooltips for all visible items.

---

### U3. Data layer — extended and new DB queries

**Goal:** Extend `getAllUserPublicData` with server-side filters and `image` field; add `getAllUsersForAdmin`, `listGroupsPublic`, and `listAllGroupsForAdmin` queries.

**Requirements:** R5, R6, R8, R9, R12

**Dependencies:** None

**Files:**
- Modify: `src/db/people.ts`
- Modify: `src/db/groups.ts`
- Modify: `src/db/schema/` or `src/db/schema/auth-fields.ts` if `image` needs declaration

**Approach:**

*`getAllUserPublicData` changes:*
- Add optional params: `status?: UserStatus[]`, `department?: Department`, `batchNumber?: number`.
- Default for `status` when omitted: `['onboarding', 'member', 'supporting_alumni']`.
- All filter params become Drizzle `WHERE` clauses (`inArray`, `eq`). No post-fetch JS filtering.
- Add `image: userTable.image` to the `SELECT` and to the `PublicUser` interface.
- `total` count query must apply the same WHERE clauses as the rows query.
- Confirm `image` is declared in `betterAuthUserAdditionalFields` in `src/db/schema/auth-fields.ts` — if not, add it.

*`getAllUsersForAdmin` (new):*
- No default status filter — returns all users.
- Accepts: `page`, `search`, `status?: UserStatus[]`, `department?: Department`, `batchNumber?: number`.
- Returns: same `PaginatedUsers` shape plus any admin-only columns needed for the table (consider adding `personalEmail` for admin view — deferred to implementation based on product need).
- Keep the function unexported from any client-accessible barrel.

*`listGroupsPublic` (new, in `src/db/groups.ts`):*
- Returns all groups, no scope filter.
- Computes `isMember` for the given `viewerId`.
- Accepts `search` and `page` params.
- Returns same `PaginatedGroups` shape as `listGroupsForViewer`.

*`listAllGroupsForAdmin` (new, in `src/db/groups.ts`):*
- Returns all groups with admin-relevant columns: any management metadata available on the `group` schema (verify available columns during implementation — check for `slackChannelId`, `archived`, auto-add flags, etc.).
- Accepts `search` and `page` params.
- Server-side pagination.

**Patterns to follow:**
- Existing `getAllUserPublicData` pagination structure — `offset`, `limit`, parallel `count()` query.
- Learnings: never export page-size constants; always return `pageCount` and `total` from the DB function.

**Test scenarios:**
- Happy path: `getAllUserPublicData()` with no args → only onboarding/member/supporting_alumni rows returned; alumni excluded.
- Happy path: `getAllUserPublicData({ status: ['member'] })` → only member-status rows.
- Happy path: `getAllUserPublicData({ department: 'operations' })` → only operations rows.
- Happy path: `getAllUserPublicData({ batchNumber: 6 })` → only batch 6 rows.
- Happy path: combined filters → correct AND behaviour.
- Happy path: `image` field present on returned `PublicUser` objects (null when user has no avatar).
- Happy path: `getAllUsersForAdmin()` → returns all statuses including alumni.
- Happy path: `listGroupsPublic(viewerId)` → all groups returned; `isMember` correct for viewer.
- Edge case: empty result set with active filters → `{ users: [], total: 0, pageCount: 1 }`.
- Edge case: `page` beyond `pageCount` → clamped to last valid page (existing pattern).

**Verification:** Query functions return the correct shape and honour all filter combinations. No DB module constants are exported to client-accessible paths.

---

### U4. Community Directory — card grid with server-side filters

**Goal:** Transform `/people/directory` from an admin-oriented table into a member-facing card grid with server-side department, batch, and status filtering.

**Requirements:** R5, R6, R12

**Dependencies:** U3

**Files:**
- Modify: `src/app/(authenticated)/(app)/people/directory/page.tsx`
- Rewrite: `src/app/(authenticated)/(app)/people/directory/page-client.tsx`
- Update: `src/app/(authenticated)/(app)/people/directory/loading.tsx`

**Approach:**

*`page.tsx` (server component):*
- Parse `searchParams`: `page`, `q`, `department`, `batchNumber`, `status` (comma-separated or multi-param — pick one and apply consistently).
- Remove `batches` and `pendingActions` fetches — no longer needed.
- Call `getAllUserPublicData({ page, search, department, batchNumber, status })` as a promise (keep `React.use()` + Suspense pattern).
- Pass `usersPromise`, `pageCount`, `initialFilters` to client.

*`page-client.tsx` (full rewrite):*
- Nuqs: `useQueryState` for `department`, `batchNumber`, `status`, `q`, `page` — all with `shallow: false`.
- Filter controls: department multi-select pills (All / Partnerships / Operations / Community / Growth / Events + "No department"); batch select; status toggle (All / Onboarding / Member / Alumni).
- Card grid layout: responsive `grid` with `auto-fill, minmax(240px, 1fr)`.
- Each card: avatar (use `image` if present; fallback to initials), full name, START email, department badge, batch label, status badge.
- Cards are `<div>` elements, not `<Link>` — no click behaviour.
- Remove `CreateUserDialog`, `ImportGoogleUserDialog`, `PeopleTable`, `pendingActions` — none appear in the community view.
- Pagination component (if one exists) wired to `page` Nuqs param.

*`loading.tsx`:*
- Skeleton matches new card grid: N placeholder cards matching the grid layout.

**Patterns to follow:**
- Nuqs `useQueryState` + `shallow: false` pattern from `docs/solutions/conventions/pagination-server-pagecount-pattern-2026-05-18.md`.
- Existing `groups/page.tsx` + `page-client.tsx` for the server/client boundary shape.

**Test scenarios:**
- Happy path: page loads with default filters → only onboarding/member/supporting_alumni cards.
- Happy path: user selects "Operations" department filter → URL updates, server re-fetches, only operations members shown.
- Happy path: user selects batch 6 → URL updates, server re-fetches, only batch 6 members shown.
- Happy path: user selects "Onboarding" status filter → URL updates, server re-fetches.
- Happy path: user types in search → URL `q` updates, server re-fetches by name/email.
- Happy path: combined filters narrow results correctly.
- Happy path: cards show name, START email (not personal email), department, batch, status label, avatar/initials.
- Edge case: member with no department → "No department" or blank department; card still renders.
- Edge case: member with no avatar (`image` null) → initials shown.
- Edge case: zero results with active filter → empty state rendered.
- Error path: no admin controls visible — no Create User button, no Import button, no pending action indicators.
- Integration: filter URL params survive page navigation and page refresh.

**Verification:** The community directory renders a card grid. Applying any filter updates the URL and fetches server-side. No admin UI visible to plain members.

---

### U5. Admin People Directory — server-side paginated table at `/admin/people/directory`

**Goal:** Create the admin-facing table view of all users at the new `/admin/people/directory` route.

**Requirements:** R8, R12

**Dependencies:** U1, U3

**Files:**
- Create: `src/app/(authenticated)/(app)/admin/people/directory/page.tsx`
- Create: `src/app/(authenticated)/(app)/admin/people/directory/page-client.tsx`
- Create: `src/app/(authenticated)/(app)/admin/people/directory/loading.tsx`

**Approach:**

*`page.tsx`:*
- No additional per-page guard beyond the admin layout (U1). Department heads are entitled to see the admin directory (scoped to their department per requirements); a `can("users.create")` guard would incorrectly redirect them. The layout guard is sufficient. Action-level guards (`users.create` for Add member, etc.) live on the action buttons and server actions, not the page itself.
- Parse `searchParams`: `page`, `q`, `department`, `batchNumber`, `status`.
- Call `getAllUsersForAdmin(...)`.
- Pass paginated result to client component.

*`page-client.tsx`:*
- Reuses `PeopleTable` from `src/components/people-table.tsx` (updated to link to `/admin/people/directory/[id]` in U7).
- Filter controls: search input, department select, batch select, status select — all Nuqs URL params with `shallow: false`.
- Action area: "Add member" button (stub or existing `CreateUserDialog`), "Export CSV" (stub), "Sync Google" (stub).
- Bulk action toolbar: show when rows are checked; can be stubbed for now.
- No `pendingActions` feed here — the admin directory is a management list, not a notification surface.

*`loading.tsx`:*
- Table skeleton matching header + rows layout.

**Patterns to follow:**
- Existing `people/directory/page-client.tsx` table pattern — this unit is essentially inheriting that content, adjusted for the admin context.
- `payments/page.tsx` for the server-side guard pattern.

**Test scenarios:**
- Happy path: admin user sees full table with all statuses (onboarding, member, alumni, etc.).
- Happy path: search by name/email → URL updates, server re-fetches.
- Happy path: filter by department → server-side.
- Happy path: filter by batch → server-side.
- Happy path: filter by status → server-side.
- Happy path: each row links to `/admin/people/directory/[id]`.
- Happy path: `department_head` navigates to `/admin/people/directory` → table renders (no per-page guard blocks them).
- Error path: plain member navigating directly → admin layout (U1) redirects before this page renders.
- Integration: admin directory table and community directory card grid are distinct pages with distinct data and no shared client-side state.

**Verification:** Admin can navigate to `/admin/people/directory`, see all users with status/dept/batch/search filters, and click a row to reach the admin detail page.

---

### U6. Admin People Directory Detail — move from `/people/directory/[id]`

**Goal:** Move the person detail page and all its colocated components to `/admin/people/directory/[id]`. Remove the old route. Update all eight external reference sites.

**Requirements:** R7

**Dependencies:** U1

**Files:**
- Create (move from): `src/app/(authenticated)/(app)/admin/people/directory/[id]/page.tsx`
- Create (move from): `src/app/(authenticated)/(app)/admin/people/directory/[id]/loading.tsx`
- Create (move from): `src/app/(authenticated)/(app)/admin/people/directory/[id]/authority-card.tsx`
- Create (move from): `src/app/(authenticated)/(app)/admin/people/directory/[id]/authority-editor.tsx`
- Create (move from): `src/app/(authenticated)/(app)/admin/people/directory/[id]/contact-card.tsx`
- Create (move from): `src/app/(authenticated)/(app)/admin/people/directory/[id]/groups-card.tsx`
- Create (move from): `src/app/(authenticated)/(app)/admin/people/directory/[id]/impersonate-button.tsx`
- Create (move from): `src/app/(authenticated)/(app)/admin/people/directory/[id]/profile-card.tsx`
- Create (move from): `src/app/(authenticated)/(app)/admin/people/directory/[id]/propose-membership-button.tsx`
- Create (move from): `src/app/(authenticated)/(app)/admin/people/directory/[id]/update-authority-action.ts`
- Delete: `src/app/(authenticated)/(app)/people/directory/[id]/` (entire directory)
- Modify: `src/components/people-table.tsx` — update `router.push` target to `/admin/people/directory/${id}`
- Modify: `src/app/(authenticated)/(app)/groups/[id]/page-client.tsx` — update `Link href` to `/admin/people/directory/${member.id}`
- Modify: `src/app/(authenticated)/(app)/people/batches/page.tsx` — update fallback redirect from `/people/directory` to `/membership`
- Modify: `src/app/(authenticated)/(app)/payments/page.tsx` — update fallback redirect from `/people/directory` to `/membership`

**Approach:**
- Copy all files to new location, then delete old directory.
- In `page.tsx`: update breadcrumb `href` values from `/people/directory` to `/admin/people/directory`; update the back button href.
- In `update-authority-action.ts`: update `revalidatePath` call from `/people/directory/${userId}` to `/admin/people/directory/${userId}`.
- `AuthorityCard` and `authority-editor.tsx` remain functionally unchanged at this stage — editing stays active until U10 extracts it to Settings.
- The `BreadcrumbCrumb` crumbs array in `page.tsx` should reflect `Admin → People → Directory → [name]`.

**Patterns to follow:**
- Existing `page.tsx` breadcrumb pattern using `BreadcrumbCrumb` component.

**Test scenarios:**
- Happy path: `/admin/people/directory/[id]` renders ProfileCard, ContactCard, GroupsCard, AuthorityCard.
- Happy path: ProposeMembershipButton appears for eligible users when viewer has `membership.propose`.
- Happy path: ImpersonateButton appears for super_admin.
- Happy path: back button navigates to `/admin/people/directory`.
- Happy path: breadcrumb reads Admin / People / Directory / [name].
- Happy path: authority edit action (`update-authority-action.ts`) still works and revalidates `/admin/people/directory/[id]`.
- Happy path: row click in `people-table.tsx` navigates to `/admin/people/directory/[id]`.
- Happy path: member link in `groups/[id]/page-client.tsx` navigates to `/admin/people/directory/[id]`.
- Error path: `/people/directory/[id]` returns 404 (old route deleted).
- Integration: batches/payments fallback redirects now go to `/membership`, not the deleted route.

**Verification:** `/people/directory/[id]` is a 404. All eight reference sites navigate to or revalidate the new path correctly.

---

### U7. Admin thin-wrapper routes — Batches and Payments

**Goal:** Expose the existing batches and payments pages at new `/admin/people/batches` and `/admin/payments` URLs without duplicating logic. Old URLs remain functional.

**Requirements:** R10

**Dependencies:** U1

**Files:**
- Create: `src/app/(authenticated)/(app)/admin/people/batches/page.tsx`
- Create: `src/app/(authenticated)/(app)/admin/people/batches/loading.tsx`
- Create: `src/app/(authenticated)/(app)/admin/payments/page.tsx`

**Approach:**
- Each new `page.tsx` imports the RSC default export from the original page file and re-exports it (or calls it directly). This avoids logic duplication; the canonical implementation stays in the original file.
- `loading.tsx` for admin batches: add one (the original `/people/batches` has none). Can be a copy of any existing table-skeleton loading file.
- The original `/people/batches` and `/payments` are not modified.

**Test scenarios:**
- Happy path: `/admin/people/batches` renders identically to `/people/batches` for a user with `batches.manage`.
- Happy path: `/admin/payments` renders identically to `/payments` for a user with `payments.manage`.
- Happy path: `/people/batches` still works (unchanged).
- Happy path: `/payments` still works (unchanged).
- Error path: plain member navigating to `/admin/payments` → admin layout redirect fires before page renders.

**Verification:** Both new admin URLs render the correct pages. Original URLs are unaffected.

---

### U8. Community Groups — show all groups, remove admin controls

**Goal:** Make the community groups page show all groups regardless of the viewer's membership. Remove group creation and admin management controls.

**Requirements:** R9

**Dependencies:** U3

**Files:**
- Modify: `src/app/(authenticated)/(app)/groups/page.tsx`
- Modify: `src/app/(authenticated)/(app)/groups/page-client.tsx`
- Possibly modify: `src/app/(authenticated)/(app)/groups/loading.tsx`

**Approach:**
- `page.tsx`: replace the `listGroupsForViewer` call with the new `listGroupsPublic(currentUser.id, { page, search })`. Pass the result to client.
- `page-client.tsx`: remove any group-creation UI (Create Group button, dialog). Remove any admin-only management controls. Keep the "Your groups" / "All groups" section split based on `isMember`.
- Keep join/leave action — this is a member-level action.
- If `loading.tsx` differs from the new layout, update the skeleton.

**Patterns to follow:**
- Existing `groups/page.tsx` and `page-client.tsx` as the baseline — only remove admin content and swap the query.

**Test scenarios:**
- Happy path: plain member sees all groups, including ones they are not a member of.
- Happy path: "Your groups" section shows only groups where `isMember: true`.
- Happy path: "All groups" section shows groups where `isMember: false`.
- Happy path: join/leave button still works.
- Error path: no Create Group button visible to any user on this page.
- Error path: no admin member-management controls visible.
- Integration: navigating to `/groups` as an admin shows the same clean member view — no admin clutter.

**Verification:** A plain member can see all groups. Group creation is absent from this page.

---

### U9. Admin Groups page at `/admin/groups`

**Goal:** Create the admin-facing groups management table at `/admin/groups`.

**Requirements:** R10, R12

**Dependencies:** U1, U3

**Files:**
- Create: `src/app/(authenticated)/(app)/admin/groups/page.tsx`
- Create: `src/app/(authenticated)/(app)/admin/groups/page-client.tsx`
- Create: `src/app/(authenticated)/(app)/admin/groups/loading.tsx`

**Approach:**
- `page.tsx`: guard with `if (!(await can("groups.view_all"))) redirect("/membership")`. Parse `page`, `q` from `searchParams`. Call `listAllGroupsForAdmin`. Pass results to client.
- `page-client.tsx`: table showing all groups. Columns: name, member count, and any admin columns available from `listAllGroupsForAdmin` (e.g., Slack channel, archived status). Per-row action menu (edit, archive — stubs acceptable). "New group" action (stub or existing create flow). Nuqs for `q` and `page` with `shallow: false`.
- `loading.tsx`: table-skeleton loading file.

**Patterns to follow:**
- `payments/page.tsx` for server-side guard pattern.
- Admin people directory (U5) for the table + filter + pagination structure.

**Test scenarios:**
- Happy path: admin sees all groups in table form.
- Happy path: search filters groups server-side.
- Happy path: pagination works server-side.
- Error path: user without `groups.view_all` → redirected.
- Integration: community `/groups` and admin `/admin/groups` are separate pages; admin can use community groups to browse as a member.

**Verification:** `/admin/groups` renders a table of all groups with server-side search and pagination.

---

### U10. Admin Settings with authority management

**Goal:** Create `/admin/settings`, move authority editing there, and make `AuthorityCard` on the admin detail page read-only.

**Requirements:** R11

**Dependencies:** U1, U6

**Files:**
- Create: `src/app/(authenticated)/(app)/admin/settings/page.tsx`
- Create: `src/app/(authenticated)/(app)/admin/settings/page-client.tsx`
- Create: `src/app/(authenticated)/(app)/admin/settings/loading.tsx`
- Extract: authority editing form into a shared component (new file, location TBD during implementation — e.g., `src/components/authority-form.tsx` or colocated with settings)
- Modify: `src/app/(authenticated)/(app)/admin/people/directory/[id]/authority-card.tsx` — make display-only; add a link/button pointing to Settings

**Approach:**
- `page.tsx`: guard with `if (!(await can("users.manage_authority"))) redirect("/membership")`. Fetch all role assignments (positions + grants across all users) for the roles table. Pass to client.
- `page-client.tsx` sections:
  1. **Organisation** — read-only display of org-level config fields (name, domain); editable form deferred if write actions don't yet exist.
  2. **Roles & authority** — table of positions and grants showing who holds each role; inline controls to add/remove assignments using a shared authority editing component extracted from `authority-editor.tsx`.
- `authority-editor.tsx` extraction: identify the form/action boundary in the existing component; extract the editing form as a standalone component that the settings page renders. The card in the admin detail imports the read-only view only.
- `AuthorityCard` on the admin detail: retain the read-only display, remove the edit controls, add a "Manage in Settings" link to `/admin/settings`.
- `update-authority-action.ts` (already at the new admin detail path after U6): revalidate both `/admin/people/directory/${userId}` and `/admin/settings` after authority changes.

**Patterns to follow:**
- `authority-editor.tsx` and `update-authority-action.ts` as the starting point for the extracted form.
- Server action `revalidatePath` pattern from existing authority action.

**Test scenarios:**
- Happy path: admin navigates to `/admin/settings`, sees Org section and Roles table.
- Happy path: admin adds a grant to a user → roles table updates, user now appears under that role.
- Happy path: admin removes a position from a user → user disappears from that role row.
- Happy path: `AuthorityCard` on admin detail now shows read-only view with "Manage in Settings" link.
- Happy path: "Manage in Settings" link navigates to `/admin/settings`.
- Error path: user without `users.manage_authority` → redirected from `/admin/settings`.
- Error path: `people_admin` without `admin` grant → Settings item not shown in nav (U2); direct URL access → redirected.
- Integration: authority change made in Settings is reflected in `AuthorityCard` read-only view on the admin detail page (revalidation clears both paths).

**Verification:** `/admin/settings` renders with Roles section. Authority editing works. `AuthorityCard` on admin detail is read-only with a link to Settings.

---

## System-Wide Impact

- **Interaction graph:** `update-authority-action.ts` (moved to admin detail directory in U6) must revalidate both the admin detail path and `/admin/settings` after authority changes. Any other server actions that `revalidatePath("/people/directory/...")` will break silently — grep for all `revalidatePath` calls containing `people/directory` before closing U6.
- **Error propagation:** The admin layout (U1) is the catch-all redirect for unauthenticated admin access. Individual route guards (`can()` checks in page.tsx) provide defence in depth. Failures in the layout do not propagate — they redirect cleanly.
- **State lifecycle risks:** Nuqs URL params for the community directory (U4) and admin directory (U5) are independent namespaces — no collision risk. Ensure the `page` param resets to `1` when department/batch/status filters change (`clearOnDefault: true` on the page param).
- **API surface parity:** The admin nav items point to new `/admin/*` URLs; the existing sidebar item for `/people/directory` (community) and the existing `/payments`/`/people/batches` remain reachable. No external link surfaces are broken.
- **Integration coverage:** The filter → URL → server → DB → client render loop must be tested end-to-end for the community directory and admin directory; unit tests on the query functions alone are insufficient to confirm the searchParams parsing is wired correctly.
- **Unchanged invariants:** The `(app)/layout.tsx` authority fetch, `AuthorityProvider`, and all membership/onboarding routes are untouched. The `Can` component API is unchanged. The existing `/people/batches` and `/payments` routes remain functional without modification.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `image` field not declared in `auth-fields.ts` → silently `undefined` at runtime | Verify during U3 before adding to query return shape; add declaration if missing |
| `revalidatePath` calls for the old `/people/directory/[id]` path left unreachable after U6 | Grep for all `revalidatePath` containing `people/directory` before closing U6; update every occurrence |
| `people-table.tsx` used elsewhere with an implicit `/people/directory/...` routing assumption | Research confirms only one `router.push` call in that file; verify no other callers pass in the path |
| Admin layout (U1) compiled before any `/admin/*` page exists | Layout and first page (U5 or U6) should land in the same PR or the layout file will have no routes to protect temporarily — acceptable for a feature branch |
| Groups schema may not have admin-relevant columns (Slack mapping, archived flag) | Check `src/db/schema/` for the `group` table during U9; if columns are missing, the admin table shows what's available and column expansion is follow-up work |
| Authority editor extraction (U10) may be tightly coupled to the per-person context it currently lives in | Review `authority-editor.tsx` props during U6 move; if extraction is complex, U10 can ship with a link to the per-person editor temporarily before the full Settings UI is ready |

---

## Sources & References

- **Origin document:** [`docs/brainstorms/2026-05-20-navigation-redesign-requirements.md`](docs/brainstorms/2026-05-20-navigation-redesign-requirements.md)
- Pagination convention: `docs/solutions/conventions/pagination-server-pagecount-pattern-2026-05-18.md`
- Permission API convention: `docs/solutions/conventions/reusable-permission-policy-api-2026-05-02.md`
- Member lifecycle: `docs/solutions/architecture-patterns/member-lifecycle-entry-points-and-application-flow-2026-05-10.md`
- Nav component: `src/components/nav-main.tsx`
- Sidebar primitives: `src/components/ui/sidebar.tsx`
- Authority model: `src/lib/authority/model.ts`
- Permission evaluator: `src/lib/permissions/evaluate.ts`
- People queries: `src/db/people.ts`
- Groups queries: `src/db/groups.ts`
