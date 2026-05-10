---
title: "feat: Membership Reconfirmation via Unified Application Flow"
type: feat
status: active
date: 2026-05-10
---

# feat: Membership Reconfirmation via Unified Application Flow

## Summary

Introduces a `membership_reconfirmation_pending` status on the `legal_membership` table to represent historically-imported members who have not yet gone through formal document collection. When an admin imports a Google Workspace user with a historical join date, the legal membership is created in this state instead of immediately activating it. On first login, the user is blocked from the cockpit and routed through the existing membership application form (the same multi-step form used by board-approved new members), which is moved outside the `(app)` route group to avoid redirect loops. On submission, a new Inngest workflow auto-approves the reconfirmation — archiving documents, activating the membership, and sending a confirmation email — without requiring a board vote. This supersedes the birthday/bylaws/fees onboarding extension added earlier in this branch, replacing that parallel code path with a single unified form flow.

---

## Problem Frame

The current branch added separate onboarding steps (birthday, bylaws, fees) for historically-imported members, creating a parallel data-collection and document-generation path distinct from the board-approved new-member flow. This approach has two weaknesses: the onboarding gate uses field-presence checks ("does the user have a birthday set?") rather than a clean membership status; and document generation is triggered by a fees action rather than a proper application submission. The result is two diverging implementations of what is functionally the same process.

The replacement design: a single `membership_reconfirmation_pending` status acts as the gate, the existing application form handles all data collection for both cases, and auto-approval replaces the board-vote step for reconfirmation. The user sees identical form steps with reconfirmation-appropriate copy.

---

## Requirements

- R1. Adding a Google Workspace user with a historical join date (`joinedAt`) creates `legal_membership.status = "membership_reconfirmation_pending"` and `user.legalMembershipState = "not_member"`. Membership payment row creation is deferred until reconfirmation completes.
- R2. A user with an active `membership_reconfirmation_pending` tenure is blocked from cockpit access and redirected to `/membership/application/personal-information` by the `(app)` layout gate.
- R3. The membership application form accepts users with both `application_pending` (existing board flow) and `membership_reconfirmation_pending` (new reconfirmation flow) statuses.
- R4. The application form shows reconfirmation-specific copy (headings, descriptions, submit button label) when `legalMembership.status === "membership_reconfirmation_pending"`.
- R5. The submit action accepts `membership_reconfirmation_pending` as a valid pre-submission status and fires `events.reconfirmationSubmitted` instead of `events.applicationSubmitted` for that case.
- R6. A new `membership-reconfirmation-workflow` Inngest function triggered by `reconfirmationSubmitted` archives the membership application PDF, activates the legal membership, inserts the payment row, archives the admission confirmation PDF (empty board list, historical `activatedAt` date), and sends a confirmation email with both PDFs attached.
- R7. After the reconfirmation workflow completes: `legalMembership.status = "active"`, `user.legalMembershipState = "active_member"`.
- R8. `membership_reconfirmation_pending` is included in `LIVE_TENURE_STATUSES` (blocks re-proposal) and `ACTIVE_TENURE_STATUSES` (visible via `getActiveLegalMembership`).
- R9. The application form route is moved outside the `(app)` route group into a new `(membership-application)` group at the same URL, eliminating the redirect loop that would occur if the `(app)` layout tried to redirect users already at that route.
- R10. The birthday, bylaws, and fees onboarding steps added in the current branch are removed. `getOnboardingProgress` becomes synchronous again (no DB query). The `bylawsAcceptedAt` and `feesAcceptedAt` columns are removed from the `user` schema.
- R11. The `existing-member-documentation-workflow` is removed and replaced by the reconfirmation workflow.

---

## Scope Boundaries

- Board vote flow for new members is unchanged — `admission_pending → application_pending → processing → active` path is untouched.
- Membership task card UI for `membership_reconfirmation_pending` users is not addressed; these users are cockpit-gated and never see the task card.
- Email copy for the reconfirmation confirmation email can reuse `MembershipAdmissionConfirmedEmail` with adjusted subject line; a dedicated email template is not required.
- No data migration for existing dev/test users already imported with `status = "active"` — those tenures remain active and unaffected.

### Deferred to Follow-Up Work

- Surfacing reconfirmation status to admins in the People directory (currently shows `legalMembershipState`).
- A "resume application" deep link in the welcome email sent to reconfirmation-pending users.

---

## Context & Research

### Relevant Code and Patterns

- `src/db/schema/legal-membership.ts` — `legalMembershipStatus` pgEnum, `LIVE_TENURE_STATUSES`, `ACTIVE_TENURE_STATUSES`, and the raw SQL `WHERE status IN (...)` partial unique index
- `src/db/membership.ts` — `getActiveLegalMembership()` queries `ACTIVE_TENURE_STATUSES`; used in the application form page and must return `membership_reconfirmation_pending` tenures
- `src/app/(authenticated)/(app)/membership/application/[step]/page.tsx` — status guard (`status !== "application_pending"` → redirect to `/membership`); the only place the application form checks membership status
- `src/app/(authenticated)/(app)/membership/application/[step]/submit-application-action.ts` — validates `lm.status === "application_pending"` and fires `events.applicationSubmitted`; must be extended for the reconfirmation case
- `src/app/(authenticated)/(app)/people/import-google-user-action.ts` — Branch A (historical join date) currently sets `status = "active"` and `legalMembershipState = "active_member"`; must be changed
- `src/app/(authenticated)/(app)/layout.tsx` — the `(app)` layout; calls `getOnboardingProgress` and redirects to `/onboarding`; must also redirect `membership_reconfirmation_pending` users to the application form
- `src/inngest/membership-admission-workflow.ts` — reference pattern for the document archiving, activation, payment insert, and email steps that the reconfirmation workflow replicates
- `src/inngest/existing-member-documentation-workflow.ts` — superseded by the new reconfirmation workflow; to be deleted

### Institutional Learnings

- **Never conflate `user.legalMembershipState` and `legalMembership.status`** — `legalMembershipState` is the legal-privileges enum on the user table; `legalMembership.status` is the admission-workflow enum. Both must be kept in sync at activation, but the onboarding gate should use `legalMembership.status` for the reconfirmation check. (see `docs/solutions/architecture-patterns/member-lifecycle-entry-points-and-application-flow-2026-05-10.md`)
- **Add new Inngest payment inserts with `onConflictDoNothing`** — canonical guard against replay. (same doc)
- **The raw SQL `WHERE` clause in the partial unique index must be updated manually** alongside the `LIVE_TENURE_STATUSES` TypeScript array — Drizzle cannot derive it from the constant.
- **`getOnboardingProgress` was made async (DB query) in this branch; removing the DB query makes it synchronous again** — all callers can be de-awaited in U8.

---

## Key Technical Decisions

- **New route group `(membership-application)` instead of path-detection in `(app)/layout.tsx`**: The `(app)` layout must redirect `membership_reconfirmation_pending` users to `/membership/application`. If the application form remains inside `(app)`, this creates an infinite redirect loop (the layout would redirect the user to the page they're already on). Moving the form to a sibling route group (`(membership-application)`) keeps the URL identical while placing the form outside the `(app)` gate — the same pattern used by `(onboarding)`. Board-flow users (`application_pending`) are not cockpit-gated, so they reach the form via the link in their board-approval email; they still navigate to the same URL.
- **`events.reconfirmationSubmitted` is a distinct event, not a re-use of `events.applicationSubmitted`**: The admission workflow uses `step.waitForEvent(events.applicationSubmitted)` correlated on `legalMembershipId`. If reconfirmation submissions also fired `applicationSubmitted`, there would be no `waitForEvent` awaiting it (no admission workflow was started for these users), but it would still be a confusing dual use of one event. Separate events make both workflows independently inspectable in the Inngest dashboard.
- **Activation and payment insert happen inside the reconfirmation workflow, not the submit action**: Consistent with the admission workflow pattern. The submit action only transitions status to `"processing"` and fires the event; the workflow owns the rest of the state machine.
- **`membership_reconfirmation_pending` is added to `LIVE_TENURE_STATUSES`**: Prevents admins from starting a board proposal for a user who is already in the reconfirmation queue. Also added to `ACTIVE_TENURE_STATUSES` so `getActiveLegalMembership` returns it — required for the application form page to find the tenure.
- **`bylawsAcceptedAt` and `feesAcceptedAt` are removed from the user schema**: These columns were added for the onboarding extension being replaced. Since the application form stores declarations in `membershipApplication.declarations` (JSONB), no equivalent columns on `user` are needed.

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification.*

**Status state machine comparison:**

```
Board flow (unchanged):
  import/propose → admission_pending
                → (board votes) → application_pending
                → (user submits form) → processing
                → (Inngest: membership-admission-workflow) → active

Reconfirmation flow (new):
  import with joinedAt → membership_reconfirmation_pending
                       → (user submits form) → processing
                       → (Inngest: membership-reconfirmation-workflow) → active
```

**Route group structure after U3:**

```
src/app/(authenticated)/
  (app)/                          ← cockpit layout (sidebar, gate)
    membership/
      page.tsx, task-card.tsx, ...  (unchanged)
      application/                  ← REMOVED from (app)
  (membership-application)/         ← NEW sibling group, no cockpit gate
    membership/
      application/
        [step]/
          layout.tsx, page.tsx, (steps)/, ...
  (onboarding)/                   ← unchanged
    onboarding/[step]/
```

---

## Implementation Units

### U1. Schema: Add reconfirmation status; remove obsolete user columns

**Goal:** Extend the `legalMembershipStatus` enum with `"membership_reconfirmation_pending"`, update all derived structures, and remove `bylawsAcceptedAt`/`feesAcceptedAt` from the `user` table.

**Requirements:** R1, R8, R10

**Dependencies:** None

**Files:**
- Modify: `src/db/schema/legal-membership.ts`
- Modify: `src/db/schema/auth.ts`
- Create: `src/db/migrations/` (auto-generated; do not hand-edit)

**Approach:**
- Add `"membership_reconfirmation_pending"` to the `legalMembershipStatus` pgEnum array.
- Add it to both `LIVE_TENURE_STATUSES` and `ACTIVE_TENURE_STATUSES` (with `satisfies LegalMembershipStatus[]` to get type-safety).
- Update the raw SQL string in the `uniqueIndex` `.where(sql\`...\`)` clause to include `'membership_reconfirmation_pending'` — this string is not derived from the TypeScript array and must be edited manually.
- In `auth.ts`: remove `bylawsAcceptedAt` and `feesAcceptedAt` columns.
- Run `npm run db:generate` then `npm run db:migrate`.

**Test scenarios:**
- Happy path: After migration, inserting a `legal_membership` row with `status = "membership_reconfirmation_pending"` succeeds.
- Edge case: Attempting to insert a second `membership_reconfirmation_pending` row for the same `userId` throws a unique constraint violation (partial index covers the new status).
- Edge case: `LIVE_TENURE_STATUSES` and `ACTIVE_TENURE_STATUSES` TypeScript arrays both include `"membership_reconfirmation_pending"` and satisfy the `LegalMembershipStatus` constraint.

**Verification:** Migration applies without error; `db:studio` shows the new enum value available; unique partial index covers `membership_reconfirmation_pending`.

---

### U2. Import action: Create reconfirmation-pending tenure for historical joins

**Goal:** When an admin imports a user with a historical `joinedAt` date, create a `membership_reconfirmation_pending` legal membership instead of immediately activating it.

**Requirements:** R1

**Dependencies:** U1

**Files:**
- Modify: `src/app/(authenticated)/(app)/people/import-google-user-action.ts`

**Approach:**
- In Branch A (`hasHistoricalJoinDate === true`): change `legalMembership.status` from `"active"` to `"membership_reconfirmation_pending"`.
- Keep `user.legalMembershipState = "not_member"` (remove the `"active_member"` assignment from Branch A).
- Remove the `membershipPayment` insert from Branch A — payment row creation moves to the reconfirmation workflow's activation step.
- Keep `activatedAt = joinedAt` on the `legalMembership` row — this historical date is used by the admission confirmation template.
- No Inngest event is fired at import time; the reconfirmation workflow fires after the user submits the application form.

**Patterns to follow:**
- Branch B (admission workflow) for the pattern of creating a pending tenure without immediate activation.

**Test scenarios:**
- Happy path: Importing a `"member"` status user with `joinedAt = "2020-03-02"` creates `legalMembership.status = "membership_reconfirmation_pending"` and `user.legalMembershipState = "not_member"` and `legalMembership.activatedAt = 2020-03-02`.
- Happy path: No `membershipPayment` row is created during import.
- Edge case: Importing the same user twice fails at the unique partial index for `membership_reconfirmation_pending` (covered by U1 test).
- Edge case: Importing a user WITHOUT `joinedAt` still creates `admission_pending` and starts the board flow (Branch B unchanged).

**Verification:** After importing a user with `joinedAt`, DB shows `legal_membership.status = "membership_reconfirmation_pending"`, `user.legal_membership_state = "not_member"`, no `membership_payment` row.

---

### U3. Move application form to `(membership-application)` route group

**Goal:** Relocate the application form files from `src/app/(authenticated)/(app)/membership/application/` to a new `src/app/(authenticated)/(membership-application)/membership/application/` group so the `(app)` gate does not apply to the form. Update the route guard to accept both statuses.

**Requirements:** R3, R9

**Dependencies:** U1

**Files:**
- Move: `src/app/(authenticated)/(app)/membership/application/` → `src/app/(authenticated)/(membership-application)/membership/application/`
- Create: `src/app/(authenticated)/(membership-application)/layout.tsx`
- Modify: `src/app/(authenticated)/(membership-application)/membership/application/[step]/page.tsx` (route guard)

**Approach:**
- Create `(membership-application)/layout.tsx` with a focused layout (no sidebar, no cockpit chrome). Mirror the structure of `(onboarding)/layout.tsx` — include `getCurrentUser()` and redirect to `/auth` if no session (consistent with the codebase pattern; `page.tsx` also checks, but the layout is the canonical auth guard). Add a back link to the cockpit for board-flow users who arrive from an email link.
- In `page.tsx`, update the guard from `status !== "application_pending"` to `status !== "application_pending" && status !== "membership_reconfirmation_pending"`. Keep the fallback redirect to `/membership`.
- No URL changes — the public path `/membership/application/[step]` is unchanged.

**Patterns to follow:**
- `src/app/(authenticated)/(onboarding)/layout.tsx` for the focused non-cockpit layout pattern.

**Test scenarios:**
- Happy path: A user with `application_pending` status can navigate to `/membership/application/personal-information` and sees the form.
- Happy path: A user with `membership_reconfirmation_pending` status can navigate to `/membership/application/personal-information` and sees the form.
- Error path: A user with `active` status visiting `/membership/application/personal-information` is redirected to `/membership`.
- Integration: The `(app)` layout's sidebar and header are NOT rendered on the application form page (route group isolation confirmed).

**Verification:** `/membership/application/personal-information` renders for both `application_pending` and `membership_reconfirmation_pending` users; `active`-status users are redirected to `/membership`.

---

### U4. Application form: thread reconfirmation mode through steps and copy

**Goal:** Derive `isReconfirmation` from `legalMembership.status` in `page.tsx` and pass it to step components that need to show different copy.

**Requirements:** R4

**Dependencies:** U3

**Files:**
- Modify: `src/app/(authenticated)/(membership-application)/membership/application/[step]/page.tsx`
- Modify: `src/app/(authenticated)/(membership-application)/membership/application/[step]/application-steps.ts`
- Modify: `src/app/(authenticated)/(membership-application)/membership/application/[step]/(steps)/step-personal-information.tsx`
- Modify: `src/app/(authenticated)/(membership-application)/membership/application/[step]/(steps)/step-review.tsx`

**Approach:**
- In `page.tsx`, derive `isReconfirmation = activeLegalMembership.status === "membership_reconfirmation_pending"` after the guard check and pass it to step components that render copy.
- In `application-steps.ts`, make `title` and `subtitle` in `APPLICATION_STEP_META` either a string or a function of `isReconfirmation`, OR pass `isReconfirmation` to the layout component for the heading area.
- Copy direction for reconfirmation mode:
  - Page-level subtitle: "As an existing member, we need to collect your details to generate your official membership documents."
  - Review step submit button: "Confirm membership" instead of "Submit application".
  - Personal information intro: frame as "confirming your details" rather than "applying".
- Non-changed steps (identity, bylaws, fees) require no copy changes — their content (declarations, documents) is identical for both flows.

**Patterns to follow:**
- Existing step component props pattern; `isReconfirmation: boolean` added to `StepComponentProps` or passed only to the steps that use it.

**Test scenarios:**
- Happy path: A `membership_reconfirmation_pending` user sees reconfirmation-specific heading and submit label on the personal-information and review steps.
- Happy path: An `application_pending` user sees the existing copy (no regressions).
- Edge case: If `isReconfirmation` is `undefined` (defensive), falls back to `false` (standard application mode).

**Verification:** Visual inspection of both flows shows correct copy; no regressions in the board-flow user experience.

---

### U5. Submit action and new Inngest event

**Goal:** Extend the submit action to accept `membership_reconfirmation_pending` as a valid pre-submission status and fire the correct event for each flow.

**Requirements:** R5

**Dependencies:** U1, U3

**Files:**
- Modify: `src/app/(authenticated)/(membership-application)/membership/application/[step]/submit-application-action.ts`
- Modify: `src/lib/inngest.ts`

**Approach:**
- In `submit-application-action.ts`, change the status guard from `lm.status !== "application_pending"` to accept both `"application_pending"` and `"membership_reconfirmation_pending"`.
- After the DB transaction (which sets `legalMembership.status = "processing"`), fire `events.reconfirmationSubmitted` if the pre-submission status was `"membership_reconfirmation_pending"`, or `events.applicationSubmitted` if it was `"application_pending"`.
- In the rollback block (Inngest send failure), restore to the correct pre-submission status (`"application_pending"` or `"membership_reconfirmation_pending"` respectively).
- In `inngest.ts`, add `reconfirmationSubmitted: eventType("membership/reconfirmation.submitted", { schema: staticSchema<{ legalMembershipId: string }>() })`.

**Patterns to follow:**
- The existing rollback pattern in `submit-application-action.ts` for the Inngest send failure case.
- The `staticSchema` / `eventType` pattern used for existing events in `inngest.ts`.

**Test scenarios:**
- Happy path: Submitting with `application_pending` fires `applicationSubmitted` and sets status to `"processing"`.
- Happy path: Submitting with `membership_reconfirmation_pending` fires `reconfirmationSubmitted` and sets status to `"processing"`.
- Error path: If Inngest send fails for a reconfirmation submission, status rolls back to `"membership_reconfirmation_pending"` (not `"application_pending"`).
- Error path: Submitting with any other status (e.g., `"active"`) returns a validation error.
- Edge case: Double-submission attempt (status already `"processing"`) is rejected by the existing `draft.status !== "draft"` guard.

**Verification:** After submit, `legalMembership.status = "processing"` in DB; correct event name visible in Inngest dev server dashboard.

---

### U6. Reconfirmation Inngest workflow

**Goal:** Create a new Inngest workflow that auto-approves a reconfirmation submission — archiving documents, activating the membership, and sending a confirmation email — without board involvement.

**Requirements:** R6, R7

**Dependencies:** U1, U5

**Files:**
- Create: `src/inngest/membership-reconfirmation-workflow.ts`
- Modify: `src/inngest/index.ts`

**Approach:**
- Trigger: `events.reconfirmationSubmitted` with `{ legalMembershipId }`.
- Steps (each wrapped in `step.run()`):
  1. **`load-subject-data`**: Query `legalMembership` (for `activatedAt`, `status`, `userId`) and `membershipApplication` (for personal data and submitted declarations). Throw if application is not `"submitted"` or required fields are missing.
  2. **`archive-membership-application`**: Render and merge the Aufnahmeantrag PDF (application data + appendix dividers + Satzung + Finanzordnung pages). Call `archiveLegalDocument` with `documentType: "membership_application"`. Mirror the archiving step in `membership-admission-workflow.ts`.
  3. **`activate-legal-membership`**: In a single DB transaction: set `legalMembership.status = "active"`, set `user.legalMembershipState = "active_member"`, insert `membershipPayment` with `onConflictDoNothing`. Do NOT update `legalMembership.activatedAt` — preserve the historical join date set at import time.
  4. **`archive-admission-confirmation`**: Render the admission confirmation PDF with `board: []` (empty board list) and `activatedAt` from the loaded `legalMembership`. Call `archiveLegalDocument`.
  5. **`send-confirmation-email`**: Download both archived documents from Drive. Send `MembershipAdmissionConfirmedEmail` to the user. Consider a reconfirmation-appropriate subject line ("Your START Berlin membership is now officially documented").
- Returns `{ outcome: "reconfirmed", legalMembershipId }`.

**Patterns to follow:**
- `src/inngest/membership-admission-workflow.ts` steps 9a–12 for the document archiving, activation, and email pattern.
- `onConflictDoNothing` for the `membershipPayment` insert.
- `renderToBuffer`, `mergePdfsWithAttachments`, `renderAppendixPage` for PDF generation.

**Test scenarios:**
- Happy path: After the workflow completes, `legalMembership.status = "active"`, `user.legalMembershipState = "active_member"`, `membershipPayment` row exists, two `legalDocument` rows created, confirmation email sent.
- Happy path: The admission confirmation PDF uses the historical `activatedAt` date (not today's date).
- Edge case: If `activate-legal-membership` is replayed, the `onConflictDoNothing` guard prevents a duplicate `membershipPayment` insert.
- Edge case: If `archive-membership-application` is replayed, `archiveLegalDocument` is idempotent (existing archived document is not duplicated — verify this matches the Drive archive behavior).
- Error path: If a required field (birthDate, street, etc.) is missing on the application, the workflow throws in step 1 before touching Drive or activation state.

**Verification:** Run via Inngest dev server after submitting a reconfirmation application. Confirm DB state, Drive files, and email delivery in the dev environment.

---

### U7. App layout gate: redirect reconfirmation-pending users

**Goal:** Block `membership_reconfirmation_pending` users from the cockpit and redirect them to the application form.

**Requirements:** R2

**Dependencies:** U1, U3

**Files:**
- Modify: `src/app/(authenticated)/(app)/layout.tsx`

**Approach:**
- After fetching `user`, call `getActiveLegalMembership(user.id)` (already used by application form page; now also used by the gate).
- If `activeLegalMembership?.status === "membership_reconfirmation_pending"`, redirect to `/membership/application/personal-information`.
- Place this check BEFORE the `getOnboardingProgress` check — a reconfirmation-pending user with `legalMembershipState = "not_member"` would otherwise pass the onboarding check (since `requiresAddress` only triggers for `active_member`/`former_member`) and enter the cockpit.
- Because the application form is now outside `(app)` (U3), this redirect does not loop.
- To avoid adding a DB query for every authenticated page load, gate the `getActiveLegalMembership` call on `user.legalMembershipState === "not_member"`: only `"not_member"` users can have a `membership_reconfirmation_pending` tenure (per R1); users with `"active_member"` or `"former_member"` cannot. This makes the extra query zero-cost for the vast majority of active users.

**Patterns to follow:**
- Existing redirect structure in `layout.tsx` using `redirect()` from `next/navigation`.
- `getActiveLegalMembership` from `src/db/membership.ts`.

**Test scenarios:**
- Happy path: A `membership_reconfirmation_pending` user visiting `/` is redirected to `/membership/application/personal-information`.
- Happy path: A `membership_reconfirmation_pending` user visiting `/people` is also redirected (gate applies to all `(app)` routes).
- Happy path: A user with `active` status and completed onboarding accesses the cockpit normally (no regression, `getActiveLegalMembership` is not called for them).
- Happy path: A user with `application_pending` status and completed profile accesses the cockpit normally (no regression — board-flow users are not cockpit-gated).
- Edge case: A user with NO legal membership and completed profile accesses the cockpit normally.
- Edge case: A `"not_member"` user with NO active tenure (brand-new user) also accesses the cockpit normally after completing onboarding.

**Verification:** Logging in as a `membership_reconfirmation_pending` test user redirects to the application form; an `active` member sees the cockpit normally.

---

### U8. Cleanup: remove obsolete onboarding extension

**Goal:** Delete the birthday/bylaws/fees onboarding steps, the `existing-member-documentation-workflow`, and related glue code added earlier in this branch. Restore `getOnboardingProgress` to synchronous.

**Requirements:** R10, R11

**Dependencies:** U3, U5, U6, U7 (all must land first so no code still references the removed modules)

**Files:**
- Delete: `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/step-birthday.tsx`
- Delete: `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/step-birthday-action.ts`
- Delete: `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/step-bylaws.tsx`
- Delete: `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/step-bylaws-action.ts`
- Delete: `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/step-fees.tsx`
- Delete: `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/step-fees-action.ts`
- Delete: `src/inngest/existing-member-documentation-workflow.ts`
- Modify: `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/index.tsx` — remove `BIRTHDAY`, `BYLAWS`, `FEES` from `ONBOARDING_STEPS`, `STEP_DEFINITIONS`, `ALL_STEPS`
- Modify: `src/schema/onboarding-progress.ts` — remove birthday/bylaws/fees checks; remove `bylawsAcceptedAt`, `feesAcceptedAt`, `birthDate`, `id` from `OnboardingProgressUser` type; remove the `membershipApplication.findFirst` DB query; function becomes synchronous
- Modify: `src/app/(authenticated)/(app)/layout.tsx` — remove `await` on `getOnboardingProgress` (now synchronous)
- Modify: `src/app/(authenticated)/(onboarding)/onboarding/[step]/layout.tsx` — same de-await
- Modify: `src/app/(authenticated)/(onboarding)/onboarding/page.tsx` — same de-await
- Modify: `src/app/(authenticated)/(app)/people/propose-membership-action.ts` — same de-await
- Modify: `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/step-welcome.tsx` — remove `active_member` conditional copy; show a single welcome message
- Modify: `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/step-address.tsx` — remove `needsExtendedOnboarding` logic; always navigate to `/` after saving address
- Modify: `src/inngest/index.ts` — remove `existingMemberDocumentationWorkflow` from the registered functions array
- Fix: `src/app/(authenticated)/(app)/membership/membership-status.ts` — fix the pre-existing bug where `getOnboardingProgress(user)` is called without `await` (now a sync call, so the bug is resolved naturally once the function is synchronous)
- Fix: `src/db/people.ts` — also calls `getOnboardingProgress(user)` without `await` inside a `.map()` (pre-existing bug, also resolved naturally by the function becoming synchronous)

**Approach:**
- After removing the DB query from `getOnboardingProgress`, the function becomes `function getOnboardingProgress(user: OnboardingProgressUser): OnboardingProgress` (sync). Update its return type annotation.
- The `OnboardingProgress` type loses `"birthday" | "bylaws" | "fees"` — verify no remaining code branches on these values.
- Run `npm run lint` after deletions to catch any remaining import references.

**Test scenarios:**
- Happy path: `getOnboardingProgress` with a user missing `personalEmail` returns `"master-data"`.
- Happy path: `getOnboardingProgress` with a fully-complete `active_member` user missing address returns `"address"`.
- Happy path: `getOnboardingProgress` with a fully-complete user returns `"completed"`.
- Edge case: `getOnboardingProgress` with an `active_member` who has a submitted membership application (board flow) returns `"completed"` — the DB query that used to detect this is gone; the address check alone is now the gate.
- Regression: Existing tests in `src/app/(authenticated)/(app)/membership/application/application-validation.test.ts` still pass.

**Verification:** `npm run lint` passes with no unused import or missing module errors. `npm run build` succeeds.

---

## System-Wide Impact

- **`getActiveLegalMembership` return coverage**: With `membership_reconfirmation_pending` in `ACTIVE_TENURE_STATUSES`, this function now returns reconfirmation-pending tenures. Callers that branch on specific statuses (task card, application form page, membership status helper) will need to handle the new value where applicable — verify each call site.
- **`LIVE_TENURE_STATUSES` unique index SQL**: The raw SQL string in `legal-membership.ts` must exactly match the TypeScript array after the new status is added. A mismatch silently allows duplicate active tenures.
- **`propose-membership-action.ts`**: Because `membership_reconfirmation_pending` is in `LIVE_TENURE_STATUSES`, the existing check (`LIVE_TENURE_STATUSES.includes(existingTenure.status)`) already blocks admin re-proposal for reconfirmation-pending users — no code change needed, but verify this invariant holds.
- **`membership-status.ts` async bug**: The pre-existing bug (calling async `getOnboardingProgress` without await) is resolved naturally by U8 making the function synchronous — no separate fix needed.
- **Unchanged invariants**: The board-vote flow (`admission_pending → application_pending → processing → active`) is entirely unchanged. The application form URL (`/membership/application/[step]`) does not change. Existing `active` members are unaffected.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| U2 ships before U7: reconfirmation-pending users created by import have `legalMembershipState = "not_member"`, pass `getOnboardingProgress` (which only gates on field presence), and enter the cockpit before the gate is live | Land U2 and U7 in the same commit/PR. The units share a dependency on U1 (schema) and should not be split across separate deployments. |
| SQL partial index not updated to include new status → duplicate live tenures possible | U1 explicitly requires updating the raw SQL string; test scenario enforces the unique constraint |
| `archiveLegalDocument` has a documented Drive duplication hole: if Drive succeeds but the DB insert fails on a step retry, a second physical file is uploaded | Pre-existing in the codebase and shared with the board-admission workflow. Out of scope for this plan; document as a known limitation in `docs/solutions/` if not already captured. |
| Board-flow users lose cockpit chrome on the application form after route group move | New `(membership-application)/layout.tsx` provides appropriate minimal chrome with a back link |
| Submit action rollback does not roll back `user` table address/birthDate fields written in the same transaction | Pre-existing behavior inherited from the current submit action. Reconfirmation-pending users filling out the form will have written their address before this edge case triggers; the partial rollback leaves those fields populated, which is acceptable. |
| `membership-status.ts` and `people.ts` call `getOnboardingProgress` without `await` | Resolved by making the function synchronous in U8; both call sites are listed in U8 file list. |
| Existing dev/test users in `"birthday"/"bylaws"/"fees"` onboarding state after current branch's extended steps | These users are dev-only data; their `legalMembership.status = "active"` is unaffected by this plan |

---

## Sources & References

- Related code: `src/inngest/membership-admission-workflow.ts` (reference pattern for U6)
- Related code: `src/inngest/existing-member-documentation-workflow.ts` (superseded by U6)
- Related code: `src/schema/onboarding-progress.ts` (simplified in U8)
- Related code: `src/db/schema/legal-membership.ts` (U1 target)
- Institutional learning: `docs/solutions/architecture-patterns/member-lifecycle-entry-points-and-application-flow-2026-05-10.md`
- Tone of voice: `docs/solutions/conventions/reusable-tone-of-voice-and-wording-decisions-2026-05-02.md` (applies to U4 copy)
