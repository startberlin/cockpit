---
date: 2026-04-28
topic: google-workspace-existing-user-linking
---

# Google Workspace User Import

## Problem Frame

START Cockpit has two different user-entry cases that should not be forced into one overloaded create flow.

For new members, START Cockpit creates a new Google Workspace account during onboarding and their membership payment setup should start immediately after onboarding is complete. For some existing members, the Google Workspace account already exists but the person is missing from START Cockpit. Those users need to be imported into START Cockpit and linked to their existing Workspace identity without creating a second Workspace account.

Imported users may already have paid their START membership fee outside START Cockpit. The import flow therefore needs to capture membership timing so START Cockpit can ask them to set up their GoCardless subscription immediately while ensuring the first subscription charge starts only after their already-paid period ends.

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
  - **Steps:** The admin opens an import-only flow, searches Google Workspace, reviews matching users, selects one unlinked Workspace identity, chooses whether the imported user should be Member, Supporting Alumni, or Alumni, assigns a department only when the user is a Member, enters membership timing, and imports the user.
  - **Outcome:** START Cockpit creates a local user linked to the existing Google Workspace identity and does not create a new Workspace account.
  - **Covered by:** R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12, R13

- F2. Create a new user
  - **Trigger:** An admin needs to invite a new person who does not yet have a START Google Workspace account.
  - **Actors:** A2, A4, A5, A6
  - **Steps:** The admin uses the normal create-user flow. START Cockpit calculates and shows the intended START email, checks for an exact Workspace email conflict, and blocks creation if that Workspace identity already exists.
  - **Outcome:** New-user creation stays focused on creating new Workspace accounts while preventing obvious duplicate-account attempts.
  - **Covered by:** R14, R15, R16, R17

- F3. Imported user reaches membership payment
  - **Trigger:** An imported user signs in or visits membership after import.
  - **Actors:** A3, A5
  - **Steps:** START Cockpit lets the imported user start GoCardless payment setup immediately, even if profile onboarding is not complete. If the import admin entered a paid-through date, START Cockpit carries that date into subscription setup so the first charge is delayed until after the already-paid period.
  - **Outcome:** Existing members can set up future billing right away without being charged too early, while newly onboarded users still start payment setup immediately after onboarding completion.
  - **Covered by:** R18, R19, R20, R21, R22

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
- R11. The import flow must ask which START Cockpit status the imported user should have, limited to Member, Supporting Alumni, or Alumni.
- R12. The import flow must ask for a department only when the selected status is Member.
- R13. Imported Supporting Alumni and Alumni users must be created without a department assignment.

**Normal New-User Creation**
- R14. The normal create-user flow must remain optimized for creating new START Cockpit users and new Google Workspace accounts.
- R15. The normal create-user flow must calculate and show the intended START email from first and last name before submission.
- R16. The normal create-user flow must check the intended START email for exact Google Workspace conflicts before creation.
- R17. If the intended START email already exists in Google Workspace, normal user creation must block and direct the admin to the import flow instead of attempting to create a duplicate Workspace account.

**Membership Timing**
- R18. The import flow must capture whether the imported user is already covered by a prior membership payment.
- R19. If the imported user is already covered, START Cockpit must capture the paid-through date needed to determine the first future GoCardless charge date.
- R20. Imported users with remaining paid membership time must still be asked to set up their GoCardless payment/subscription promptly; the covered period delays billing, not subscription setup.
- R21. Imported users must be able to set up membership payment without completing profile onboarding first.
- R22. For imported users with a paid-through date, the GoCardless subscription must start after that date so the first charge is not collected too early.
- R23. New users who complete onboarding through the normal flow must still be asked to start membership payment immediately after onboarding completion.

**Safety and Data Handling**
- R24. Workspace search and import must run through authenticated server-side admin-only behavior, not from unauthenticated or broadly available client-side access.
- R25. Suggestions and import logs must expose only the fields needed for disambiguation, linking, and auditability.
- R26. Submit-time import must verify the selected Workspace identity server-side and must not trust client-supplied name or email as proof of identity.

---

## Acceptance Examples

- AE1. **Covers R1, R3, R4, R7, R8.** Given Google Workspace contains "Mark Use Müller" and START Cockpit does not, when an import admin searches for "Mark Müller", selects that Workspace user, and imports them, START Cockpit creates a local user linked to that existing Workspace identity without creating a new Google account.
- AE2. **Covers R5, R10.** Given a Google Workspace user is already linked to a START Cockpit user, when an import admin sees that user in import search results, the result is marked as already linked and cannot be imported again.
- AE3. **Covers R11, R12.** Given an import admin selects Member as the imported user's status, when they complete the import form, they must choose a department before importing.
- AE4. **Covers R11, R13.** Given an import admin selects Supporting Alumni or Alumni as the imported user's status, when they import the user, START Cockpit creates the user without a department assignment.
- AE5. **Covers R14, R15, R16, R17.** Given the normal create-user flow calculates `mark.mueller@start-berlin.com` and that email already exists in Google Workspace, when the admin submits the create form, START Cockpit blocks creation and points the admin to the import flow.
- AE6. **Covers R18, R19, R20, R21, R22.** Given an imported member already paid their membership fee through a future date, when they sign in after import before completing profile onboarding, START Cockpit lets them set up GoCardless payment now and creates the subscription so its first charge starts after the paid-through date.
- AE7. **Covers R23.** Given a new user completes onboarding through the normal flow, when an admin completes onboarding, START Cockpit makes membership payment setup available immediately as it does today.

---

## Success Criteria

- Existing Google Workspace users can be added to START Cockpit through a clear, admin-only import workflow.
- Import admins can explicitly classify imported users as Member, Supporting Alumni, or Alumni without assigning irrelevant department data to alumni statuses.
- Normal user creation remains simple and does not gain persistent fuzzy-search complexity for a rare startup/import case.
- START Cockpit never creates a duplicate Google Workspace account when the intended Workspace email already exists.
- Imported users can be marked as already paid through the relevant membership period, complete subscription setup immediately, and avoid first charge until after the paid-through date.
- Planning can proceed without inventing the product split between importing existing users and creating new users.

---

## Scope Boundaries

- This does not require fuzzy matching in the normal create-user flow; exact Workspace email conflict detection is enough there.
- This does not require a bulk importer in v1. A single-user import flow is sufficient unless planning finds that batch import is materially cheaper.
- This does not require changing existing Google Workspace account details during import.
- This does not require merging duplicate START Cockpit users.
- This does not require modelling every possible membership billing history; v1 only needs enough timing information to know when payment should next be requested.
- This does not replace the normal onboarding path for users who need new Workspace accounts.
- This does not make imported members complete profile onboarding before payment setup; the import case intentionally bypasses that prerequisite for membership payment setup.

---

## Key Decisions

- Separate import from create: importing existing Workspace users is occasional and higher trust, while creating new users is the common operational path.
- Keep exact conflict protection in create: the normal create flow should show the calculated START email and block exact Workspace collisions.
- Use import for fuzzy lookup: name-based Google Workspace search belongs in the dedicated import flow where the admin is intentionally looking for an existing account.
- Capture membership timing during import: existing members may already be paid, so import must schedule the first subscription charge after the paid-through date while still collecting subscription setup promptly.
- Gate import separately: importing links external identity and can affect payment timing, so it should be permissioned more deliberately than ordinary user creation.
- Use delayed GoCardless subscription start where possible: GoCardless subscription creation supports a `start_date` for the first charge, so the billing delay should live in the subscription schedule rather than by hiding payment setup until the paid-through date.

---

## External Research

- GoCardless subscription creation supports `start_date` as the date of the first charge; the date must be compatible with the mandate's `next_possible_charge_date`. Source: https://developer.gocardless.com/api-reference
- GoCardless Billing Request `subscription_request[start_date]` also exists, but the API reference notes that `subscription_request` fields on Billing Requests are only supported for ACH and PAD schemes. Since START Cockpit currently uses SEPA mandate setup followed by explicit subscription creation, planning should validate and likely extend the existing `/subscriptions` creation step rather than switch the full flow to Billing Request subscription requests. Source: https://developer.gocardless.com/api-reference

---

## Dependencies / Assumptions

- Google Workspace Directory search is available to START Cockpit with sufficient permissions.
- START Cockpit can determine whether a Google Workspace identity is already linked to an existing START Cockpit user.
- START Cockpit will need a durable way to represent the imported Workspace identity and prevent duplicate imports.
- START Cockpit will need a durable way to represent imported membership coverage or first subscription charge timing.
- The current feature branch has introduced paid-through state, but its product semantics need to change from "hide payment setup until due" to "set up subscription now with delayed first charge."
- GoCardless subscription `start_date` can delay the first subscription charge, and must be on or after the mandate's `next_possible_charge_date`.
- GoCardless Billing Request `subscription_request` fields are documented with ACH/PAD limitations, so planning should prefer the existing mandate-then-`/subscriptions` flow unless implementation research proves the Billing Request path supports the required SEPA subscription behavior.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R2][Technical] Should import use a new permission action or reuse an existing admin-only permission with additional UI gating?
- [Affects R3, R4][Technical] Which Google Directory fields should import search display for safe disambiguation?
- [Affects R7, R10, R26][Technical] Which stable Google Workspace identifier should be stored for imported users?
- [Affects R18, R19, R20, R22][Technical] What is the minimal membership timing model for paid-through date and first subscription charge date?
- [Affects R20, R21, R22, R23][Technical] How should imported membership timing interact with the existing membership payment state, onboarding completion rules, and GoCardless subscription creation?
- [Affects R24, R25][Technical] What logging and audit information is necessary for import without overexposing Google Directory data?

---

## Next Steps

-> /ce-plan for structured implementation planning
