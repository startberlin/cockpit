---
title: "feat: Add org chart page for organisation overview"
type: feat
status: active
date: 2026-05-21
origin: docs/brainstorms/2026-05-21-org-chart-requirements.md
---

# feat: Add org chart page for organisation overview

## Summary

Add a dedicated `/people/org-chart` page that renders the START Berlin organisation as a React Flow canvas. Global officers (President, VP, Head of Finance) appear as a floating top row with no edges; department columns appear below, each with a dept head as the root and members as children. A batch filter (URL param) narrows visible cards while keeping officers and department columns always present. Departments are collapsible. The page is linked from the sidebar Community group.

---

## Problem Frame

The people directory is a search-and-browse tool for individual members; there is no way to see how the organisation is structured — who holds which leadership role, which department a person belongs to, or how the hierarchy flows. (See origin: `docs/brainstorms/2026-05-21-org-chart-requirements.md`.)

---

## Requirements

- R1. A new page exists at `/people/org-chart` and is reachable from the Community section in the sidebar.
- R2. Global officers (President, VP, Head of Finance) appear in a top row of cards with no connecting edges to anything below them.
- R3. Each department has a visible column; the column remains visible even when its head and all members are hidden by the batch filter.
- R4. Department head cards appear as the root of their department column; member cards appear below, connected by edges.
- R5. A single-select batch filter hides non-matching dept head and member cards; global officers are never hidden by the filter.
- R6. Clicking a toggle on a department head card collapses or expands the member nodes for that department.
- R7. Only users with status `member` or `onboarding` are shown; users without a department and without an org position are excluded.
- R8. Global officers are never duplicated into a department section, even if `user.department` is set.
- R9. Cards use the same design as the existing `PersonCard`; global position holders and dept heads show a role badge.

---

## Scope Boundaries

- No click-to-navigate on person cards (read-only).
- No search or highlight within the chart.
- No status filter UI — `member` and `onboarding` are hardcoded inclusion criteria.
- No mobile-optimised layout — pan/zoom touch is acceptable.
- No Dagre or force-directed layout engine — positions are computed manually.

### Deferred to Follow-Up Work

- Linking a person card to their profile page: separate PR.

---

## Context & Research

### Relevant Code and Patterns

- `src/db/people.ts` — pattern for public user data queries; `getAllUserPublicData` uses `db.select()` with a `where` clause; `getUserPublicData` uses `db.query.user.findFirst` with `with: { organizationPositions: true }`. New org chart query follows the relational `findMany` pattern.
- `src/db/authority.ts` — `getAllUserAuthorities()` fetches all users with `with: { organizationPositions: true, accessGrants: true }`. This is the closest existing query shape; the new query is a lighter variant for the org chart.
- `src/db/schema/authority.ts` — `userOrganizationPosition` table; positions `president | vice_president | head_of_finance | department_head`; global positions have `scope: 'global'`, dept head has `scope: 'department'` and a non-null `department`.
- `src/lib/authority/model.ts` — `globalOrganizationPositions`, `departmentHeadPosition`, `OrganizationPosition` type.
- `src/lib/departments.ts` — `DEPARTMENT_IDS` and `DEPARTMENT_NAMES` — use these for column ordering and display labels.
- `src/app/(authenticated)/(app)/people/page-client.tsx` — `PersonCard` component (avatar, name, dept label, batch number, badge) to mirror visually.
- `src/app/(authenticated)/(app)/people/page.tsx` and `loading.tsx` — page/skeleton pattern to follow.
- `src/app/(authenticated)/(app)/people/search-params.ts` — nuqs parser pattern; `parseAsInteger` for the batch param.
- `src/components/nav-main.tsx` — Community sidebar group; add entry between People and Groups.
- `src/db/schema/index.ts` — `usersRelations` defines `organizationPositions: many(userOrganizationPosition)` — available as a `with:` clause on `db.query.user.findMany`.

### Institutional Learnings

- No directly applicable `docs/solutions/` entries for React Flow or org charts. Follow established Drizzle relational query and nuqs URL state patterns.

### External References

- `@xyflow/react` v12 is not yet in the project; install it. CSS must be imported in a client component (`import '@xyflow/react/dist/style.css'`). In Next.js App Router, this works fine inside a `"use client"` file.
- React Flow manual positioning: nodes receive `position: { x, y }` directly; no layout engine needed when structure is predetermined.
- Collapse/expand: toggle member nodes and their edges from the visible set; simplest approach is to compute the rendered node/edge arrays from full data + filter state rather than mutating individual node `hidden` flags.

---

## Key Technical Decisions

- **Separate DB module for org chart data**: Add `getOrgChartData` to `src/db/people.ts` (consistent with existing public user data functions) rather than `src/db/authority.ts` (which is for permission/authority concerns) or a new file (unnecessary split for one query).
- **Pure transformer in `src/lib/org-chart.ts`**: Convert DB rows to a typed intermediate structure (`OrgChartEntry` array with role, department, position). A second function converts this + filter state to React Flow `Node[]` and `Edge[]`. Separating DB shape from React Flow shape keeps the transformer unit-testable without React Flow.
- **Batch filter as URL param, collapse as React state**: Batch filter belongs in the URL (shareable, survives navigation); collapse is ephemeral interaction state — `useState(new Set<Department>())` is sufficient.
- **Department header node always present**: Each department always gets a header-style node showing the dept name. The dept head person card is a separate node (visible only when head exists and passes batch filter). This ensures R3 (dept column always visible) without custom React Flow group nodes.
- **Manual x/y layout**: Top row (officers) at `y = 0`; dept header row at `y = OFFICER_ROW_HEIGHT + ROW_GAP`; dept head cards one step below; member cards arranged in a sub-tree below their head. The implementer should compute exact values based on card dimensions chosen at implementation time.
- **Filter produces derived node/edge arrays**: Client component derives `visibleNodes` and `visibleEdges` from the full set using `useMemo`, driven by batch filter + collapsed dept set. Avoids React Flow's `hidden` property toggling, which can cause layout artifacts.
- **`@xyflow/react` (no Dagre)**: The layout is predetermined; Dagre adds complexity without benefit here.

---

## Open Questions

### Resolved During Planning

- *Where should dept head appear when batch-filtered?* → Dept head card is hidden when the filter excludes them; the dept header node (dept name label) stays visible to satisfy R3.
- *Should P/VP/HoF appear in a dept section too if `user.department` is set?* → No — they appear in the top row only (R8).
- *Collapse toggle placement?* → On the dept head card itself (a chevron or expand/collapse icon). If no dept head exists, the dept header node carries the toggle.

### Deferred to Implementation

- *Exact card dimensions (width, height) and gap constants*: Choose values that look right in the browser; the transformer must accept them as configuration or constants rather than hard-coding in multiple places.
- *React Flow `fitView` options*: Tune `fitView` padding and min-zoom at implementation time after seeing the real data density.

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
DB query (server component)
  └─ getOrgChartData() → OrgChartUser[]
        ↓ passed as prop
  Client component (page-client.tsx)
        ↓ useMemo
  buildOrgChart(users) → { allNodes: OrgChartNode[], allEdges: OrgChartEdge[] }
        ↓ useMemo  (re-runs on batchFilter or collapsedDepts change)
  applyFilters(allNodes, allEdges, { batchFilter, collapsedDepts })
    → { visibleNodes: Node[], visibleEdges: Edge[] }
        ↓
  <ReactFlow nodes={visibleNodes} edges={visibleEdges} ... />
```

Node tiers in `allNodes`:
```
Tier 0: officer nodes       (president, vice_president, head_of_finance) — never filtered
Tier 1: dept header nodes   (one per dept from DEPARTMENT_IDS) — never filtered
Tier 2: dept head cards     (person nodes) — filtered by batch
Tier 3: member cards        (person nodes) — filtered by batch; also hidden when dept is collapsed
```

Edges: only between Tier 2 and Tier 3 (dept head → member). No edges touch Tier 0 or Tier 1.

---

## Implementation Units

### U1. Install `@xyflow/react`

**Goal:** Add the React Flow dependency to the project.

**Requirements:** R2, R4, R6

**Dependencies:** None

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (or equivalent lockfile)

**Approach:**
- Run `npm install @xyflow/react` (or equivalent). No `@dagrejs/dagre` needed.
- Verify the package installs correctly and the project still builds.

**Test scenarios:**
- Test expectation: none — dependency installation; no behavioral change.

**Verification:**
- `@xyflow/react` appears in `package.json` dependencies; `npm run build` passes.

---

### U2. Org chart DB query

**Goal:** Fetch all eligible users with their org positions and batch numbers in a single query, shaped for the org chart.

**Requirements:** R7, R8

**Dependencies:** None (data model already exists)

**Files:**
- Modify: `src/db/people.ts`

**Approach:**
- Add `OrgChartUser` interface: `id`, `firstName`, `lastName`, `image | null`, `department: Department | null`, `batchNumber: number | null`, `status: UserStatus`, `positions: Array<{ position: OrganizationPosition; scope: AuthorityScope; department: Department | null }>`.
- Add `getOrgChartData(): Promise<OrgChartUser[]>` using `db.query.user.findMany` with `with: { organizationPositions: true, batch: true }`.
- `where` clause: `inArray(user.status, ['member', 'onboarding'])`.
- Include all users (department filter is applied in the transformer, not the query) so the transformer has full data to build the org chart.
- Map result to `OrgChartUser[]`.

**Patterns to follow:**
- `getAllUserAuthorities()` in `src/db/authority.ts` — same relational query shape.
- `getAllUserPublicData` in `src/db/people.ts` — status filter pattern.

**Test scenarios:**
- Test expectation: none — DB query with no transform logic. Integration correctness verified via U3's unit tests which use typed test fixtures.

**Verification:**
- TypeScript compiles with no errors; `OrgChartUser[]` type is exported; query is callable from the page server component.

---

### U3. Org chart layout and filter logic

**Goal:** Pure functions that transform `OrgChartUser[]` into typed React Flow node/edge data, and apply batch filter and collapse state.

**Requirements:** R2, R3, R4, R5, R6, R7, R8

**Dependencies:** U2 (for `OrgChartUser` type)

**Files:**
- Create: `src/lib/org-chart.ts`
- Create: `src/lib/org-chart.test.ts`

**Approach:**
- `buildOrgChart(users: OrgChartUser[], cardSize: { w: number; h: number }, gaps: { h: number; v: number; col: number }): { nodes: OrgChartNode[]; edges: OrgChartEdge[] }`:
  - Separate users into: global officers (P/VP/HoF), dept heads (by their position's `department`), and regular members (by `user.department`). P/VP/HoF are excluded from all other categories even if `user.department` is set.
  - Compute x/y positions: officers in a horizontal row at `y=0`; dept header nodes across the x-axis at `y = cardH + vertGap`; dept head person cards one row below that; member cards as a sub-tree below their dept head.
  - Produce a dept header node for every entry in `DEPARTMENT_IDS` (using `DEPARTMENT_NAMES` for the label), regardless of whether there is a dept head or members.
  - Use stable IDs: `'officer-{position}'`, `'dept-header-{department}'`, `'dept-head-{department}'`, `'member-{userId}'`.
  - Edges only between dept head cards and member cards.
- `applyFilters(nodes: OrgChartNode[], edges: OrgChartEdge[], opts: { batchFilter: number | null; collapsedDepts: Set<Department> }): { nodes: OrgChartNode[]; edges: OrgChartEdge[] }`:
  - Officers: always included.
  - Dept header nodes: always included.
  - Dept head cards: included only if `batchFilter === null` or `user.batchNumber === batchFilter`.
  - Member cards: included only if `batchFilter === null` or `user.batchNumber === batchFilter`, AND the member's department is not in `collapsedDepts`.
  - Edges: included only if both source and target nodes are in the filtered node set.

**Patterns to follow:**
- `src/lib/authority/model.ts` — pure TypeScript logic modules.
- `DEPARTMENT_IDS` and `DEPARTMENT_NAMES` from `src/lib/departments.ts`.

**Test scenarios:**
- Happy path: president, VP, and HoF each appear in `buildOrgChart` output as officer nodes at `y=0`.
- Happy path: `DEPARTMENT_IDS` produces one dept header node per department regardless of whether that dept has a head or members.
- Happy path: dept head card appears at the dept root for its assigned department; regular members of that dept appear as children with edges connecting them.
- Happy path: user with global officer position and `user.department` set appears only in the officer row — not also as a member or dept head in the dept section.
- Happy path: `applyFilters` with `batchFilter = 5` keeps global officers visible; hides dept head and member cards whose `batchNumber !== 5`; keeps dept header nodes visible.
- Edge case: department with no head assigned produces a dept header node but no dept head card and no edges.
- Edge case: department with a head but zero members produces a dept header node + dept head card + zero edges.
- Edge case: user with `department: null` and no position is absent from all output.
- Edge case: `collapsedDepts` containing a department hides that dept's member nodes but not the dept header or dept head card.
- Edge case: applying both a batch filter and a collapsed dept — the member is hidden if either condition applies.
- Edge case: when a dept head is batch-filtered out, edges targeting that head are also absent; the dept header node remains.
- Integration: `applyFilters` after `buildOrgChart` with no batch filter and empty collapsed set returns all nodes and all edges.

**Verification:**
- `src/lib/org-chart.test.ts` passes via `npm test`.
- TypeScript compiles cleanly.

---

### U4. React Flow org chart component

**Goal:** Client component that renders the org chart canvas with a batch filter control and collapsible departments.

**Requirements:** R2, R3, R4, R5, R6, R9

**Dependencies:** U1, U3

**Files:**
- Create: `src/app/(authenticated)/(app)/people/org-chart/page-client.tsx`

**Approach:**
- `"use client"` component; import `@xyflow/react/dist/style.css` here.
- Props: `users: OrgChartUser[]`, `batches: { number: number }[]`.
- `const [batchFilter, setBatchFilter] = useQueryState('batch', parseAsInteger)` — nuqs, shallow, clearOnDefault.
- `const [collapsedDepts, setCollapsedDepts] = useState<Set<Department>>(new Set())`.
- `const { nodes: allNodes, edges: allEdges } = useMemo(() => buildOrgChart(users, CARD_SIZE, GAPS), [users])`.
- `const { nodes, edges } = useMemo(() => applyFilters(allNodes, allEdges, { batchFilter, collapsedDepts }), [allNodes, allEdges, batchFilter, collapsedDepts])`.
- Render `<ReactFlow nodes={nodes} edges={edges} fitView nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} />`.
- **Batch filter UI**: A `<Select>` above the canvas (using the existing shadcn Select from `src/components/ui/`) showing "All batches" and each batch number. Updates `batchFilter` via nuqs.
- **Collapse toggle**: The `onNodeClick` callback intercepts clicks on dept header or dept head nodes; toggles the dept in `collapsedDepts`. Or, each custom node renders a collapse button that calls a callback.
- **Custom node types**: Define a `personNodeType` (renders a card consistent with `PersonCard`: avatar, name, batch number, dept label, role badge) and a `deptHeaderNodeType` (shows dept name + collapse icon). Pass `nodeTypes` to `<ReactFlow>`.
- Cards are read-only; no drag, connect, or select.

**Patterns to follow:**
- `PersonCard` in `src/app/(authenticated)/(app)/people/page-client.tsx` — avatar, name, badge layout.
- shadcn `Select` and `Badge` components from `src/components/ui/`.
- nuqs `useQueryState` pattern from `src/app/(authenticated)/(app)/people/page-client.tsx`.

**Test scenarios:**
- Test expectation: none for unit tests — logic-heavy assertions live in `src/lib/org-chart.test.ts`. Correctness verified via browser.
- Browser: with no batch filter, all officer cards and dept header nodes are visible.
- Browser: selecting a batch number hides non-matching dept head and member cards; officer cards remain.
- Browser: clicking collapse on a dept head / dept header hides that dept's member cards.
- Browser: expanding restores member cards.
- Browser: `fitView` produces a non-blank canvas on a standard desktop viewport.

**Verification:**
- No TypeScript errors; `npm run lint` passes.
- Browser shows the org chart canvas with correct layout.

---

### U5. Org chart page route and loading skeleton

**Goal:** Server component page that fetches org chart data and renders the client component; loading skeleton shaped like the two-tier layout.

**Requirements:** R1, R5 (batch list for the filter)

**Dependencies:** U2, U4

**Files:**
- Create: `src/app/(authenticated)/(app)/people/org-chart/page.tsx`
- Create: `src/app/(authenticated)/(app)/people/org-chart/loading.tsx`

**Approach:**
- `page.tsx`: async server component; calls `getOrgChartData()` and fetches batches from the `batch` table (same query as in `src/app/(authenticated)/(app)/people/page.tsx`). Renders page heading and `<OrgChartPageClient users={users} batches={batches} />`.
- `loading.tsx`: skeleton matching the two-tier layout — a row of officer card skeletons at the top (3 wide rectangles), then a row of department column skeletons below (5 narrower tall rectangles). Use `Skeleton` from `src/components/ui/skeleton`.
- No `searchParams` needed on the server component; the batch filter is client-side URL state read by the client component.

**Patterns to follow:**
- `src/app/(authenticated)/(app)/people/page.tsx` — server component structure.
- `src/app/(authenticated)/(app)/people/loading.tsx` — skeleton using `Skeleton`.

**Test scenarios:**
- Test expectation: none — server component wiring; correctness verified by browser navigation.

**Verification:**
- Navigating to `/people/org-chart` renders the page without errors.
- The loading skeleton appears briefly during server render before the client component hydrates.

---

### U6. Sidebar navigation entry

**Goal:** Add "Org Chart" to the Community group in the sidebar, between People and Groups.

**Requirements:** R1

**Dependencies:** None (independent of all other units)

**Files:**
- Modify: `src/components/nav-main.tsx`

**Approach:**
- Add a new `<SidebarMenuItem>` with `<SidebarMenuButton asChild isActive={pathname === '/people/org-chart'} tooltip="Org Chart">` wrapping a `<Link href="/people/org-chart">` with an appropriate icon (e.g., `NetworkIcon` or `SitemapIcon` from lucide-react) and label "Org Chart".
- Insert between the existing People and Groups items in the Community `<SidebarGroup>`.

**Patterns to follow:**
- Existing People and Groups entries in `src/components/nav-main.tsx`.

**Test scenarios:**
- Test expectation: none — UI nav entry; correctness verified by browser.

**Verification:**
- The Community sidebar group shows "People / Org Chart / Groups" in order.
- The "Org Chart" item is highlighted when the current path is `/people/org-chart`.

---

## System-Wide Impact

- **Interaction graph:** New page; no hooks, middleware, or observers affected. Sidebar `NavMain` is a client component already reading `usePathname`, no change to that pattern.
- **Error propagation:** `getOrgChartData` failing will surface via the page's error boundary (Next.js default); the chart canvas failing in the client component is isolated.
- **State lifecycle risks:** None — no mutations, no persistent state beyond URL params.
- **API surface parity:** None — no new API routes.
- **Integration coverage:** U3's test suite covers the full hierarchy rules end-to-end using fixture data. Browser verification covers the React Flow rendering layer.
- **Unchanged invariants:** Existing `/people` directory page, its filters, and all existing nav entries are untouched.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| React Flow CSS leaking into global styles | Import `@xyflow/react/dist/style.css` only in the `"use client"` page-client file; this is isolated to the org chart page bundle |
| Manual layout breaks with large member counts (many members per dept) | Keep member cards in a vertical stack per dept initially; implement horizontal fan only if visual testing shows the vertical stack is too tall |
| Org chart data is empty (no positions assigned yet in staging/prod) | The page still renders correctly — officer nodes are absent, dept header nodes are all shown with no children |
| `@xyflow/react` bundle size impact | React Flow is lazy-loaded with the page route; it does not affect the main bundle |
| `lucide-react` missing a suitable org/network icon | Use any appropriate icon available; do not block on icon aesthetics |

---

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-21-org-chart-requirements.md](docs/brainstorms/2026-05-21-org-chart-requirements.md)
- Related code: `src/db/authority.ts` — `getAllUserAuthorities` pattern; `src/db/people.ts` — public user data query pattern
- Superseded plan: `docs/plans/2026-04-28-001-feat-people-org-chart-view-plan.md` (pre-authority-model, different scope)
- External: `@xyflow/react` — `https://reactflow.dev/api-reference`
- Reference implementation — tree collapse/expand pattern: `https://github.com/justinfernald/react-flow-tree-expand-collapse`
- Reference implementation — React Flow PoC patterns: `https://github.com/hongjs/poc-reactflow`
