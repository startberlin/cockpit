---
date: 2026-05-09
topic: batch-management
---

# Batch Management

## Summary

Add batch management to the People section: a Vercel-style sub-navigation row (Directory | Batches) below the main nav, a dedicated Batches screen for listing, creating, and editing batch start dates, and a quick-create shortcut in the batch dropdown of the create/import user dialogs.

---

## Problem Frame

Batches group incoming members by cohort (a few intakes per year). The `batch` table already exists and is used throughout the app — People directory filtering, user creation, group criteria — but there is currently no UI to create or manage batch records. Admins must insert rows directly into the database to register a new intake cohort before they can assign new members to it. This is a manual, technically-gated step that blocks the member onboarding workflow.

---

## Actors

- A1. **Operator / admin**: the person managing intake — creates new batches, corrects start dates, and assigns incoming members to a batch.

---

## Key Flows

- F1. **Create a new batch**
  - **Trigger:** A new intake cohort is starting and no batch record exists for it yet.
  - **Actors:** A1
  - **Steps:** Admin navigates to People → Batches sub-tab; reviews the list of existing batches; fills in a new batch number and start date; submits the form.
  - **Outcome:** The new batch row appears in the list and is immediately available in all batch-selection dropdowns across the app.
  - **Covered by:** R5, R6, R7, R8, R10

- F2. **Correct a batch start date**
  - **Trigger:** The start date recorded for an existing batch is wrong.
  - **Actors:** A1
  - **Steps:** Admin navigates to People → Batches; locates the batch; edits the start date inline or via an edit action; saves.
  - **Outcome:** The updated start date is persisted; batch number is unchanged.
  - **Covered by:** R5, R9, R10

- F3. **Quick-create a batch while adding a member**
  - **Trigger:** Admin is creating or importing a user and the required batch does not yet exist.
  - **Actors:** A1
  - **Steps:** Admin opens the create/import user dialog; opens the batch dropdown; selects "Create new batch"; enters a batch number and start date in the inline form; confirms.
  - **Outcome:** The new batch is created and auto-selected in the dropdown; the admin continues filling in the user form without leaving the dialog.
  - **Covered by:** R11, R12, R13

---

## Requirements

**Sub-navigation layout**

- R1. The People section gains a persistent sub-navigation row with two entries: "Directory" and "Batches".
- R2. The sub-nav sits directly below the main navigation row, visually connected to it in a consistent position across all People sub-pages.
- R3. The existing People directory view (`/people`) becomes the "Directory" sub-page; its content and behavior are unchanged.
- R4. The sub-nav is implemented via a reusable component so other sections of the app can adopt the same pattern without duplicating the structure. The integration must preserve the shared `(app)` layout rather than replacing or forking it.

**Batches screen**

- R5. The Batches screen (`/people/batches`) lists all existing batches, showing batch number and start date, ordered by batch number ascending.
- R6. The screen provides a form to create a new batch with two required fields: batch number (positive integer) and start date.
- R7. Submitting a batch number that already exists is rejected with an inline error before any write occurs.
- R8. After a successful creation, the new batch appears in the list immediately without a full page reload.
- R9. Each existing batch has an edit action that allows updating its start date; the batch number is immutable after creation.
- R10. The Batches screen is accessible only to users with operator/admin authority.

**Quick-create in user dialogs**

- R11. The batch selector dropdown in both the create-user and import-user dialogs includes a "Create new batch" action at the bottom of the list.
- R12. Activating "Create new batch" opens an inline form (within the dialog, without navigation) for entering a batch number and start date.
- R13. After the inline batch is created, it is automatically selected in the dropdown and the inline form closes.

---

## Acceptance Examples

- AE1. **Covers R7.** Given batch #3 already exists, when an admin submits a new batch form with number 3, the form shows a validation error and no database write occurs.
- AE2. **Covers R8, R11, R13.** Given batch #4 does not exist, when an admin uses "Create new batch" inside the create-user dialog with number 4, the dropdown closes the inline form, "Batch #4" is selected, and the batch is immediately available if the admin later visits the Batches screen.
- AE3. **Covers R9.** Given batch #2 exists with start date 2025-09-01, when an admin edits the start date to 2025-10-01 and saves, the list reflects the new date and the batch number remains 2.

---

## Success Criteria

- An operator can register a new intake cohort entirely through the app UI, with no direct database access required.
- The Batches sub-tab is discoverable from the People section without reading documentation or asking for help.
- The sub-nav layout integration does not break the visual or structural consistency of the existing `(app)` layout on any other page.
- The quick-create path adds a batch without interrupting the user creation flow.

---

## Scope Boundaries

- Deleting batches is out of scope.
- Batch names, labels, or descriptions beyond number and start date are out of scope.
- Auto-assigning users to a batch based on their creation date is out of scope.
- Any workflow, notification, or Inngest event triggered by batch creation is out of scope.
- Member-facing exposure of the Batches screen is out of scope.

---

## Key Decisions

- **Sub-nav over inline action on the People page**: A dedicated sub-tab was chosen over adding a "Manage batches" button or link near the filter chips. Batches need a full management screen (list + create + edit) that doesn't fit as an overlay on the directory.
- **Create + edit start date, no delete**: Batch numbers are stable references used across users and group criteria. Deleting a batch with assigned members would require cascading decisions that are deferred. Editing the start date corrects the most likely data entry error without that risk.
- **Reusable sub-nav component**: The sub-nav must be built as a shared pattern rather than a one-off People-only structure. The user explicitly flagged this — if another section later needs sub-navigation, it should be able to adopt the same component.

---

## Dependencies / Assumptions

- The `batch` table schema (`number` integer PK, `startDate` date) is the source of truth; no schema changes are required by this feature.
- Batch number is set manually by the admin (not auto-incremented), consistent with the current pattern (existing batches in the DB have explicit numbers).
- "Operator / admin authority" maps to the existing authority model already in the codebase — the planner should verify which authority roles gate the Batches screen.

---

## Outstanding Questions

### Resolve Before Planning

*(none)*

### Deferred to Planning

- **[Affects R1–R4][Technical]** Where exactly does the sub-nav row render — inside the brand-colored header (extending the `(app)/layout.tsx` to accept an optional sub-nav slot) or at the top of `<main>` via a new `people/layout.tsx`? The user noted the layout should be extended with parameters to allow sub-navs; the planner should evaluate which mechanism (nested layout file, slot/prop pattern, or other) integrates most cleanly with the existing structure.
- **[Affects R1–R2][Technical]** How does active state get determined for sub-nav items given the current `pathname.startsWith(href)` pattern in the main nav? The planner should verify that `/people` and `/people/batches` both keep "People" highlighted in the main nav while the sub-nav correctly reflects the current sub-page.
- **[Affects R10][Needs research]** Which specific authority roles should gate the Batches screen? Verify against the authority model in the codebase.
