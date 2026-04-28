---
date: 2026-04-28
topic: google-workspace-existing-user-linking
---

# Google Workspace User Import

## Problem Frame

START Cockpit has two different user-entry cases that should not be forced into one overloaded create flow.

For new members, START Cockpit creates a new Google Workspace account during onboarding and their membership payment setup should start immediately after onboarding is complete. For some existing members, the Google Workspace account already exists but the person is missing from START Cockpit. Those users need to be imported into START Cockpit and linked to their existing Workspace identity without creating a second Workspace account.

Imported users may already have paid their START membership fee outside START Cockpit. The import flow therefore needs to capture membership timing so START Cockpit does not ask them to set up a new subscription until payment is actually due.

---

## Actors

- A1. Import admin: A trusted admin who can import existing Google Workspace users and set their membership timing.
- A2. User admin: An admin who creates new users through the normal START Cockpit create-user flow.
- A3. Existing Workspace user: A person who already has a Google Workspace account and needs a START Cockpit account.
- A4. New START user: A person who does not yet have a Workspace account and goes through normal START Cockpit onboarding.
- A5. START Cockpit: Stores the user profile, Workspace identity link, onboarding state, and membership payment state.
- A6. Google Workspace Directory: Source of existing Workspace identities.

---

## Key Flows

- F1. Import an existing Google Workspace user
  - **Trigger:** A trusted admin needs to add a person who already exists in Google Workspace but not in START Cockpit.
  - **Actors:** A1, A3, A5, A6
  - **Steps:** The admin opens an import-only flow, searches Google Workspace, reviews matching users, selects one unlinked Workspace identity, confirms the profile values that START Cockpit should create, enters membership timing, and imports the user.
  - **Outcome:** START Cockpit creates a local user linked to the existing Google Workspace identity and does not create a new Workspace account.
  - **Covered by:** R1, R2, R3, R4, R5, R6, R7, R8, R9, R10

- F2. Create a new user
  - **Trigger:** An admin needs to invite a new person who does not yet have a START Google Workspace account.
  - **Actors:** A2, A4, A5, A6
  - **Steps:** The admin uses the normal create-user flow. START Cockpit calculates and shows the intended START email, checks for an exact Workspace email conflict, and blocks creation if that Workspace identity already exists.
  - **Outcome:** New-user creation stays focused on creating new Workspace accounts while preventing obvious duplicate-account attempts.
  - **Covered by:** R11, R12, R13, R14

- F3. Imported user reaches membership payment
  - **Trigger:** An imported user signs in or visits membership after import.
  - **Actors:** A3, A5
  - **Steps:** START Cockpit uses the imported membership timing to decide whether the user is already covered, should see membership details, or should be asked to set up payment.
  - **Outcome:** Existing members are not asked to pay too early, while newly onboarded users still start payment setup immediately after onboarding completion.
  - **Covered by:** R15, R16, R17, R18

---

## Requirements

**Import Existing Workspace User**
- R1. START Cockpit must provide a distinct import flow for existing Google Workspace users instead of making fuzzy Workspace discovery part of every normal create-user flow.
- R2. The import flow must be available only to a deliberately permissioned admin role or action.
- R3. The import flow must search Google Workspace by name and/or Workspace email and show candidate Workspace users.
- R4. Candidate results must show enough information for the admin to distinguish similar people before importing.
- R5. Google Workspace users already linked to a START Cockpit account must be visible as already linked and must not be importable again.
- R6. Selecting a Workspace user for import must lock the Workspace identity being imported so the admin cannot accidentally import one user while submitting another user's email or name.
- R7. The import flow must create a START Cockpit user linked to the selected existing Workspace identity.
- R8. Importing must not create, rename, or reset the password of the selected Google Workspace user.
- R9. The imported START Cockpit user must visibly show the linked Workspace identity after import.
- R10. The import flow must be safe against stale search results or concurrent imports, so the same Workspace identity cannot be imported twice.

**Normal New-User Creation**
- R11. The normal create-user flow must remain optimized for creating new START Cockpit users and new Google Workspace accounts.
- R12. The normal create-user flow must calculate and show the intended START email from first and last name before submission.
- R13. The normal create-user flow must check the intended START email for exact Google Workspace conflicts before creation.
- R14. If the intended START email already exists in Google Workspace, normal user creation must block and direct the admin to the import flow instead of attempting to create a duplicate Workspace account.

**Membership Timing**
- R15. The import flow must capture whether the imported user is already covered by a prior membership payment.
- R16. If the imported user is already covered, START Cockpit must capture the date or period needed to determine when their next membership payment should be requested.
- R17. Imported users with remaining paid membership time must not be asked to start a new subscription until their covered period ends.
- R18. New users who complete onboarding through the normal flow must still be asked to start membership payment immediately after onboarding completion.

**Safety and Data Handling**
- R19. Workspace search and import must run through authenticated server-side admin-only behavior, not from unauthenticated or broadly available client-side access.
- R20. Suggestions and import logs must expose only the fields needed for disambiguation, linking, and auditability.
- R21. Submit-time import must verify the selected Workspace identity server-side and must not trust client-supplied name or email as proof of identity.

---

## Acceptance Examples

- AE1. **Covers R1, R3, R4, R7, R8.** Given Google Workspace contains "Mark Use Müller" and START Cockpit does not, when an import admin searches for "Mark Müller", selects that Workspace user, and imports them, START Cockpit creates a local user linked to that existing Workspace identity without creating a new Google account.
- AE2. **Covers R5, R10.** Given a Google Workspace user is already linked to a START Cockpit user, when an import admin sees that user in import search results, the result is marked as already linked and cannot be imported again.
- AE3. **Covers R12, R13, R14.** Given the normal create-user flow calculates `mark.mueller@start-berlin.com` and that email already exists in Google Workspace, when the admin submits the create form, START Cockpit blocks creation and points the admin to the import flow.
- AE4. **Covers R15, R16, R17.** Given an imported member already paid their membership fee through a future date, when they sign in after import, START Cockpit treats them as covered until that date and does not ask them to start a subscription early.
- AE5. **Covers R18.** Given a new user completes onboarding through the normal flow, when an admin completes onboarding, START Cockpit makes membership payment setup available immediately as it does today.

---

## Success Criteria

- Existing Google Workspace users can be added to START Cockpit through a clear, admin-only import workflow.
- Normal user creation remains simple and does not gain persistent fuzzy-search complexity for a rare startup/import case.
- START Cockpit never creates a duplicate Google Workspace account when the intended Workspace email already exists.
- Imported users can be marked as already paid through the relevant membership period, delaying subscription setup until it is due.
- Planning can proceed without inventing the product split between importing existing users and creating new users.

---

## Scope Boundaries

- This does not require fuzzy matching in the normal create-user flow; exact Workspace email conflict detection is enough there.
- This does not require a bulk importer in v1. A single-user import flow is sufficient unless planning finds that batch import is materially cheaper.
- This does not require changing existing Google Workspace account details during import.
- This does not require merging duplicate START Cockpit users.
- This does not require modelling every possible membership billing history; v1 only needs enough timing information to know when payment should next be requested.
- This does not replace the normal onboarding path for users who need new Workspace accounts.

---

## Key Decisions

- Separate import from create: importing existing Workspace users is occasional and higher trust, while creating new users is the common operational path.
- Keep exact conflict protection in create: the normal create flow should show the calculated START email and block exact Workspace collisions.
- Use import for fuzzy lookup: name-based Google Workspace search belongs in the dedicated import flow where the admin is intentionally looking for an existing account.
- Capture membership timing during import: existing members may already be paid, so import must not force immediate subscription setup by default.
- Gate import separately: importing links external identity and can affect payment timing, so it should be permissioned more deliberately than ordinary user creation.

---

## Dependencies / Assumptions

- Google Workspace Directory search is available to START Cockpit with sufficient permissions.
- START Cockpit can determine whether a Google Workspace identity is already linked to an existing START Cockpit user.
- START Cockpit will need a durable way to represent the imported Workspace identity and prevent duplicate imports.
- START Cockpit will need a durable way to represent imported membership coverage or next payment due timing.
- The current codebase has membership payment state for active/pending/checkout states, but no explicit paid-through date yet.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R2][Technical] Should import use a new permission action or reuse an existing admin-only permission with additional UI gating?
- [Affects R3, R4][Technical] Which Google Directory fields should import search display for safe disambiguation?
- [Affects R7, R10, R21][Technical] Which stable Google Workspace identifier should be stored for imported users?
- [Affects R15, R16, R17][Technical] What is the minimal membership timing model: last paid date, paid-through date, next payment due date, or another representation?
- [Affects R17, R18][Technical] How should imported membership timing interact with the existing membership payment state and onboarding completion rules?
- [Affects R19, R20][Technical] What logging and audit information is necessary for import without overexposing Google Directory data?

---

## Next Steps

-> /ce-plan for structured implementation planning
