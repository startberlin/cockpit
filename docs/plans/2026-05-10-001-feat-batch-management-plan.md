---
title: "feat: Add batch management UI"
type: feat
status: completed
date: 2026-05-10
origin: docs/brainstorms/2026-05-09-batch-management-requirements.md
---

# feat: Add batch management UI

## Summary

Implements batch creation and editing through three coordinated changes: a `"batches.manage"` permission, a Vercel-style sub-navigation row under the People section (Directory | Batches) backed by a `people/layout.tsx`, and a `/people/batches` management screen. Also extends both user-creation dialogs with a `BatchSelect` component that includes an inline quick-create shortcut so admins can register a new batch without leaving the flow. As a prerequisite, relaxes the batch field from required to optional on user records — this requires removing the NOT NULL constraint from the `batch_number` column via a schema change and migration before the validation schema and UI changes in U0 can take effect.

---

## Problem Frame

The `batch` table exists and is referenced throughout the app, but there is no UI to create or modify batch records. Admins must insert rows directly into the database to start a new intake cohort. (See origin for full framing.)

---

## Requirements

- R0. Batch is optional on user records — users may be created or imported without assigning a batch. Requires a schema migration to drop the NOT NULL constraint on `batch_number`, followed by updates to validation schemas and UI defaults.
- R1. Sub-navigation row sits directly below the main nav, brand-styled, with a "Directory" tab (all users) and a "Batches" tab (admin-only, hidden via `<Can>` for non-admins).
- R2. Existing People directory is unchanged; it becomes the "Directory" sub-page under the new nav.
- R3. `/people/batches` lists all batches (number, start date, ascending by number), supports create, and supports editing a batch's start date.
- R4. Batch number uniqueness is validated before any write; batch numbers are immutable after creation.
- R5. Both create-user and import-user dialogs gain a quick-create shortcut in their batch dropdown; newly created batches are auto-selected.
- R6. All mutations require `"batches.manage"` authority.

**Origin actors:** A1 (Operator / admin)
**Origin flows:** F1 (Create a new batch), F2 (Correct a batch start date), F3 (Quick-create a batch while adding a member)
**Origin acceptance examples:** AE1 (covers R4 — duplicate number rejected), AE2 (covers R5 — quick-create auto-selects), AE3 (covers R4 — batch number immutable on edit)
**Plan extension (R0):** Batch optional on users — not in origin document; added during planning.

---

## Scope Boundaries

- Batch deletion is out of scope.
- Schema changes to the `batch` table are out of scope — `number` (integer PK) and `startDate` (date) are sufficient.
- Sub-navigation activation in sections other than People is out of scope. The `PeopleSubNav` component and `people/layout.tsx` pattern are built to be reusable, but wiring up sub-navs in Groups, Membership, or other sections is not part of this plan.
- Any Inngest workflow or notification triggered by batch events is out of scope.

---

## Context & Research

### Relevant Code and Patterns

- `src/app/(authenticated)/(app)/layout.tsx` — authenticated shell; brand header ends after `<Navigation />`; `<main>` carries `max-w-4xl mx-auto px-6 py-6`
- `src/components/navigation.tsx` — active state via `pathname.startsWith(href)`; `/people` already matches all `/people/*` sub-routes, so main nav needs no changes
- `src/lib/permissions/evaluate.ts` — `globalActions` array + `evaluateGlobalAction` switch; add `"batches.manage"` alongside `"users.create"` gated by `hasAdminGrant`
- `src/lib/permissions/server.ts` + `src/components/can.tsx` — server `can()` and client `<Can>` / `useCan()` for enforcement and UI gating
- `src/app/(authenticated)/(app)/people/page.tsx` — server component; batch query pattern: `db.select().from(batch).orderBy(batch.number)`
- `src/app/(authenticated)/(app)/people/page-client.tsx` + `src/components/people-table.tsx` — TanStack Table + per-row action dialog pattern to follow
- `src/app/(authenticated)/(app)/people/create-user-dialog.tsx` — batch select currently at lines 201–226; `batches: { number: number }[]` prop
- `src/app/(authenticated)/(app)/people/import-google-user-dialog.tsx` — same batch select pattern
- `src/app/(authenticated)/(app)/groups/create-group-action.ts` — server action pattern (actionClient + can() + revalidatePath)
- `src/db/schema/batch.ts` — `number` integer PK, `startDate` date (resolved as `string` in queries)

### Institutional Learnings

- Permission-policy convention (`docs/solutions/conventions/reusable-permission-policy-api-2026-05-02.md`): new actions must be added to the `GlobalAction` union and `evaluateGlobalAction` switch; never import the evaluator directly from UI code; add runtime tests for both allowed and denied cases.
- Tone convention: error copy should follow "Could not [action]. Please try again. If this keeps happening, email operations@start-berlin.com." Empty states must distinguish truly-empty from filtered-empty.

### External References

- None needed — all patterns are established in the codebase.

---

## Key Technical Decisions

- **Sub-nav layout integration approach**: The `(app)/layout.tsx` brand header ends before `<main>`, so a `people/layout.tsx` cannot natively inject content into the brand section via standard nesting. Two implementation-time options are both viable; the choice should be made before U2 begins:
  - *Option A (structural, Vercel-closest)*: Remove `py-6` from `<main>` in `(app)/layout.tsx`; introduce a `PageSection` wrapper (`px-6 py-6`) used by all existing pages; `people/layout.tsx` renders a full-width brand-colored sub-nav strip (`bg-brand`, `px-6`) followed by `<PageSection>{children}</PageSection>`. Requires touching each existing `page.tsx` to add the wrapper, but produces a seamless brand-to-sub-nav transition with no CSS hacks.
  - *Option B (contained, no existing pages touched)*: Keep `(app)/layout.tsx` unchanged; `people/layout.tsx` uses `-mt-6 -mx-6` negative margins to escape `<main>`'s padding, renders the brand-colored strip at full content width, then re-applies `pt-6` for the content below. No other files change, but relies on margin tricks.
  - Whichever is chosen, the `PeopleSubNav` component itself is identical — only its container changes.

- **Batches tab visibility**: The sub-nav row renders for all authenticated users visiting any `/people` route. The "Batches" tab is hidden from non-admins via `<Can permission="batches.manage">` — only the "Directory" tab is shown to them. This means all users see the sub-nav strip with at least the "Directory" link; the strip is never fully absent.

- **`BatchSelect` extraction**: The batch dropdown with quick-create logic is extracted into `src/components/batch-select.tsx` rather than duplicated in both dialogs. Both dialogs pass their current `batches` prop plus a `value`/`onChange` pair; `BatchSelect` manages its own local state for newly created batches.

- **Quick-create state management**: After a quick-create inside `BatchSelect`, the new batch is added to local component state and auto-selected. The parent's `router.refresh()` (already called on dialog success) will eventually sync the server-fetched list. No optimistic update of the parent page's batch list is needed.

- **`revalidatePath` targets**: Both create and update actions call `revalidatePath("/people/batches")` (refreshes the batches page) and `revalidatePath("/people")` (keeps the server-rendered batch dropdown data current for the People page).

---

## Open Questions

### Resolved During Planning

- *Which authority gates the Batches screen?*: `hasAdminGrant` — same as `"users.create"`. A dedicated `"batches.manage"` action keeps intent explicit.
- *Active state for sub-nav items?*: `pathname === "/people"` → Directory; `pathname.startsWith("/people/batches")` → Batches. No change to `navigation.tsx` needed; "People" stays active for all `/people/*` routes via `startsWith`.
- *Where does sub-nav render?*: `people/layout.tsx` server component + `PeopleSubNav` client component. See layout integration decision above.

### Deferred to Implementation

- *Layout integration option choice (Option A vs Option B)*: Resolve before starting U2. Option A is recommended for long-term cleanliness if the team is comfortable touching existing pages; Option B is acceptable if minimizing diff is the priority.

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
Route tree after this plan:
  /people                  → people/layout.tsx (sub-nav) → page.tsx (Directory)
  /people/batches          → people/layout.tsx (sub-nav) → batches/page.tsx

PeopleSubNav (client component):
  usePathname() → active state
  <Can permission="batches.manage"> wraps the Batches link

Server action flow (create batch):
  create-batch-action ──► can("batches.manage") check
                      ──► uniqueness check against DB
                      ──► db.insert
                      ──► revalidatePath x2

BatchSelect component:
  props: batches (server), value, onChange
  local state: extraBatches []
  renders: <Select> (merged batches) + "New batch…" trigger
  quick-create: inline Dialog → create-batch-action → append to extraBatches → auto-select
```

---

## Implementation Units

### U0. Make batch optional on user records

**Goal:** Relax batch from a required field to an optional one across the user creation and import flows, and handle null batch gracefully in the profile view.

**Requirements:** R0

**Dependencies:** None

**Files:**
- Modify: `src/db/schema/auth.ts` *(remove `.notNull()` from `batchNumber`; generate + apply migration)*
- Modify: `src/lib/inngest.ts` *(`userCreated` event schema: `batchNumber: number` → `number | undefined`)*
- Modify: `src/inngest/new-user-workflow.ts` *(handle optional `batchNumber` in workflow)*
- Modify: `src/app/(authenticated)/(app)/people/create-user-schema.ts`
- Modify: `src/app/(authenticated)/(app)/people/create-user-dialog.tsx`
- Modify: `src/app/(authenticated)/(app)/people/import-google-user-schema.ts`
- Modify: `src/app/(authenticated)/(app)/people/import-google-user-dialog.tsx`
- Modify: `src/app/(authenticated)/(app)/people/import-google-user-action.ts` *(batchNumber now optional in insert)*
- Modify: `src/app/(authenticated)/(app)/people/[id]/profile-card.tsx`
- Modify: `src/db/people.ts`
- Modify: `src/db/groups.ts` *(three `sql<number>` casts for `batchNumber` → `number | null`)*
- Modify: `src/components/people-table.tsx` *(add null guard for batch number cell)*
- Modify: `src/components/bulk-add-users-dialog.tsx` *(guard `Batch {user.batchNumber}` render)*

**Approach:**
- `src/db/schema/auth.ts`: remove `.notNull()` from the `batchNumber` field definition; run `npm run db:generate` then `npm run db:migrate` to apply the migration. This must complete before any user can be created or imported without a batch.
- `create-user-schema.ts` and `import-google-user-schema.ts`: change `batchNumber: z.number(...)` to `z.number().optional()` (or `z.number().nullish()` — match whichever coercion the action's insert call expects; `undefined` is fine since Drizzle omits undefined fields and the column now has no default, leaving it NULL)
- Both dialogs: change the `defaultValues` from `batchNumber: batches[0]?.number ?? 0` to `batchNumber: undefined`; update the `<SelectValue>` placeholder text to "No batch (optional)"
- `profile-card.tsx` line 83: guard the render — show `#{user.batchNumber}` only when `batchNumber` is non-null; otherwise render "—" or omit the field entirely
- `src/db/people.ts`: update the `batchNumber` field in both type aliases from `number` to `number | null`; the Drizzle join already returns null when the FK is absent — the type was wrong, not the query. Also remove the throw guards at lines 106–108 and 166–168 (`if (!user.batch) { throw new Error('User has no batch') }`) — replace with graceful null propagation so the null flows through to callers
- `src/lib/inngest.ts`: change `batchNumber: number` to `batchNumber?: number` in the `userCreated` event schema
- `src/inngest/new-user-workflow.ts`: update the workflow to handle optional `batchNumber` — omit it from the DB insert when undefined rather than inserting null explicitly
- `src/components/people-table.tsx`, `src/components/bulk-add-users-dialog.tsx`: add null guards for any `batchNumber` renders (show "—" or omit when null)
- `src/db/groups.ts`: update the three `sql<number>` type casts for `batchNumber` to `sql<number | null>`
- `src/app/(authenticated)/(app)/people/import-google-user-action.ts`: ensure `batchNumber` is omitted from the insert call when undefined (same treatment as create action)

**Patterns to follow:**
- Other optional fields in `create-user-schema.ts` / `import-google-user-schema.ts` for the Zod optional pattern

**Test scenarios:**
- Happy path: creating a user with no batch selected succeeds; the user record has `batchNumber: null` in the DB
- Happy path: creating a user with a batch selected still works as before
- Edge case: profile-card renders without crashing when `user.batchNumber` is null
- Regression: `import-google-user-schema.test.ts` — existing test with `batchNumber: 1` still passes; add a case with `batchNumber` omitted

**Verification:**
- TypeScript compiles with `batchNumber: number | null` in `people.ts` types
- Both dialogs submit successfully when no batch is chosen
- Profile card renders gracefully for a user with no batch

---

### U1. Add `"batches.manage"` permission

**Goal:** Register the permission that gates all batch mutations and the Batches screen.

**Requirements:** R6

**Dependencies:** None

**Files:**
- Modify: `src/lib/permissions/evaluate.ts`
- Test: `src/lib/permissions/evaluate.test.ts` (add or extend)

**Approach:**
- Add `"batches.manage"` to the `globalActions` as-const array
- Add a `case "batches.manage": return hasAdminGrant(authority)` entry in `evaluateGlobalAction`
- The `GlobalAction` type is derived from the array, so no separate type update is needed

**Patterns to follow:**
- Existing entries in `globalActions` + `evaluateGlobalAction` (e.g., `"users.create"`)
- Permission-policy convention: test both allowed (admin grant) and denied (non-admin) cases

**Test scenarios:**
- Happy path: user with global admin grant passes `evaluateAuth(authority, "batches.manage")`
- Error path: user without admin grant is denied
- Error path: inactive authority status is denied regardless of grants

**Verification:**
- `"batches.manage"` appears in `GlobalAction` type; TypeScript compilation succeeds
- Both test cases pass

---

### U2. `PeopleSubNav` component and `people/layout.tsx`

**Goal:** Add the Vercel-style sub-navigation row (Directory | Batches) below the main nav, visible on all People sub-routes.

**Requirements:** R1, R2

**Dependencies:** U1 (for `<Can permission="batches.manage">`)

**Files:**
- Create: `src/components/people-sub-nav.tsx`
- Create: `src/app/(authenticated)/(app)/people/layout.tsx`
- Modify: `src/app/(authenticated)/(app)/layout.tsx` *(Option A only — remove `py-6` from main)*
- Modify: existing `page.tsx` files in `(app)/` sections *(Option A only — add `PageSection` wrapper)*
- Create: `src/components/page-section.tsx` *(Option A only — `px-6 py-6` wrapper component)*

**Approach:**
- `PeopleSubNav` is a `"use client"` component using `usePathname()` for active state — same underline animation pattern as the main `Navigation` component
- Links: "Directory" → `/people`; "Batches" → `/people/batches`
- "Batches" link wrapped in `<Can permission="batches.manage">` — non-admins do not see the tab
- `people/layout.tsx` is a server component; it simply renders `<PeopleSubNav />` and `{children}`
- Layout integration: choose Option A or Option B (see Key Technical Decisions); document the choice in a code comment

**Patterns to follow:**
- `src/components/navigation.tsx` — active state detection, underline animation with `motion/react`; `PeopleSubNav` **must use both a different `<LayoutGroup id>` and a different `layoutId`** — e.g., `<LayoutGroup id="people-sub-nav">` wrapping the sub-nav links, and `layoutId="people-sub-nav-underline"` on the motion span. The main nav uses `id="nav-underline"` and `layoutId="nav-underline-bar"`; sharing either value causes the two animated underlines to fight over the same layout node
- `src/components/can.tsx` — `<Can permission="...">` usage

**Test scenarios:**
- Happy path: navigating to `/people` highlights "Directory"; navigating to `/people/batches` highlights "Batches"
- Happy path: admin user sees both "Directory" and "Batches" tabs
- Error path: non-admin user sees only "Directory" tab (Batches hidden via `<Can>`)
- Integration: "People" tab in main nav remains active on both `/people` and `/people/batches`
- Integration: removing `py-6` from `<main>` (Option A) does not break spacing on Membership, Groups, or other pages

**Verification:**
- Sub-nav renders visually adjacent to the main nav (no gap between them) under the brand header
- Active underline follows route correctly
- Non-admin visiting `/people` sees no Batches tab

---

### U3. Batches management page — list and create

**Goal:** `/people/batches` screen that lists all batches and provides a create form, gated to admins.

**Requirements:** R3, R4, R6

**Dependencies:** U1, U2

**Files:**
- Create: `src/app/(authenticated)/(app)/people/batches/page.tsx`
- Create: `src/app/(authenticated)/(app)/people/batches/page-client.tsx`
- Create: `src/app/(authenticated)/(app)/people/batches/create-batch-action.ts`
- Create: `src/app/(authenticated)/(app)/people/batches/create-batch-schema.ts`

**Approach:**
- `page.tsx` is a server component; checks `can("batches.manage")` and redirects to `/people` if not authorized; fetches all batches ordered by number; passes to `page-client.tsx`
- `page-client.tsx` renders a TanStack Table (number, start date, actions column) and a "Create batch" button that opens a Dialog (matching the groups page pattern) with fields for batch number and start date
- `create-batch-schema.ts`: Zod schema with `number` (positive integer) and `startDate` (date string)
- `create-batch-action.ts`: `actionClient.inputSchema(schema).action(...)`, checks `can("batches.manage")`, queries for existing batch with same number before insert, throws on conflict, calls `revalidatePath("/people/batches")` and `revalidatePath("/people")` on success
- Empty state: distinguish truly-empty ("No batches yet. Create the first one below.") from future filtered states

**Patterns to follow:**
- `src/app/(authenticated)/(app)/people/page.tsx` — server fetch pattern
- `src/components/people-table.tsx` + `src/components/groups-table.tsx` — TanStack Table
- `src/app/(authenticated)/(app)/groups/[id]/actions.ts` — server action with can() + revalidatePath

**Test scenarios:**
- Happy path: batches list renders with correct number and start date for each row, ordered ascending
- Happy path: submitting valid number + start date inserts the batch and it appears in the list (Covers F1)
- Edge case: truly-empty state (no batches) shows appropriate empty message, not a broken table
- Error path: submitting a batch number that already exists shows inline validation error; no DB write occurs (Covers AE1)
- Error path: non-admin visiting `/people/batches` is redirected to `/people`
- Error path: submitting with missing or invalid start date shows field-level error

**Verification:**
- List renders all DB batches in ascending order
- Create form submits, page re-renders with new row, no full reload required
- Duplicate number rejected before any insert reaches the DB

---

### U4. Edit batch start date

**Goal:** Per-row edit action in the batches table that allows updating a batch's start date; batch number is read-only.

**Requirements:** R3, R4, R6

**Dependencies:** U3

**Files:**
- Modify: `src/app/(authenticated)/(app)/people/batches/page-client.tsx`
- Create: `src/app/(authenticated)/(app)/people/batches/update-batch-action.ts`
- Create: `src/app/(authenticated)/(app)/people/batches/update-batch-schema.ts`

**Approach:**
- Add an edit button per row in `page-client.tsx` that opens a small Dialog (shadcn `Dialog`) with a single date input for the start date; batch number is displayed as read-only text
- `update-batch-schema.ts`: Zod schema with `number` (integer, identifies the batch) and `startDate` (date string)
- `update-batch-action.ts`: same pattern as create action — `can("batches.manage")`, `db.update(batch).set({ startDate }).where(eq(batch.number, number))`, then `revalidatePath`
- The edit dialog can live inline in `page-client.tsx` (single date field, no separate dialog file warranted)

**Patterns to follow:**
- Per-row dialog pattern in `src/components/people-table.tsx` (action menu opening a confirmation Dialog)
- `update-batch-schema.ts` / `update-batch-action.ts` shape mirrors `create-batch-*`

**Test scenarios:**
- Happy path: editing a start date persists the change; updated date appears in the table (Covers F2, AE3)
- Happy path: batch number is displayed but not editable in the dialog
- Edge case: submitting the same start date as current value is accepted (no-op update, no error)
- Error path: submitting an invalid date format shows field-level error
- Error path: non-admin cannot reach the edit action (server-side `can()` check)

**Verification:**
- Start date updates in the table after dialog submit
- Batch number is unchanged after any number of start-date edits

---

### U5. `BatchSelect` component and quick-create integration

**Goal:** Extract a shared `BatchSelect` component used by both user dialogs; add a "New batch…" quick-create option that creates a batch inline and auto-selects it.

**Requirements:** R5, R6

**Dependencies:** U0, U1, U3 (create-batch-action must exist)

**Files:**
- Create: `src/components/batch-select.tsx`
- Modify: `src/app/(authenticated)/(app)/people/create-user-dialog.tsx`
- Modify: `src/app/(authenticated)/(app)/people/import-google-user-dialog.tsx`
- Modify: `src/app/(authenticated)/(app)/people/batches/page-client.tsx` *(if BatchSelect is reused there for consistency)*

**Approach:**
- `BatchSelect` is a `"use client"` component accepting `batches` (server list, `{ number: number }[]`), `value: number | undefined`, `onChange: (v: number | undefined) => void`, and `disabled` props; dropdown labels show only the batch number, consistent with existing behavior
- Maintains `extraBatches: { number: number }[]` in local state — merged with the `batches` prop when rendering select items
- At the bottom of `<SelectContent>`, a separator then a "New batch…" trigger — this must be a `<button>` or equivalent non-`<SelectItem>` element with `onPointerDown={(e) => e.preventDefault()}` to prevent Radix Select from closing before the Dialog opens; `onClick` then sets a local `quickCreateOpen` boolean
- On successful creation, the new batch is pushed to `extraBatches` and `onChange(newBatchNumber)` is called — auto-selecting it
- Uses `create-batch-action` directly (the same action used by the batches page)
- Both `create-user-dialog.tsx` and `import-google-user-dialog.tsx` replace their current batch `<Controller>` block with `<BatchSelect>` receiving the same `batches` prop and `field.value`/`field.onChange`; U0 ensures the field default is `undefined` before U5 runs

**Patterns to follow:**
- `src/app/(authenticated)/(app)/people/create-user-dialog.tsx` lines 201–226 — existing batch select to replace
- Quick-create dialog uses same `useHookFormAction` + Zod pattern as `create-batch-action`

**Test scenarios:**
- Happy path: opening the dropdown shows all existing batches from the `batches` prop (Covers F3)
- Happy path: selecting "New batch…" opens the inline form; submitting a valid batch creates it, closes the form, and auto-selects the new batch number in the dropdown (Covers AE2)
- Happy path: newly created batch appears in the dropdown immediately (local state) without a page reload
- Edge case: submitting a duplicate batch number in the quick-create form shows the same inline validation error as the batches page (server error surfaced to form root)
- Edge case: closing the quick-create dialog without saving leaves the previously selected batch unchanged
- Integration: after the parent dialog closes and the page refreshes, the new batch appears in the server-fetched list

**Verification:**
- Both create-user and import-user dialogs show the "New batch…" option
- Quick-create auto-selects the new batch and the batch is available for the user being created

---

## System-Wide Impact

- **Interaction graph**: `revalidatePath("/people")` after batch mutations will invalidate the People directory server render, re-fetching the `batches` list passed to the existing user-creation and import dialogs on next render.
- **API surface parity**: The `BatchSelect` component centralizes batch dropdown logic — any future change to batch display or quick-create behavior changes one file.
- **Unchanged invariants**: The `batch.number` primary key is an integer; nothing in this plan auto-generates it. Callers always supply the number manually, consistent with the current pattern.
- **State lifecycle risks**: If a user opens both a create-user dialog and the batches page simultaneously and creates a batch in each, the quick-create action may surface a uniqueness error. This is correct behavior — no special handling needed.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Layout integration (Option A) touches all existing page files | Option B avoids this; weigh visual fidelity vs diff size before starting U2 |
| Quick-create in dialogs uses local state; page re-render may lag | Acceptable — the batch is immediately usable for the user being created; the server list catches up on next page visit |
| `date` columns from Drizzle resolve to `string` not `Date` | Use ISO string (`YYYY-MM-DD`) throughout; `<input type="date">` natively works with this format |
| `people.ts` typed `batchNumber: number` (non-null) today; fixing to `number \| null` (U0) may surface type errors in callers | Grep for `user.batchNumber` / `batchNumber` usages in UI code before finalizing U0; fix any non-null assumptions (e.g., `profile-card.tsx`, `people-table.tsx`) in the same unit |

---

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-09-batch-management-requirements.md](docs/brainstorms/2026-05-09-batch-management-requirements.md)
- Batch schema: `src/db/schema/batch.ts`
- Permission evaluator: `src/lib/permissions/evaluate.ts`
- App layout: `src/app/(authenticated)/(app)/layout.tsx`
- Navigation: `src/components/navigation.tsx`
- People page: `src/app/(authenticated)/(app)/people/page.tsx`
- Create user dialog: `src/app/(authenticated)/(app)/people/create-user-dialog.tsx`
- Permission-policy convention: `docs/solutions/conventions/reusable-permission-policy-api-2026-05-02.md`
