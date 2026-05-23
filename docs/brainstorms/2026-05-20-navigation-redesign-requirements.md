---
title: Navigation Redesign — Grouped Sidebar with Admin Section
date: 2026-05-20
status: ready-for-planning
---

# Navigation Redesign — Grouped Sidebar with Admin Section

## Problem

The current sidebar is a flat list of four items with no conceptual separation between what a member sees and what an admin manages. As a result:

- Admin actions (propose membership, authority management, batch management) appear in the same pages as member browsing flows, creating clutter and confusion.
- An admin who just wants to browse the directory as a fellow member cannot do so without encountering management controls.
- There is no structural room to grow: adding more pages in the future would extend an undifferentiated list.

## Goals

1. Separate the member browsing experience from the admin management experience — both at the visual (nav) and URL level.
2. Give the sidebar three named groups: **Personal**, **Community**, and **Admin**. Each admin nav item is independently gated by its own permission; the Admin group label renders only when the user has at least one visible item inside it.
3. Ensure that admins can freely browse the community section without any admin controls, and separately enter the admin section when they need to manage things.
4. Establish a scalable nav structure that can accommodate future pages without the flat-list problem.

## Non-goals

- New features not currently in the codebase (invitations, matching rules, audit log, org chart, personal profile editing).
- Changing the underlying data or business logic of any page — only the information presented and the URL structure change.
- Redesigning any page's visual style beyond what follows from removing/adding specific content.

---

## Sidebar Structure

The sidebar is divided into three named groups. Group labels are shown when the sidebar is expanded; in icon-only collapse mode, items show tooltips.

```
Personal
  My membership

Community
  Directory
  Groups

Admin                    ← only visible when user has ≥ 1 admin permission
  People
    ├── Directory
    └── Batches
  Groups
  Payments
  Settings               ← only visible to admin / super_admin grant holders
```

### Admin group visibility

Each item inside the Admin group is independently gated by its own permission. The Admin group label itself is rendered if and only if at least one of its items would be visible to the current user. There is no separate "show the group" check — group visibility is derived bottom-up from item visibility.

Per-item permission gates:

| Nav item | Visible when |
|---|---|
| People > Directory | `admin`, `super_admin`, or `people_admin` grant — OR — `department_head` position (any dept) |
| People > Batches | `admin` grant only (`batches.manage` permission) |
| Groups | `admin`, `super_admin`, or `people_admin` grant (`groups.view_all` / `groups.create` permissions) |
| Payments | `head_of_finance` position OR `finance_admin` grant (`payments.manage` permission) |
| Settings | `admin` or `super_admin` grant only |

Examples of what each user type sees:

| User | Admin group | Items shown |
|---|---|---|
| Plain member | Hidden | — |
| Department head only | Shown | People > Directory (scoped to their dept) |
| `people_admin` grant | Shown | People > Directory, People > Batches, Groups |
| `finance_admin` or `head_of_finance` | Shown | Payments |
| `admin` grant | Shown | All five items |
| `super_admin` grant | Shown | All five items |

A user who holds e.g. `finance_admin` sees the Admin group with only the Payments item inside it — no People, no Groups, no Settings.

### Collapsible People item

Admin > People is a collapsible nav item. Its two sub-items (Directory, Batches) are each gated independently — a `department_head` without an `admin` grant sees Directory but not Batches. The People parent item is shown only when at least one of its sub-items is visible. It opens by default when the active route is under `/admin/people/*`.

---

## Page Inventory

For each page: current URL → new URL, who can access it, what it shows, and what changes from the current state.

---

### Personal group

#### My Membership

| Field | Value |
|---|---|
| **URL** | `/membership` (unchanged) |
| **Nav path** | Personal → My membership |
| **Access** | All authenticated users |

**Content** — unchanged from current. Shows the membership payment status card, workspace links (Slack, Notion), and member detail fields (status, batch, department, member since, workspace email).

**Changes** — none to page content. The item moves visually from the flat nav into the Personal group.

---

### Community group

#### Community Directory

| Field | Value |
|---|---|
| **URL** | `/people/directory` (unchanged) |
| **Nav path** | Community → Directory |
| **Access** | All authenticated users |

**Content** — a card grid of all community members. No individual profile pages; this is a browse-only view with no clickable detail links.

**Who is shown:** Only users with `status` IN (`onboarding`, `member`, `supporting_alumni`). Plain `alumni` users are excluded — they are no longer active in the community context.

**Data shown on each card (public fields only):**

| Field | Source | Shown |
|---|---|---|
| Full name | `firstName` + `lastName` | ✓ |
| Avatar / initials | `image` (Google OAuth photo, or initials fallback) | ✓ |
| START workspace email | `email` (e.g. `name@start-berlin.com`) | ✓ |
| Department | `department` enum | ✓ (formatted: e.g. "Operations") |
| Batch number | `batchNumber` | ✓ (e.g. "Batch #6") |
| Member status | `status` | ✓ (display label only: "Member", "Onboarding", "Alumni") |
| Personal email | `personalEmail` | ✗ private |
| Phone | `phone` | ✗ private |
| Address | `street`, `city`, etc. | ✗ private |
| Birth date | `birthDate` | ✗ private |
| Legal membership state | `legalMembershipState` | ✗ internal/legal |
| Member since date | `memberSinceDate` | ✗ internal |
| GoCardless IDs | `gocardlessCustomerId`, etc. | ✗ internal |

**Filtering:** Users can filter the grid using a combination of:
- **Search** — free-text by name or START email
- **Department** — multi-select pill filter (All / Partnerships / Operations / Community / Growth / Events); "no department" option for members without one assigned
- **Batch** — single-select dropdown or pills showing available batch numbers
- **Status** — toggle between All / Onboarding / Member / Alumni (supporting_alumni)

All filters are combinable and should reflect in the URL via query params (Nuqs).

**Layout:** Responsive card grid (e.g. `auto-fill, minmax(240px, 1fr)`). Each card: avatar, full name, department badge, batch label, status badge. Cards are not clickable (no detail route).

**What changes from current:**
- Layout changes from a paginated table to a card grid.
- Query is updated to filter by status (exclude plain `alumni`).
- Department, batch, and status filter controls are added (currently only search + no filters exist).
- `pendingActions` (board action notifications) are removed — these belong in the admin directory view.
- No admin controls, checkboxes, or management-oriented status badges (onboarding / payment pending distinction) are shown.

#### Community Groups

| Field | Value |
|---|---|
| **URL** | `/groups` (unchanged) |
| **Nav path** | Community → Groups |
| **Access** | All authenticated users |

**Content** — member browse view. Two sections: "Your groups" (groups the current user is a member of) and "All groups" (remaining groups). Each group shown as a card with name, icon, member count, description, and a join/leave button.

**What changes from current:**
- Currently `listGroupsForViewer` scopes the list to groups the user has `groups.view` permission for (own groups + admin). Under the new design, ALL groups are browsable here regardless of membership — group visibility is no longer gated in the community view.
- Admin management controls (editing group properties, managing all members) are removed from this view — they move to `/admin/groups`.
- The join/leave action remains (already a member-facing action).

#### Community Group Detail

| Field | Value |
|---|---|
| **URL** | `/groups/[id]` (unchanged) |
| **Nav path** | Community → Groups → [group name] |
| **Access** | All authenticated users |

**Content** — member view of a specific group: name, description, member list, and join/leave.

**What changes from current:** Admin management controls (edit group, manage all members, create group) are removed from this view. Those move to `/admin/groups` and its detail.

---

### Admin group

#### Admin People → Directory

| Field | Value |
|---|---|
| **URL** | `/admin/people/directory` (new) |
| **Nav path** | Admin → People → Directory |
| **Access** | admin grant, super_admin grant, people_admin grant, OR department_head position |

**Content** — admin table view of all members. This is the management-oriented counterpart to the community directory.

Layout:
- Page header: title "People", subtitle describing scope ("Every member as a record"), action buttons: **Add member**, **Export CSV**, **Sync Google Workspace**
- Search input (by name or email)
- Count / selection summary
- Members table with columns: checkbox, avatar + name, email, department, batch, status badge (active / onboarding / payment pending / alumni)
- Per-row action menu (`...`) for individual member actions
- Bulk actions toolbar (appears when rows are checked): Email, Change batch, Move to alumni

**Scoping for department heads:**
- Department heads see only members in their own department.
- The "Add member" and "Export CSV" actions are only shown to users with `users.create` / `users.import` permissions (admin / people_admin grants).
- Department heads see the filtered list and can navigate to the admin detail page for their department members.

**What changes from current:** This is a new URL. The community `/people/directory` was the only directory view. The admin-specific table UI (status badges, checkboxes, bulk actions, Add member) did not previously exist as a standalone page.

#### Admin People → Member Detail

| Field | Value |
|---|---|
| **URL** | `/admin/people/directory/[id]` (new URL, existing content) |
| **Nav path** | Admin → People → Directory → [name] |
| **Access** | admin grant, super_admin, people_admin, OR department_head with matching department |

**Content** — full admin detail view. This is the content that currently lives at `/people/directory/[id]` behind the `users.view_details` gate:
- `ProfileCard`
- `ContactCard`
- `GroupsCard`
- `AuthorityCard` — shown to users with `users.manage_authority` permission (admin / people_admin)
- `ProposeMembershipButton` — shown when eligible + user has `membership.propose` permission
- `ImpersonateButton` — shown to super_admin only

**What changes from current:** The content moves from `/people/directory/[id]` to this new `/admin/people/directory/[id]` URL. The breadcrumb updates to reflect the Admin → People → Directory path.

#### Admin People → Batches

| Field | Value |
|---|---|
| **URL** | `/admin/people/batches` (new URL; old `/people/batches` kept as-is, no redirect) |
| **Nav path** | Admin → People → Batches |
| **Access** | admin grant only (`batches.manage` permission, unchanged) |

**Content** — unchanged from the current `/people/batches` page. Batch management: creating batches, viewing batch membership, batch status.

**What changes from current:** New URL added under `/admin/*`. The old `/people/batches` continues to work; no redirect is needed.

#### Admin Groups

| Field | Value |
|---|---|
| **URL** | `/admin/groups` (new) |
| **Nav path** | Admin → Groups |
| **Access** | admin grant, super_admin, people_admin (`groups.view_all` permission) |

**Content** — admin management view of all groups.

Layout:
- Page header: title "Groups", action button: **New group**
- Groups table with columns: name + icon, member count, Slack channel mapping, auto-add status, active/archived status, action menu
- Per-group action menu: edit, archive, manage members

This view shows all groups regardless of whether the current user is a member. Group creation lives here.

**What changes from current:** Group creation and the admin-level "view all groups" functionality move to this dedicated admin URL. The community `/groups` and `/groups/[id]` pages lose their admin controls.

#### Admin Payments

| Field | Value |
|---|---|
| **URL** | `/admin/payments` (new URL; old `/payments` kept as-is, no redirect) |
| **Nav path** | Admin → Payments |
| **Access** | head_of_finance position OR finance_admin grant (`payments.manage` permission, unchanged) |

**Content** — unchanged from the current `/payments` page. Proposed payment review, payment history, payment stats.

**What changes from current:** New URL under `/admin/*`. The old `/payments` continues to work; no redirect needed.

#### Admin Settings

| Field | Value |
|---|---|
| **URL** | `/admin/settings` (new) |
| **Nav path** | Admin → Settings |
| **Access** | admin grant or super_admin grant only |

**Content** — organization-wide configuration and authority management.

Sections:
1. **Organization** — read/edit org-level fields: name, domain, yearly membership fee
2. **Roles & authority** — manage who holds which positions and grants. This consolidates the authority assignment that currently lives in `AuthorityCard` on individual person detail pages. The UX here is a roles table (president, vice-president, head_of_finance, department heads with dept assignment; admin, people_admin, finance_admin, super_admin grants) with controls to add/remove assignments.
3. **Integrations** — status of connected integrations (Google Workspace, Slack) with basic connection management

**What changes from current:** The authority assignment UI moves out of `AuthorityCard` in the per-person detail page into this central settings page. `AuthorityCard` remains on the admin member detail page as a read-only summary of a person's current authority, but all editing happens in Settings. (Implementation note for planning: this may mean `AuthorityCard` becomes read-only + a link to Settings, or the edit form in Settings is pre-filtered to that person.)

---

---

## Breadcrumb Updates

Breadcrumbs reflect the group context. The current `BreadcrumbCrumb` component needs entries for the new paths:

| Page | Breadcrumb |
|---|---|
| `/membership` | Personal → My membership |
| `/people/directory` | Community → Directory |
| `/people/directory/[id]` | Admin → People → Directory → [Full name] (admin detail only; no community profile) |
| `/groups` | Community → Groups |
| `/groups/[id]` | Community → Groups → [Group name] |
| `/admin/people/directory` | Admin → People → Directory |
| `/admin/people/directory/[id]` | Admin → People → Directory → [Full name] |
| `/admin/people/batches` | Admin → People → Batches |
| `/admin/groups` | Admin → Groups |
| `/admin/payments` | Admin → Payments |
| `/admin/settings` | Admin → Settings |

---

## Loading Skeletons

Any new or restructured pages require updated `loading.tsx` files that match their actual layout. Specifically:
- `/people/directory` — skeleton changes from table rows to a card grid with filter controls
- `/admin/people/directory` — new skeleton for table-with-header layout
- `/admin/people/directory/[id]` — same skeleton structure as current `/people/directory/[id]`
- `/admin/groups` — new skeleton for admin table
- `/admin/settings` — new skeleton matching sections layout
- `/admin/payments` — no change needed (content unchanged)

---

## Permission Summary

The Admin group items are independent — holding one permission does not grant visibility of other items. The examples below assume the user holds only the listed grant/position and nothing else.

| User | Admin items visible |
|---|---|
| Plain member | None (Admin group hidden) |
| `department_head` position only | People > Directory (scoped to their department) |
| `people_admin` grant only | People > Directory (full), People > Batches, Groups |
| `finance_admin` grant or `head_of_finance` position only | Payments |
| `admin` grant | People > Directory, People > Batches, Groups, Payments, Settings |
| `super_admin` grant | Same as admin + impersonate action on member detail |

A user can hold multiple grants/positions (e.g. `department_head` + `finance_admin`), in which case their visible items are the union of what each grant would show independently.

---

## Out of Scope

The following items were considered and intentionally deferred:

- **Individual community member profiles** — no clickable detail page from the community directory; browse-only card grid is sufficient for now
- **Personal > Profile (self-editing)** — profile editing is a separate future feature
- **URL redirects** — old URLs (`/people/batches`, `/payments`) continue working; no redirects added in this work
- **Admin > People > Invitations** — no invite logic exists yet
- **Admin > Groups > Matching rules** — no rules engine exists yet
- **Admin > Audit log** — no audit log infrastructure exists yet
- **Community > Org chart / hierarchy** — deferred future page
- **Batches as a Community nav item** — batch browsing is handled via the batch filter pills in the Community Directory
- **Payments sub-pages (Lifecycle / Exports)** — deferred; existing payments page moves as-is
