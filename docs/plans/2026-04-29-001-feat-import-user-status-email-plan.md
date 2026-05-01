---
title: "feat: Refine Google Workspace import status and email"
type: feat
status: completed
date: 2026-04-29
origin: docs/brainstorms/2026-04-28-google-workspace-existing-user-linking-requirements.md
---

# feat: Refine Google Workspace Import Status and Email

## Overview

Refine the Google Workspace import flow so import admins explicitly classify imported users as Member, Supporting Alumni, or Alumni, only collect department for imported Members, and send imported users a START Cockpit access email to their START email address. The email should reuse `src/emails/start-cockpit-enabled.tsx`, explain the imported user's status context, and clearly state that sign-in uses the START Berlin Google account because email/password login is not available.

---

## Problem Frame

The import flow handles people who already have a START Berlin Google Workspace account but do not yet have a START Cockpit account. Because START Cockpit does not have a personal email for those users at import time, the first contact must go to the imported START email. Import also needs to avoid assigning irrelevant department data to alumni statuses while preserving department assignment for active Members.

This plan builds on the existing import requirements in `docs/brainstorms/2026-04-28-google-workspace-existing-user-linking-requirements.md` and the follow-up instruction to email imported people at their START email with status-specific context.

---

## Requirements Trace

- R1-R10. Preserve the distinct, admin-only Workspace import flow with safe identity linking and duplicate protection.
- R11. Import must ask for START Cockpit status, limited to Member, Supporting Alumni, or Alumni.
- R12. Department must be requested only for imported Members.
- R13. Imported Supporting Alumni and Alumni users must be created without a department.
- R18-R20. Preserve imported membership timing and paid-through behavior.
- R22-R24. Keep Workspace search/import server-side and verify the selected identity at submit time.
- Prompt addendum P1. Imported users must receive `src/emails/start-cockpit-enabled.tsx` at their START email because no personal email is available yet.
- Prompt addendum P2. The email must explain the imported user's status context, including Alumni and Supporting Alumni wording.
- Prompt addendum P3. The email must state that sign-in uses the START Berlin Google Account and that email/password login is not available.

**Origin actors:** A1 Import admin, A3 Existing Workspace user, A5 START Cockpit, A6 Google Workspace Directory
**Origin flows:** F1 Import an existing Google Workspace user, F3 Imported user reaches membership payment
**Origin acceptance examples:** AE1 import existing Workspace user, AE2 already-linked result disabled, AE3 Member requires department, AE4 alumni statuses omit department, AE6 paid-through import coverage

---

## Scope Boundaries

- Do not reintroduce personal-email collection into the admin import flow; users enter it during onboarding.
- Do not send imported-user notifications to personal email.
- Do not add a new email template for imported users; extend `src/emails/start-cockpit-enabled.tsx`.
- Do not create Google Workspace accounts, reset passwords, or change Workspace identity details during import.
- Do not change the normal new-user create flow except where shared email copy remains compatible.
- Do not add bulk import behavior.

---

## Context & Research

### Relevant Code and Patterns

- `src/app/(authenticated)/(app)/people/import-google-user-dialog.tsx` owns the import UI and already uses React Hook Form, Zod resolver, `Controller`, shadcn `Select`, and field components.
- `src/app/(authenticated)/(app)/people/import-google-user-schema.ts` validates the import payload. It currently accepts all `user_status` values and requires department unconditionally.
- `src/app/(authenticated)/(app)/people/import-google-user-action.ts` re-fetches the selected Workspace user, inserts the local user, creates the membership payment row, and currently stores `personalEmail: ""`.
- `src/emails/start-cockpit-enabled.tsx` is already used when START Cockpit access is enabled for an existing Workspace account.
- `src/inngest/new-user-workflow.ts` sends `StartCockpitEnabledEmail` in the duplicate-Workspace fallback path; any prop change must keep this call site valid.
- `src/app/(authenticated)/(app)/people/complete-onboarding-action.ts` shows the existing server-action pattern for sending Resend emails after a DB mutation.
- `src/lib/user-status.ts` contains display labels for `member`, `supporting_alumni`, and `alumni`.

### Institutional Learnings

- No relevant `docs/solutions/` entries were present for this area.

### External References

- External research is not needed for this follow-up. The work uses existing local patterns for Zod validation, React Hook Form conditional UI, React Email, and Resend.

---

## Key Technical Decisions

- Restrict import status at the import schema layer: Import should not allow `onboarding`, even though `user_status` includes it for normal new-user flows.
- Make department conditional in both UI and server validation: The UI should guide admins, but the action/schema must enforce the Member-only department rule.
- Normalize alumni departments server-side: Supporting Alumni and Alumni imports should persist `department: null` even if stale client state sends a department value.
- Extend the existing enabled email: The current template already communicates START Cockpit access for existing Workspace accounts; adding optional status context is lower carrying cost than a second imported-user template.
- Send notification after successful import: Follow existing server-action email patterns and send to `workspaceUser.primaryEmail`, not `personalEmail`.

---

## Open Questions

### Resolved During Planning

- Should imported users have personal email collected by admins? No. They enter it during onboarding, so import stores an empty placeholder as currently planned.
- Which email address receives import notification? The selected Workspace user's START email, because that is the only reliable imported-user contact at import time.
- Should department be stored for alumni statuses? No. Supporting Alumni and Alumni imports should have `department: null`.

### Deferred to Implementation

- Exact email copy: The implementing agent should choose concise wording that fits the existing template style while preserving the required meaning.
- Email failure behavior: Follow the nearest existing server-action pattern unless implementation reveals a better local convention; do not roll back a successful import solely by inventing a new delivery guarantee.

---

## Implementation Units

- U1. **Constrain Import Status and Department Rules**

**Goal:** Ensure import payloads only allow Member, Supporting Alumni, or Alumni, require department only for Member, and persist no department for alumni statuses.

**Requirements:** R11, R12, R13, R22, R24, AE3, AE4

**Dependencies:** None

**Files:**
- Modify: `src/app/(authenticated)/(app)/people/import-google-user-schema.ts`
- Modify: `src/app/(authenticated)/(app)/people/import-google-user-action.ts`
- Create: `src/app/(authenticated)/(app)/people/import-google-user-schema.test.ts`

**Approach:**
- Replace broad `userStatus.enumValues` import validation with an import-specific status set: `member`, `supporting_alumni`, `alumni`.
- Model department as conditional: required for `member`, omitted or nullable for alumni statuses.
- Ensure the action writes the selected department only for `member`; for `supporting_alumni` and `alumni`, write `null`.
- Keep `personalEmail: ""` unchanged so existing onboarding asks the user for it later.

**Execution note:** Implement the validation behavior test-first because it is small, pure, and load-bearing for the UI/action contract.

**Patterns to follow:**
- `src/app/(authenticated)/(app)/people/create-user-schema.ts` for form payload validation style.
- `src/lib/membership-status.test.ts` for Node test runner style.

**Test scenarios:**
- Covers AE3. Happy path: `status: "member"` with a valid department parses successfully.
- Covers AE3. Error path: `status: "member"` without department fails with a department-required validation error.
- Covers AE4. Happy path: `status: "supporting_alumni"` without department parses successfully.
- Covers AE4. Happy path: `status: "alumni"` without department parses successfully.
- Error path: `status: "onboarding"` fails validation for import.
- Edge case: alumni status submitted with stale department data is normalized or rejected according to the chosen schema/action boundary, and the action still persists `null`.

**Verification:**
- Import validation cannot produce an onboarding user.
- Member imports cannot be submitted without department.
- Alumni-status imports do not persist department.

---

- U2. **Update Import Dialog Status UX**

**Goal:** Make the import form ask for status, show department only when Member is selected, and keep form state consistent when switching between statuses.

**Requirements:** R11, R12, R13, AE3, AE4

**Dependencies:** U1

**Files:**
- Modify: `src/app/(authenticated)/(app)/people/import-google-user-dialog.tsx`
- Test: `src/app/(authenticated)/(app)/people/import-google-user-schema.test.ts`

**Approach:**
- Add an explicit status `Select` in the import form with Member, Supporting Alumni, and Alumni options only.
- Default to Member if that matches current operational expectations, but make the choice visible rather than implicit.
- Render the department select only when the selected status is Member.
- Clear or ignore department state when the selected status changes away from Member so stale values do not confuse admins or leak into submission.
- Keep batch and membership timing controls unchanged.

**Patterns to follow:**
- Existing `Controller` usage in `src/app/(authenticated)/(app)/people/import-google-user-dialog.tsx`.
- `USER_STATUS_INFO` and `DEPARTMENTS` labels for admin-facing copy.

**Test scenarios:**
- Covers AE3. Integration via schema: Member payload with department is accepted and can be submitted.
- Covers AE4. Integration via schema: Supporting Alumni and Alumni payloads without department are accepted.
- UI expectation: with Member selected, the department field is visible and required by validation.
- UI expectation: with Supporting Alumni or Alumni selected, the department field is not shown.

**Verification:**
- Admin can classify an imported user before submit.
- The form does not ask for department for Supporting Alumni or Alumni.
- Switching status does not leave stale department data in a way that affects persisted data.

---

- U3. **Extend START Cockpit Enabled Email Copy**

**Goal:** Make `StartCockpitEnabledEmail` suitable for imported users by adding optional status context and explicit Google-account-only sign-in instructions while preserving current call sites.

**Requirements:** Prompt addendum P1, P2, P3

**Dependencies:** None

**Files:**
- Modify: `src/emails/start-cockpit-enabled.tsx`
- Modify: `src/inngest/new-user-workflow.ts`
- Create: `src/emails/start-cockpit-enabled.test.tsx`

**Approach:**
- Extend the email props with optional status context, using labels for Member, Supporting Alumni, and Alumni.
- Adjust the sign-in copy to say users sign in with their START Berlin Google Account and that email/password login is not available.
- Keep existing workflow usage compatible by making new props optional or updating the existing call to provide a default context.
- Keep the template focused on access readiness, sign-in link, and support contact.

**Patterns to follow:**
- Current layout and tone in `src/emails/start-cockpit-enabled.tsx`.
- `src/lib/user-status.ts` for status labels.
- Existing Node test runner style in `src/lib/*.test.ts`.

**Test scenarios:**
- Happy path: rendering the email for `supporting_alumni` includes "Supporting Alumni" context.
- Happy path: rendering the email for `alumni` includes "Alumni" context.
- Happy path: rendering without explicit status context still works for the existing workflow call site.
- Error-prevention: rendered email includes wording that sign-in uses the START Berlin Google Account and email/password login is not available.

**Verification:**
- Existing duplicate-Workspace enabled-email path remains type-safe.
- Imported-user email copy contains the required status and sign-in context.

---

- U4. **Send Import Notification Email**

**Goal:** Send `StartCockpitEnabledEmail` to the imported user's START email after a successful import.

**Requirements:** R7, R9, R22, Prompt addendum P1, P2, P3, AE1

**Dependencies:** U1, U3

**Files:**
- Modify: `src/app/(authenticated)/(app)/people/import-google-user-action.ts`
- Test: `src/app/(authenticated)/(app)/people/import-google-user-action.test.ts`

**Approach:**
- After the DB transaction creates the user and membership payment row, send `StartCockpitEnabledEmail` through `resend.emails.send`.
- Address the email to `workspaceUser.primaryEmail`.
- Pass the imported user's first name and selected status so the template can explain why access is ready.
- Keep identity verification and duplicate-import checks before any write or email send.
- Avoid sending email when import fails validation, selected Workspace identity is suspended/missing, or duplicate import is detected.

**Patterns to follow:**
- `src/app/(authenticated)/(app)/people/complete-onboarding-action.ts` for direct server-action Resend sending.
- `src/inngest/new-user-workflow.ts` for `StartCockpitEnabledEmail` usage and sender identity.

**Test scenarios:**
- Happy path: importing a Workspace user sends one email to `workspaceUser.primaryEmail` using `StartCockpitEnabledEmail`.
- Happy path: imported Supporting Alumni email receives supporting-alumni status context.
- Error path: duplicate Workspace identity does not send an email.
- Error path: suspended Workspace identity does not send an email.
- Error path: validation failure for Member without department does not send an email.
- Integration: created user, membership payment row, and email send use the same selected Workspace identity and status.

**Verification:**
- Successful imports notify the imported person at their START email.
- Failed imports do not send misleading access emails.
- Existing normal create/onboarding email behavior remains unchanged.

---

## System-Wide Impact

- **Interaction graph:** Import dialog submits to import action; import action verifies Google Directory identity, writes user and membership payment, then sends Resend email.
- **Error propagation:** Validation and duplicate checks should fail before DB writes and before email sends. Email errors should follow existing server-action behavior rather than introducing a new retry system in this follow-up.
- **State lifecycle risks:** The main stale-state risk is a hidden department remaining after switching from Member to an alumni status; server-side normalization protects persisted data.
- **API surface parity:** Normal create-user flow and onboarding flow should not gain the import-specific status constraints.
- **Integration coverage:** Tests should cover schema rules and email rendering; action-level email sending may require light mocking of Google Directory, DB, and Resend.
- **Unchanged invariants:** Import still links an existing Workspace identity, never creates or mutates a Google account, and still leaves personal email for user onboarding.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Import UI hides department but stale client state submits one anyway | Enforce/null department server-side for alumni statuses. |
| Existing `StartCockpitEnabledEmail` call site breaks when props change | Make new props optional or update all call sites in the same unit. |
| Imported user never sees email because Workspace credentials are unknown to them | Email copy should explicitly say to sign in with the START Berlin Google Account; password recovery remains outside this plan because import must not reset Workspace passwords. |
| Email send fails after DB import succeeds | Follow existing action pattern and surface the error; do not invent transactional email rollback in this follow-up. |

---

## Documentation / Operational Notes

- Admin-facing import behavior should be self-explanatory in the dialog; no separate admin docs are required for this follow-up.
- If reviewers want stronger delivery guarantees for import emails, capture that as a follow-up background-job/retry plan rather than expanding this change.

---

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-28-google-workspace-existing-user-linking-requirements.md](docs/brainstorms/2026-04-28-google-workspace-existing-user-linking-requirements.md)
- Related code: `src/app/(authenticated)/(app)/people/import-google-user-dialog.tsx`
- Related code: `src/app/(authenticated)/(app)/people/import-google-user-schema.ts`
- Related code: `src/app/(authenticated)/(app)/people/import-google-user-action.ts`
- Related code: `src/emails/start-cockpit-enabled.tsx`
- Related code: `src/app/(authenticated)/(app)/people/complete-onboarding-action.ts`
