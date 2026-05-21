---
title: Org Chart Page
date: 2026-05-21
status: ready-for-planning
---

# Org Chart Page

## Problem

The people directory is a search-and-browse tool. There is no way to see who holds which leadership role, which department each member belongs to, or how the organisation is structured as a whole. An org chart view fills that gap.

## Goal

Add a dedicated `/people/org-chart` page that renders the START Berlin organisation as a visual hierarchy using React Flow: global officers at the top, department trees below, with collapsible department sections and a batch filter.

## Scope

### In scope

- New page at `/people/org-chart`
- Sidebar navigation entry in the Community group (alongside People and Groups)
- React Flow canvas rendering the full org structure
- Batch filter (single-select) to focus on members from a specific intake
- Collapsible/expandable department sections

### Out of scope

- Search or highlight within the chart
- Status filter (controlled by hardcoded inclusion rule instead)
- Mobile-optimised layout (pan/zoom touch behaviour is acceptable)
- Clicking a person card to navigate to a detail page (not requested; can be added later)

---

## Data Model (existing — no migrations needed)

| Source | Field | Used for |
|---|---|---|
| `user.department` | Department enum | Places a member into a department section |
| `user.status` | UserStatus | Inclusion filter (`member` \| `onboarding` only) |
| `user.batchNumber` | int | Batch filter |
| `userOrganizationPosition.position` | `president` \| `vice_president` \| `head_of_finance` \| `department_head` | Role badges and chart position |
| `userOrganizationPosition.department` | Department enum | Links a dept head to their department |

Departments (from `src/lib/departments.ts`): `partnerships`, `operations`, `community`, `growth`, `events`.

---

## Visual Layout

```
┌──────────────────────────────────────────────────────────────┐
│  [President card]  [Vice President card]  [Head of Finance]  │  ← top row, no edges
└──────────────────────────────────────────────────────────────┘

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  [Dept A head]  │  │  [Dept B head]  │  │  [Dept C head]  │  ← dept heads (dept_head position)
│   │         │   │  │      ↕ collapsed│  └─────────────────┘
│ [A1]      [A2]  │  └─────────────────┘     (no members)
└─────────────────┘
```

- **Top row**: President, Vice President, Head of Finance rendered as a flat row of cards with no connecting edges to anything below them.
- **Department columns**: One column per department, always visible. Each column has a dept head card at the root (if one is assigned) and member cards below it, connected by edges.
- **Department sections** are collapsible: clicking the dept head card (or a toggle) collapses the member nodes.
- **Departments with no visible members** after filtering still render as a column (possibly empty or with a subtle "No members" placeholder).

---

## Inclusion Rules

Only the following users appear in the chart:

1. Users whose `status` is `member` or `onboarding` — alumni and other statuses are excluded regardless of any filter.
2. Users who have at least one of:
   - A `userOrganizationPosition` row (any position), **or**
   - A non-null `user.department`

Users who are neither in a department nor hold a position are not shown.

### Position placement

| Position | Where they appear |
|---|---|
| `president` / `vice_president` / `head_of_finance` | Top row only. Even if `user.department` is set, they are **not** duplicated into a department section. |
| `department_head` | Root node of their assigned department column only. Not also listed as a member under themselves. |
| No position, has department | Member node under their department's head |

---

## Batch Filter

- Single-select dropdown of all available batch numbers (sourced from the `batch` table, same as the directory page).
- "All batches" is the default (no filter).
- When a batch is selected:
  - **Global positions (President, VP, HoF)**: always shown, regardless of their batch.
  - **Department head cards**: only shown if the dept head's `batchNumber` matches the filter.
  - **Member cards**: only shown if the member's `batchNumber` matches the filter.
  - **Department columns**: always remain visible even if their head and all members are filtered out.

---

## Card Design

Use a design consistent with the existing `PersonCard` in `src/app/(authenticated)/(app)/people/page-client.tsx`:

- Avatar (image or initials fallback)
- Full name
- Department name (for member cards)
- Batch number (for member cards)
- **Role badge** for global positions and dept heads, showing the position label:
  - `president` → "President"
  - `vice_president` → "Vice President"
  - `head_of_finance` → "Head of Finance"
  - `department_head` → "Department Head"

Cards in the org chart are read-only (no actions).

---

## Navigation

Add an "Org Chart" entry to the Community sidebar group in `src/components/nav-main.tsx`, between People and Groups:

```
Community
  People          → /people
  Org Chart       → /people/org-chart   ← new
  Groups          → /groups
```

Mark it active when `pathname === '/people/org-chart'`.

---

## Implementation Notes (for planning)

- Install `@xyflow/react` (React Flow v12).
- The layout is predetermined (not force-directed): manually compute node positions based on department columns and depth levels.
- Use React Flow's parent-child node grouping or subflow approach for department columns, or position nodes manually with a flat node list.
- Collapse/expand: toggle member node `hidden` property and hide edges whose source/target is hidden.
- Data fetching: a new server query (or extension of existing people queries) that returns all eligible users with their positions and department. No pagination needed — the org chart shows everyone at once.
- The page's loading skeleton should reflect the two-tier layout (a row of wide placeholder cards at the top, then department column placeholders below).

---

## Success Criteria

- Visiting `/people/org-chart` shows the full org structure with President/VP/HoF at the top and department columns below.
- Selecting a batch number hides non-matching member and dept head cards while keeping global officers and department columns visible.
- Collapsing a department hides its member nodes and their connecting edges; expanding restores them.
- No user who is neither in a department nor holds a position appears in the chart.
- The page is reachable from the sidebar under Community.
