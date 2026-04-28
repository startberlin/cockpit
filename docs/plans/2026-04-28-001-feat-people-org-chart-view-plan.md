---
title: People Org Chart View
status: active
created: 2026-04-28
source: user request on 2026-04-28
---

# People Org Chart View Plan

## Problem Frame

The people list currently presents members as a searchable table. The app should also support an org chart view that makes START's board and department structure visible at a glance.

The requested hierarchy is:

- President, vice president, and head of finance/treasurer must always appear at the top.
- All other board members, including department heads, should also appear at the top.
- Every department member should appear below the head of their department.
- People without a department should not appear in the org chart view.
- Use a React/Next.js-compatible layout library rather than hand-positioning the chart.

## Current Context

Relevant existing code:

- `src/app/(authenticated)/(app)/people/page.tsx` fetches `PublicUser[]` and batches, then renders `PeoplePageClient`.
- `src/app/(authenticated)/(app)/people/page-client.tsx` renders `PeopleTable` and owns the create-user dialog.
- `src/components/people-table.tsx` owns table filtering, pagination, status display, actions, and row navigation.
- `src/db/people.ts` defines `PublicUser` and `getAllUserPublicData`.
- `src/db/schema/auth.ts` defines `department` and `role`.
- `src/lib/enums.ts` maps departments to display labels.

The existing schema has `roles: role[]` with `board` and `department_lead`, and a nullable `department`. Those roles currently drive authorization through `src/lib/permissions/index.ts` and also appear in group criteria. The schema does not currently encode organizational positions such as president, vice president, treasurer/head of finance, or the scoped fact that a person leads a specific department.

No relevant prior requirements document exists in `docs/brainstorms/`. No relevant institutional learning exists under `docs/solutions/`.

## Decisions

1. Keep user attributes separated by domain.

   `status` remains lifecycle/payment/onboarding state. `roles` remains authorization state and should not be expanded with organizational titles. Organizational identity belongs in a new position model.

2. Add organizational positions as first-class domain data instead of a single `boardPosition` column.

   Rationale: a single nullable `boardPosition` would solve president/vice president/treasurer but would not scale cleanly to scoped positions such as department head, generic board members, or future positions. It would also recreate the current `roles` ambiguity under a different field name.

3. Model positions as assignments, not as one enum column on `user`.

   A user can plausibly be both a board officer and a department head, and a department-head position is scoped to a department. A `user_position` table with a position enum and optional department scope represents that without duplicating `user.department`.

4. Derive department-lead behavior from organizational positions, not auth roles.

   The chart should not depend on `roles.includes("department_lead")`. During migration, code may temporarily read legacy roles only as a fallback for existing data, but the target model is position-driven.

5. Keep department presence as the org chart eligibility rule.

   A user appears in the org chart only when `user.department` is set. This preserves the original requirement directly: people without a department should not appear in this view. President, vice president, and head of finance should therefore be treated as data that must have a department assignment before the chart can show them.

6. Use `@xyflow/react` with `@dagrejs/dagre` for the org chart layout.

   Rationale: React Flow is a maintained React diagram library, and its official layouting guide recommends Dagre for simple tree layouts. The org chart is a directed hierarchy with fixed node cards, which fits Dagre better than a heavier async engine such as ELK. React Flow's own docs note that Dagre is a simple drop-in option for trees: `https://reactflow.dev/learn/layouting/layouting`.

7. Make the org chart a sibling view to the table, not a replacement.

   The people page should expose a compact view switcher for table vs org chart. The existing table remains the default operational workflow for search, pagination, status, and user actions.

## Scope

In scope:

- Add the data needed to identify organizational positions.
- Expose active organizational positions through `PublicUser`.
- Add an org chart view on the existing people page.
- Build a pure org-chart data builder that transforms users into nodes and edges.
- Add focused tests for the hierarchy rules.
- Add the required chart/layout dependencies.

Out of scope:

- Editing roles, departments, or positions in this same feature.
- Changing permissions.
- Replacing the people table.
- Showing people without a department anywhere in the org chart.
- Creating a separate organization-management page.

## Data Model

Add a position assignment table instead of adding position values to auth roles or status.

Suggested enum values:

- `president`
- `vice_president`
- `head_of_finance`
- `department_head`
- `board_member`

Suggested table: `user_position`

- `id`
- `userId`
- `position`
- `department`
- `createdAt`
- optional later extension: `startsAt`, `endsAt`, or `sortOrder`

Rules:

- `department` is required for `department_head`.
- `department` is null for global board positions such as president, vice president, head of finance, and generic board member.
- A user may have multiple position assignments.
- A department should have at most one active `department_head` assignment for the first version. If the database cannot express that partial uniqueness cleanly in the initial migration, enforce it in the mutation layer when position editing is later added.
- A `department_head` assignment is the persisted fact that a user leads that department. Do not also require a separate `board_member` assignment for that same fact; the org chart and future implicit permissions can derive board-level behavior from `department_head`.
- For `department_head`, the position assignment's `department` is the leadership scope. The user's own `user.department` is still the membership/home department used for chart eligibility and child grouping. In normal data these should match; if they do not, the builder should use the position scope for leadership and the user's department for membership.

Files:

- Create `src/db/schema/position.ts`
- Modify `src/db/schema/index.ts`
- Add a generated Drizzle migration under `src/db/migrations/`
- Modify `src/db/people.ts`

Behavior:

- A person with `president`, `vice_president`, `head_of_finance`, `board_member`, or `department_head` is treated as top-level only when `user.department` is set.
- A person with `department_head` and a scoped department becomes the parent for members of that department.
- A person with no `department` cannot appear in the org chart, even with a global board/officer position.
- If a required officer has no department, the data is incomplete for this view. The view should omit the person and optionally surface a quiet admin-facing warning later; position editing/validation is outside this feature.

Open implementation choice:

- Whether to add validation now or later so global officer positions cannot be assigned to users without departments. The plan defers editing/validation UI, but implementation should not loosen the display rule.

### Why Not Reuse `roles`?

`roles` currently mixes authorization and organization shape. The user's direction is to move roles toward authorization-only and later toward implicit permissions, where department leadership or board positions can grant permissions without being stored as auth roles. Adding president or head-of-finance values to `roles` would deepen the domain mix and make the future permission migration harder.

### Why Not `boardPosition`?

`boardPosition` is better than overloading `roles`, but it is still too narrow. It cannot represent:

- department heads without turning `user.department` into a leadership field
- users with more than one organizational position
- generic board members who are board-level but not president, vice president, or head of finance
- future scoped positions

The assignment table is slightly more work now, but it gives the org chart and future implicit-permission model the same clean source of truth.

## UI Design

Create a dedicated org chart component rather than expanding `PeopleTable`.

Files:

- Modify `src/app/(authenticated)/(app)/people/page-client.tsx`
- Create `src/components/people-org-chart.tsx`
- Create `src/components/people-org-chart-data.ts`
- Optionally create `src/components/people-view-switcher.tsx` if the view control becomes bulky

View behavior:

- `PeoplePageClient` owns `view: "table" | "org-chart"`.
- The table view renders the existing `PeopleTable`.
- The org chart view renders `PeopleOrgChart`.
- The create-user button remains available from the page-level toolbar or stays in the table toolbar only. Preferred: lift the create button to the shared people page toolbar so it remains available in both views.

Org chart presentation:

- Top row contains officer, board-member, and department-head nodes.
- Department members appear below their department head.
- Node cards show name, department label, and a compact role/position badge.
- Clicking a node navigates to `/people/:id`, matching table row behavior.
- The chart should use `fitView`, pan/zoom, and non-editable nodes/edges.
- Use responsive height constraints so the chart is usable on desktop and mobile.
- Include an empty state when no users qualify for the org chart.

## Hierarchy Rules

Ordering:

1. President
2. Vice president
3. Head of finance / treasurer
4. Other board members
5. Department heads not already covered above

Department child assignment:

- Exclude users without `department` from all chart output.
- Exclude users who are top-level officer/board-member/department-head nodes from being repeated as children.
- For each department, find `department_head` position assignments scoped to that department.
- Attach non-head department members to the deterministic primary head for that department.
- If a department has no head, either omit its members or create a synthetic department node. Preferred: create a synthetic department node, because otherwise valid department members disappear without explanation.

Synthetic department nodes:

- Id format: `department:${department}`
- Label: department display name
- Position badge: `No head`
- Parent: top-level synthetic root only for layout purposes, or no visible parent if React Flow/Dagre handles separate components cleanly.

## Dependencies

Add:

- `@xyflow/react`
- `@dagrejs/dagre`

Import React Flow CSS in the client org chart component:

- `@xyflow/react/dist/style.css`

External reference:

- React Flow layouting guide: `https://reactflow.dev/learn/layouting/layouting`
- React Flow Dagre tree example: `https://reactflow.dev/examples/layout/dagre`

## Implementation Units

### U1. Organizational Position Schema and Public User Data

Goal: Make organizational positions available to the people page without adding more meaning to auth roles.

Files:

- Create `src/db/schema/position.ts`
- Modify `src/db/schema/index.ts`
- Add migration under `src/db/migrations/`
- Modify `src/db/people.ts`

Test files:

- `src/components/people-org-chart-data.test.ts`

Test scenarios:

- User with `position: "president"` and a department is eligible for top-level placement even when not a department head.
- User with `position: "president"` but no department is omitted from chart output.
- User with `position: "board_member"` is eligible for top-level placement without a specific officer position.
- User with `position: "department_head"` and `department: "events"` becomes the head for Events members.
- `PublicUser` includes positions without changing existing table status behavior.
- Existing auth `roles` are not used as the primary source for org chart hierarchy.

### U2. Org Chart Data Builder

Goal: Centralize hierarchy rules in a pure TypeScript module.

Files:

- Create `src/components/people-org-chart-data.ts`

Test files:

- Create `src/components/people-org-chart-data.test.ts`

Test scenarios:

- President, vice president, and head of finance sort before other board members.
- Department heads appear at the top and receive their department members as children.
- People with no department are not included anywhere in the chart.
- Non-board users with a department and no department head are grouped under a synthetic department node.
- Users who are both board members and department heads are not duplicated.
- Multiple department-head assignments for the same department produce deterministic output and should be flagged as invalid data in the builder result if the component has room to surface a quiet warning.

### U3. Org Chart React Flow Component

Goal: Render the hierarchy with a maintained diagram/layout library.

Files:

- Create `src/components/people-org-chart.tsx`

Test files:

- Keep logic-heavy assertions in `src/components/people-org-chart-data.test.ts`.
- Add a lightweight component test only if the repo already has a React component test harness by implementation time. Otherwise rely on browser verification plus the pure builder tests.

Test scenarios:

- Empty qualified data renders an empty state.
- Clicking a node routes to that member's detail page.
- Nodes are non-editable and the view remains pan/zoom-only.
- Chart renders without overlapping top-level and department-child nodes at common desktop and mobile viewport widths.

### U4. People Page View Switcher

Goal: Add the org chart as a first-class alternate view while preserving table workflows.

Files:

- Modify `src/app/(authenticated)/(app)/people/page-client.tsx`
- Modify `src/components/people-table.tsx` only if the create-user action needs to be lifted out of the table toolbar
- Optionally create `src/components/people-view-switcher.tsx`

Test files:

- Prefer browser verification for the view switcher unless a component test harness exists.

Test scenarios:

- Default view remains the current table.
- Switching to org chart does not open the create-user dialog or clear server data.
- Create-user remains available according to the existing `users.create` permission behavior.
- Returning to table preserves table behavior, including name filtering and row navigation.

### U5. Dependency and Styling Integration

Goal: Add chart dependencies and style the view within the existing Tailwind/shadcn aesthetic.

Files:

- Modify `package.json`
- Modify lockfile
- Style within `src/components/people-org-chart.tsx`

Test files:

- No dedicated unit test.

Test scenarios:

- `npm run lint` passes.
- `npm test` passes.
- Manual browser verification confirms chart CSS loads and the canvas is nonblank.

## Sequencing

1. Add position schema and generated migration.
2. Extend `PublicUser` and data fetching.
3. Implement and test the pure hierarchy builder.
4. Add React Flow/Dagre rendering component.
5. Integrate the page-level view switcher.
6. Run unit tests, lint, and browser verification.

## Risks

- Existing data may not have organizational positions populated. Mitigation: ship the table and seed/manual update current president, vice president, head of finance, board members, and department heads before relying on the view operationally.
- Required officers may lack department assignments. Mitigation: treat that as incomplete data for this view and assign departments before relying on the chart.
- Group criteria currently filter on auth roles such as `department_lead`. Mitigation: do not expand that pattern for the org chart; handle broader criteria migration separately when roles are replaced by implicit permissions.
- React Flow CSS import must be loaded from a client component without fighting the app's global styles.
- Large member counts can make a single org chart dense. Mitigation: start with fitView, pan/zoom, compact cards, and deterministic grouping; defer filtering/collapse controls until usage shows a need.
- Ambiguous departments without leads can either disappear or need synthetic nodes. The plan chooses synthetic department nodes so assigned members remain visible.

## Acceptance Criteria

- People page has a table view and an org chart view.
- President, vice president, head of finance/treasurer, all board members, and department heads appear in the top layer.
- Department members appear below their department head when one exists.
- People without departments are not shown as department members.
- Existing people table behavior remains intact.
- Hierarchy rules are covered by focused tests.
- The implementation uses a React layout/diagram library rather than hand-positioning the tree.
