---
title: "fix: Address membership lifecycle code review findings"
type: fix
status: completed
date: 2026-05-09
origin: docs/plans/2026-05-02-001-feat-membership-lifecycle-workflows-plan.md
---

# fix: Address Membership Lifecycle Code Review Findings

## Summary

Address all findings surfaced by the post-implementation review of the U1–U13 membership lifecycle feature. Issues span Inngest reliability, transaction atomicity, permission layer gaps, dead code not removed per the original plan, type safety, error handling, code structure, and missing test coverage. Units are ordered by impact: data-safety and reliability fixes first, permission layer second, cleanup and structural improvements after.

---

## Problem Frame

The code review of branch `emdash/membership-lifecycle-oqjo9` produced 38 findings across P0–P3 severity levels. Twelve are critical (P0–P1) and must be resolved before production rollout. The remainder are correctness improvements, code quality fixes, and test coverage gaps explicitly required by the original plan's test scenarios. This fix plan addresses all of them systematically.

---

## Requirements

- R1. All P0–P1 correctness and reliability issues must be resolved.
- R2. The permission convention documented in `docs/solutions/conventions/reusable-permission-policy-api-2026-05-02.md` must be honoured in all server actions and page components.
- R3. `src/lib/workflows/` must be deleted and the `workflow` DB table must be dropped, as specified in U3 of the original lifecycle plan.
- R4. `handleServerError` must surface errors to the client; all server action errors must currently reach the client silently.
- R5. Type safety gaps in the workflow and schema files must be closed.
- R6. All test scenarios explicitly listed in the original plan's U3–U13 units that remain missing must be written.
- R7. Code structure must follow established patterns: single source-of-truth for shared constants, no duplicated helpers, no unnecessary DB round-trips.

---

## Scope Boundaries

- This plan does not add new product features; it only corrects and hardens the existing implementation.
- GoCardless reconciliation flow and the payment-return page are not touched beyond what is already covered by U8 (error handling).
- The `legal-privileges.ts` wiring into People filter queries (M-16 from the review) is a deferred feature follow-up, not a bug; it is not in scope here.
- Digital resignation, exclusion workflows, and batch resolutions remain out of scope per the original plan.

### Deferred to Follow-Up Work

- Wire `isLegalMember` / `filterLegalMembers` into People directory filter queries: separate PR once legal-privilege display requirements are confirmed.
- Add HTTP idempotency keys on Resend sends (requires Resend API key support): deferred to infrastructure follow-up.

---

## Context & Research

### Relevant Code and Patterns

- `src/inngest/membership-admission-workflow.ts` — primary target for U1, U2, U3, U7, U9, U10
- `src/lib/legal-documents/drive-archive.ts` — target for U1, U4
- `src/app/(authenticated)/(app)/people/resolutions/[id]/vote-action.ts` — target for U2, U5, U8
- `src/app/(authenticated)/(app)/people/propose-membership-action.ts` — target for U3, U10
- `src/app/(authenticated)/(app)/membership/application/[step]/submit-application-action.ts` — target for U3
- `src/app/(authenticated)/(app)/people/import-google-user-action.ts` — target for U3
- `src/lib/action-client.ts` — target for U8
- `src/db/membership.ts` — target for U7
- `src/db/schema/legal-document.ts` — target for U4, U9
- `src/lib/board-resolution-rules.ts` — target for U9
- `src/lib/workflows/` — deletion target for U6
- `drizzle/` — migration target for U4, U6, U11

### Institutional Learnings

- Permission convention: all protected server-side behavior must use `can()` from `src/lib/permissions/server.ts`. Client gates (`<Can>`) are affordances only. See `docs/solutions/conventions/reusable-permission-policy-api-2026-05-02.md`.
- Tone convention: error copy pattern is "Could not [action]. Please try again. If this keeps happening, email operations@start-berlin.com." See `docs/solutions/conventions/reusable-tone-of-voice-and-wording-decisions-2026-05-02.md`.

### External References

- Inngest v3.52 docs: `step.waitForEvent` `if` CEL syntax: `if: "async.data.legalMembershipId == event.data.legalMembershipId"`. The `match` field is `@deprecated` in v3.52 and should not be used.

---

## Key Technical Decisions

- **Outbox gap (U3): treat `inngest.send()` failure as a thrown action error, not silent.** The simplest safe fix: if `inngest.send()` throws after the DB transaction commits, surface the error to the caller so they can retry. A full transactional outbox (DB row + polling job) is over-engineered for V1 volume. Add an operational note to monitor `WHERE inngest_run_id IS NULL AND status = 'admission_pending'`.
- **Drive idempotency (U4): add `UNIQUE(legal_membership_id, document_type)` constraint on `legal_document`, not Drive-side deduplication.** The DB constraint is the authoritative idempotency gate. Catching the unique-violation error in `archiveLegalDocument` replaces the current SELECT-then-INSERT pattern with an ON CONFLICT / catch approach.
- **`lib/workflows/` deletion (U6): delete all five files and add a new Drizzle migration to DROP TABLE workflow and DROP TYPE workflow_status.** The migration filename continues the existing sequence (0015).
- **`ACTIVE_LEGAL_MEMBERSHIP_STATUSES` (U7): export one constant from `src/db/schema/legal-membership.ts` and import it everywhere.** The 5-entry version (including `manual_followup`) is the correct one for `getActiveLegalMembership`; the 4-entry version (excluding `manual_followup`) is the correct one for the "blocks new proposal" check. Both variants should be exported as named constants from the schema file.
- **Partial unique index Drizzle registration (U11): use `uniqueIndex(...).where(sql\`...\`)` inside the `pgTable` definition.** This makes the index visible to Drizzle's snapshot and future `db:generate` runs.

---

## Implementation Units

### U1. Inngest Reliability — `waitForEvent` CEL Syntax, Email Fan-Out, Drive Timeout

**Goal:** Fix the three reliability issues in the Inngest workflow and Drive client that cause incorrect behavior or silent failures under retry.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/inngest/membership-admission-workflow.ts`
- Modify: `src/lib/legal-documents/drive-archive.ts`

**Approach:**

**Issue 1 — Deprecated `match` in `waitForEvent` (lines 103, 188).**
What is wrong: both `step.waitForEvent` calls use `match: "data.legalMembershipId"` which is `@deprecated` in Inngest v3.52.0. The installed SDK version is exactly v3.52, the release where `match` was deprecated. Depending on SDK behavior, this either causes cross-run contamination (wrong run wakes up) or silent filter failure (events are never matched).
How to fix: replace both `match: "data.legalMembershipId"` entries with `if: "async.data.legalMembershipId == event.data.legalMembershipId"`. The `async` field refers to the triggering event's data; `event` refers to the new event being matched.

**Issue 2 — Email fan-out loops inside single `step.run` (lines 74–85, 430–449).**
What is wrong: `send-board-task-emails` and `send-board-completion-emails` loop over participants and call `resend.emails.send` inside one `step.run`. A Resend failure on participant N causes Inngest to retry the entire step body, re-sending to participants 1..N-1. There is no per-recipient idempotency key.
How to fix: split each fan-out loop into one `step.run` per participant with a stable, unique step ID: `send-board-task-email-${participant.userId}` and `send-board-completion-email-${participant.userId}`. This makes each individual send independently retried.

**Issue 3 — Drive API has no HTTP timeout.**
What is wrong: `google.drive({ version: "v3", auth })` uses the default googleapis client with no `timeout` option. A stalled Drive API call hangs the Inngest worker indefinitely; three concurrent stalls can saturate the worker pool.
How to fix: pass `timeout: 30_000` (30 seconds) to the Drive client constructor in `drive-archive.ts`. Create a helper `createDriveClient(auth)` that always applies the timeout so it cannot be omitted by callers.

**Patterns to follow:**
- Existing `step.run` style in `src/inngest/new-user-workflow.ts`

**Test scenarios:**
- Happy path: with valid `if` expression, a `board-vote.cast` event carrying the matching `legalMembershipId` wakes the correct `waitForEvent`
- Edge case: a `board-vote.cast` event with a different `legalMembershipId` does not wake the waiting step
- Happy path: Drive client constructed with timeout; stall beyond 30s throws rather than hanging

**Verification:**
- No `match:` field appears in the codebase
- Each email send is in its own `step.run` with a participant-scoped step ID
- `google.drive(...)` calls include `timeout: 30_000`

---

### U2. Transaction Atomicity — Legal Activation and Vote Insertion

**Goal:** Wrap the two legal-state DB updates in a single transaction and ensure the vote check-then-insert is atomic.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/inngest/membership-admission-workflow.ts`
- Modify: `src/app/(authenticated)/(app)/people/resolutions/[id]/vote-action.ts`

**Approach:**

**Issue 1 — `activate-legal-membership` step has two sequential `db.update` calls with no transaction (lines 350–358).**
What is wrong: if the first UPDATE (`legal_membership.status = 'active'`) commits and the second UPDATE (`user.legalMembershipState = 'active_member'`) fails, Inngest retries the step. During the retry window `getActiveLegalMembership()` returns the active tenure record while `isLegalMember()` returns false — the member is denied legal privileges while legally admitted. On retry, `activatedAt` is also overwritten with a new timestamp while callers see the memoized first value, causing drift.
How to fix: wrap both UPDATE calls inside `db.transaction(async (tx) => { ... })`. Use the transaction reference `tx` for both updates.

**Issue 2 — Vote action: SELECT-then-INSERT is not atomic (lines 74–104).**
What is wrong: the duplicate-vote check (SELECT from `board_vote`) and the INSERT are separate statements with no transaction. Two concurrent requests from the same user both pass the SELECT; the DB unique constraint prevents the double-row but throws a Postgres `ERROR 23505` that `handleServerError` currently swallows silently — the second request returns no error to the client and the second Inngest event is never sent.
How to fix: wrap the participant-lookup SELECT, duplicate-check SELECT, and INSERT in a `db.transaction()`. Catch the unique-constraint violation (error code `23505`) inside the action and convert it to a user-facing `returnValidationErrors` response: "You have already voted on this resolution."

**Patterns to follow:**
- Drizzle `db.transaction(async (tx) => { ... })` pattern

**Test scenarios:**
- Happy path: `activate-legal-membership` step sets both `legal_membership.status = 'active'` and `user.legalMembershipState = 'active_member'` atomically
- Error path: if the second UPDATE would fail (simulated), neither UPDATE commits
- Edge case: concurrent vote submissions from the same user — second request receives "already voted" error, not a silent success

**Verification:**
- `activate-legal-membership` step contains a single `db.transaction` wrapping both updates
- Vote action catches `23505` and returns a structured validation error

---

### U3. Inngest Outbox Safety — Prevent Stuck Tenures on Send Failure

**Goal:** Ensure that if `inngest.send()` fails after the DB transaction commits, the caller surfaces an error rather than silently leaving a stuck tenure or application row.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/app/(authenticated)/(app)/people/propose-membership-action.ts`
- Modify: `src/app/(authenticated)/(app)/membership/application/[step]/submit-application-action.ts`
- Modify: `src/app/(authenticated)/(app)/people/import-google-user-action.ts`

**Approach:**

**Issue 1 — `propose-membership-action`: `inngest.send()` called after the DB transaction commits.**
What is wrong: the DB transaction (creating `legal_membership`, `board_resolution`, `admission_participant`) commits before `inngest.send("membership/admission-workflow.started", ...)` is called. If the send fails, the `legal_membership` row sits in `admission_pending` with `inngestRunId = null` and no running Inngest function. Votes can be cast (status check passes) but no `waitForEvent` is registered — the workflow is permanently stalled until the 90-day timeout.
How to fix: let `inngest.send()` throw naturally. The `actionClient` middleware will catch it and surface it as a server error (once U8 fixes `handleServerError`). Add an operational runbook note to scan for `WHERE inngest_run_id IS NULL AND status = 'admission_pending'` to detect orphaned tenures from past failures.

**Issue 2 — `submit-application-action`: same outbox gap for application submission.**
What is wrong: `inngest.send("membership/application.submitted", ...)` is called after the `membership_application` INSERT commits. If the send fails, the application is saved in DB but the Inngest function stays at its `waitForEvent` and eventually times out to `manual_followup`. User retry is blocked by "application already submitted."
How to fix: let `inngest.send()` throw naturally — the action client surfaces the error. The user can retry the submit action and the `UNIQUE(legalMembershipId)` constraint on `membership_application` will catch any second INSERT cleanly (convert to a `returnValidationErrors` "already submitted" message rather than a raw DB error — see also U7 issue 4).

**Issue 3 — `import-google-user-action`: always-null `legalMembershipId` return, silent `inngest.send()` skip.**
What is wrong: line 251 has `legalMembershipId: requiresAdmissionWorkflow ? null : null` — both branches of the ternary are `null`. The code re-fetches the `legal_membership` row after the transaction, then at line 263 guards `if (lm) { ... inngest.send(...) }`. If the re-fetch returns null (race condition, replication lag), `inngest.send()` is silently skipped. The import appears to succeed, but no Inngest workflow starts.
How to fix: thread the created `legalMembership.id` out of the DB transaction instead of re-fetching. Return `createdLegalMembershipId` from the transaction and use it directly in the `inngest.send()` call without a guard — if the transaction committed, the row exists. Make the guard `if (!createdLegalMembershipId) throw new Error(...)` so any failure is surfaced rather than silently dropped.

**Patterns to follow:**
- Existing `inngest.send()` calls in `src/inngest/new-user-workflow.ts`

**Test scenarios:**
- Error path: `inngest.send()` throws in `propose-membership-action` → action returns a server error; DB rows from the transaction are committed (no rollback, acceptable); `inngestRunId IS NULL` detectable in DB
- Error path: `inngest.send()` throws in `submit-application-action` → action returns a server error; user can retry
- Happy path: import action with `requiresAdmissionWorkflow = true` returns the non-null `legalMembershipId` and calls `inngest.send()` unconditionally
- Error path: import action transaction failure → no `legalMembership` row, no `inngest.send()`

**Verification:**
- `import-google-user-action` no longer has a `legalMembershipId: null` ternary
- `inngest.send()` is called unconditionally (not inside an `if (lm)` guard) in all three actions

---

### U4. Drive Archival Idempotency — UNIQUE Constraint on `legal_document`

**Goal:** Replace the SELECT-then-INSERT idempotency check in `archiveLegalDocument` with a DB-enforced UNIQUE constraint that prevents duplicate Drive uploads on Inngest retry.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/db/schema/legal-document.ts`
- Create: `drizzle/0015_drive_document_unique.sql` (or generate via `db:generate`)
- Modify: `src/lib/legal-documents/drive-archive.ts`

**Approach:**

**Issue — Drive upload succeeds, then DB insert fails; retry re-uploads.**
What is wrong: `archiveLegalDocument` calls `drive.files.create()` then `db.insert(legalDocument)`. These are not atomic — a network interruption between them causes the Drive upload to succeed while the DB insert fails. Inngest retries the step; `hasArchivedDocument()` queries the DB only (no DB row exists), so the retry uploads again to Drive, creating orphaned PDF files with no DB reference.
How to fix: add a `unique()` constraint on `(legalMembershipId, documentType)` in the `legalDocument` schema. Update `archiveLegalDocument` to use ON CONFLICT DO NOTHING (or catch the unique-constraint error and return the existing row). This makes the DB insert idempotent. Remove the `hasArchivedDocument()` pre-flight SELECT from the Inngest step guards — the DB constraint enforces idempotency, not a separate SELECT.

Note: `hasArchivedDocument()` can be kept as a utility for operational queries but should no longer be the idempotency mechanism inside the workflow steps.

**Patterns to follow:**
- Existing `unique()` usage in `src/db/schema/board-admission.ts` for the `board_vote` composite unique

**Test scenarios:**
- Happy path: `archiveLegalDocument` for a new `(legalMembershipId, documentType)` pair inserts one row
- Edge case: calling `archiveLegalDocument` twice for the same `(legalMembershipId, documentType)` — second call does not insert and does not throw; returns the existing row's data

**Verification:**
- `legal_document` table has `UNIQUE(legal_membership_id, document_type)` in migration
- `archiveLegalDocument` handles ON CONFLICT correctly

---

### U5. Permission Layer — Restore `can()` Gates

**Goal:** Add the missing `can()` permission checks to `castVoteAction` and the resolution detail page, as required by the project's permission convention.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Modify: `src/app/(authenticated)/(app)/people/resolutions/[id]/vote-action.ts`
- Modify: `src/app/(authenticated)/(app)/people/resolutions/[id]/page.tsx`

**Approach:**

**Issue 1 — `castVoteAction` bypasses `can()` entirely.**
What is wrong: the vote action performs a raw `admissionParticipant` DB lookup to decide authorization instead of calling `can("membership.vote_resolution")`. The permission convention (`docs/solutions/conventions/reusable-permission-policy-api-2026-05-02.md`) requires all protected server-side mutations to go through the typed `can()` check. The evaluator already has a case for `membership.vote_resolution` (confirmed by the permissions test) — it just isn't called in the action.
How to fix: add `await can("membership.vote_resolution")` (importing from `src/lib/permissions/server.ts`) as the first check inside the action, before the participant-list lookup. The participant-list check remains as a domain guard that follows.

**Issue 2 — Resolution detail page renders without a `can()` gate.**
What is wrong: the server component `page.tsx` checks participant membership before fetching resolution data, but does not call `can("membership.view_resolution")`. The convention requires `can()` at the top of any server component that renders protected content.
How to fix: add `await can("membership.view_resolution")` at the top of the page server component's render logic, before any DB queries. Return `notFound()` or redirect if the check fails.

**Patterns to follow:**
- Existing `requirePermission()` / `can()` usage in other server components and actions
- `docs/solutions/conventions/reusable-permission-policy-api-2026-05-02.md`

**Test scenarios:**
- Happy path: user with `membership.vote_resolution` permission (legal officer) can cast a vote
- Error path: user without `membership.vote_resolution` permission is rejected before the participant-list check
- Error path: non-participant user with valid officer role is rejected by the participant-list check after `can()` passes
- Error path: unauthenticated user cannot access the resolution page

**Verification:**
- `castVoteAction` calls `can("membership.vote_resolution")` as its first authorization step
- Resolution `page.tsx` calls `can("membership.view_resolution")` before any DB queries

---

### U6. Delete `lib/workflows/` Directory and Drop `workflow` DB Table

**Goal:** Complete the deletion tasks explicitly specified in U3 of the original lifecycle plan that were not executed: remove `src/lib/workflows/` and drop the `workflow` table and `workflow_status` enum from the database.

**Requirements:** R3

**Dependencies:** None

**Files:**
- Delete: `src/lib/workflows/core.ts`
- Delete: `src/lib/workflows/membership-admission.ts`
- Delete: `src/lib/workflows/membership-payment-setup.ts`
- Delete: `src/lib/workflows/index.ts`
- Delete: `src/lib/workflows/validation.test.ts`
- Create: `drizzle/0015_drop_workflow_table.sql` (or `0016` depending on U4's migration number)

**Approach:**

**Issue 1 — `src/lib/workflows/` not deleted.**
What is wrong: the original lifecycle plan (U3) explicitly said "Delete `src/lib/workflows/`". All five files remain. No active application code imports from this directory. The Zod JSONB state machine is the superseded approach; its continued presence misleads future developers about how workflow state is managed.
How to fix: delete all five files. Verify no imports reference them (`grep -r "from.*lib/workflows"` must return no hits outside test files).

Note: `src/lib/workflows/validation.test.ts` tests deleted code — it covers vote-counting and fee-acknowledgement scenarios that are now handled by `computeVoteOutcome` in `src/lib/board-resolution-rules.ts` and explicit DB columns. Deleting this file removes false test signal.

**Issue 2 — `workflow` DB table and `workflow_status` enum not dropped.**
What is wrong: migration 0012 creates the `workflow` table and `workflow_status` enum. Neither 0013 nor 0014 drops them. No application code queries the table. The table accumulates as dead schema. The original plan required its removal.
How to fix: add a new migration that runs `DROP TABLE IF EXISTS workflow CASCADE; DROP TYPE IF EXISTS workflow_status;`. Generate migration with `npm run db:generate` after removing the `workflow.ts` schema export from `src/db/schema/index.ts` (which should already be the case — verify).

**Patterns to follow:**
- Existing Drizzle migration style in `drizzle/0013_blushing_killer_shrike.sql`

**Test scenarios:**
- Verification: `grep -r "from.*lib/workflows"` returns no hits in application code
- Verification: `SELECT table_name FROM information_schema.tables WHERE table_name = 'workflow'` returns no rows after migration

**Verification:**
- `src/lib/workflows/` directory does not exist
- Migration runs cleanly; `workflow` table and enum are gone
- `npm run db:generate` produces no diff referencing the workflow table

---

### U7. Data Correctness Fixes

**Goal:** Fix four data correctness issues: non-deterministic `getActiveLegalMembership`, PDF voter matching by display name, divergent active-status constants, and the unsafe array destructure in the workflow.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/db/membership.ts`
- Modify: `src/db/schema/legal-membership.ts`
- Modify: `src/db/people.ts`
- Modify: `src/app/(authenticated)/(app)/people/propose-membership-action.ts`
- Modify: `src/lib/legal-documents/templates/board-resolution.tsx`
- Modify: `src/inngest/membership-admission-workflow.ts`

**Approach:**

**Issue 1 — `getActiveLegalMembership` is non-deterministic for re-proposed users.**
What is wrong: a user with a `manual_followup` tenure who gets re-proposed now has two rows matching `ACTIVE_LEGAL_MEMBERSHIP_STATUSES` (which includes `manual_followup`). `findFirst` with no `orderBy` returns a non-deterministic row — potentially the old `manual_followup` record — causing the application step page to redirect an eligible user away from the application flow.
How to fix: add `orderBy: desc(legalMembership.startedAt)` to `db.query.legalMembership.findFirst(...)` in `getActiveLegalMembership`. This ensures the most recently started tenure is returned.

**Issue 2 — `ACTIVE_LEGAL_MEMBERSHIP_STATUSES` defined three ways with different member sets.**
What is wrong: `db/membership.ts` defines a 5-entry array including `manual_followup`; `db/people.ts` and `propose-membership-action.ts` define 4-entry arrays excluding `manual_followup`. The semantic difference creates a behavioral divergence: a `manual_followup` user may block re-proposal in one code path but not in another.
How to fix: export two named constants from `src/db/schema/legal-membership.ts`:
- `LIVE_TENURE_STATUSES` (4-entry, for "blocks new proposal"): `['admission_pending', 'application_pending', 'processing', 'active']`
- `ACTIVE_TENURE_STATUSES` (5-entry, for "user has a visible tenure"): the 4 above plus `manual_followup`
Import and use the appropriate constant everywhere these arrays are currently defined inline.

**Issue 3 — Board resolution PDF matches voters to participants by display name.**
What is wrong: `src/lib/legal-documents/templates/board-resolution.tsx` line 126 joins participants to votes by comparing `voterName` string equality. Two officers with identical display names would have their votes merged incorrectly in the legally archived document.
How to fix: thread `userId` through the `votes` prop of the board resolution template (alongside `voterName`). Match by `vote.voterUserId === participant.userId` instead of by name. The voter name is displayed; the userId is the join key.

**Issue 4 — Unsafe array destructure of `boardResolution` with no null guard (line 216).**
What is wrong: `const [resolution] = await db.select(...).from(boardResolution).where(...)` produces `resolution: {...} | undefined`. The code immediately accesses `resolution.id`, `resolution.resolutionText`, and `resolution.resolutionTextHash` with no guard. If the `board_resolution` row is somehow absent (data corruption, future schema change), this is a runtime TypeError inside an Inngest step that throws and blocks the workflow.
How to fix: add `if (!resolution) throw new Error(\`No board_resolution found for ${legalMembershipId}\`)` immediately after the destructure, consistent with how the missing application is handled at lines 303–306.

**Patterns to follow:**
- Existing null guard at `src/inngest/membership-admission-workflow.ts:303–306`

**Test scenarios:**
- Happy path: `getActiveLegalMembership` for a user with one active tenure returns that tenure
- Edge case: user with a `manual_followup` + a new `application_pending` tenure → `getActiveLegalMembership` returns the `application_pending` one (most recent)
- Error path: `archive-board-resolution` step with no `board_resolution` row throws a descriptive error (not a TypeError)
- Edge case: two officers with the same display name are correctly distinguished in the board resolution PDF by `userId`

**Verification:**
- `getActiveLegalMembership` has `orderBy: desc(legalMembership.startedAt)`
- `LIVE_TENURE_STATUSES` and `ACTIVE_TENURE_STATUSES` are exported from the schema; inline arrays are removed from all call sites
- Board resolution template accepts and uses `voterUserId` for participant matching

---

### U8. Error Handling — `handleServerError`, Error Message Sanitization, Tone Convention

**Goal:** Fix three error handling issues: the silent `handleServerError`, the leaked internal status enum, and server action error copy not following the documented convention.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Modify: `src/lib/action-client.ts`
- Modify: `src/app/(authenticated)/(app)/people/resolutions/[id]/vote-action.ts`
- Modify: `src/app/(authenticated)/(app)/people/propose-membership-action.ts`
- Modify: `src/app/(authenticated)/(app)/membership/application/[step]/submit-application-action.ts`
- Modify: `src/app/(authenticated)/(app)/people/import-google-user-action.ts`

**Approach:**

**Issue 1 — `handleServerError` returns `undefined`, silently swallowing all server action errors.**
What is wrong: `handleServerError` calls `console.log(error)` and returns `undefined`. next-safe-action sets `actionResult.serverError` only when the return value is not `undefined`. Every thrown error from every action — including auth rejections and domain errors — produces `result.serverError === undefined`. All client-side error toasts are permanently silent, regardless of what the client code checks.
How to fix: return a sanitized generic string from `handleServerError`. Log the full error server-side with `console.error`. Do not return `error.message` directly (may expose internals). Example: `return "Something went wrong. Please try again."`. This makes `actionResult.serverError` non-null for all thrown errors.

**Issue 2 — Raw `legalMembershipStatus` enum value leaked in vote-action error message.**
What is wrong: line 51–55 of `vote-action.ts` throws `"Voting is no longer open for this resolution. Current status: " + legalMembershipStatus`. The raw enum value (`manual_followup`, `processing`, `active`) exposes internal workflow state. After U8 issue 1 is fixed, this message could reach the client.
How to fix: replace with `"Voting is no longer open for this resolution."` — omit the status value entirely.

**Issue 3 — Server action error messages don't follow the documented tone convention.**
What is wrong: thrown error strings like `"You are not authorized to propose membership."` and `"Not authorized to vote on this resolution."` don't follow the convention from `docs/solutions/conventions/reusable-tone-of-voice-and-wording-decisions-2026-05-02.md`. The pattern is: "Could not [action]. Please try again. If this keeps happening, email operations@start-berlin.com."
How to fix: update all member-facing thrown error strings in the new server actions to follow the convention. Admin-facing setup errors (e.g., "Board roster is not properly configured:...") are intentionally operational messages and should remain as-is.

**Patterns to follow:**
- `docs/solutions/conventions/reusable-tone-of-voice-and-wording-decisions-2026-05-02.md`

**Test scenarios:**
- Happy path: a thrown error in any action now populates `result.serverError` with a non-null string
- Error path: `castVoteAction` with wrong status → client receives a message following the tone convention, not the raw enum value
- Regression: `console.error` receives the full error object for operational logging

**Verification:**
- `handleServerError` returns a string, not `undefined`
- No `legalMembershipStatus` concatenation in any error message
- All member-facing action error strings follow "Could not [action]..." pattern

---

### U9. Type Safety — `documentType`, `BoardVoteValueInput`, Declarations Cast, `renderToBuffer`

**Goal:** Close four type safety gaps: untyped `documentType`, duplicate vote value union, unnecessary declarations type cast, and undocumented `renderToBuffer` casts.

**Requirements:** R5

**Dependencies:** U4 (which adds UNIQUE constraint on `legal_document.documentType`, making the typed union more important)

**Files:**
- Modify: `src/db/schema/legal-document.ts`
- Modify: `src/lib/legal-documents/drive-archive.ts`
- Modify: `src/lib/board-resolution-rules.ts`
- Modify: `src/lib/inngest.ts`
- Modify: `src/inngest/membership-admission-workflow.ts`
- Modify: `src/lib/legal-documents/templates/membership-application.tsx`
- Modify: `src/lib/legal-documents/templates/board-resolution.tsx`
- Modify: `src/lib/legal-documents/templates/admission-confirmation.tsx`

**Approach:**

**Issue 1 — `documentType` is an untyped `text` column.**
What is wrong: three magic string literals exist at call sites (`'board_resolution'`, `'membership_application'`, `'admission_confirmation'`). `archiveLegalDocument` and `hasArchivedDocument` accept `documentType: string`. A typo passes silently.
How to fix: define `export type LegalDocumentType = "board_resolution" | "membership_application" | "admission_confirmation"` in `src/db/schema/legal-document.ts`. Update `archiveLegalDocument` and `hasArchivedDocument` signatures to use `documentType: LegalDocumentType`. TypeScript will catch unknown values.

**Issue 2 — `BoardVoteValueInput` in `board-resolution-rules.ts` is a third hand-copied union.**
What is wrong: the Drizzle schema has `boardVoteValue` pgEnum; `board-resolution-rules.ts` re-declares the same four values as `BoardVoteValueInput`; `src/lib/inngest.ts` re-declares them again in the event type. Three independent copies diverge silently when a new vote value is added to the enum.
How to fix: re-export `BoardVoteValue` from `src/db/schema/board-admission.ts` (it is already exported as `type BoardVoteValue`). Replace `BoardVoteValueInput` in `board-resolution-rules.ts` with `BoardVoteValue`. Update `inngest.ts` event type to use the same import.

**Issue 3 — `application.declarations` cast unnecessarily widened.**
What is wrong: `src/inngest/membership-admission-workflow.ts` line 322 casts `application.declarations as Record<string, boolean>`. The DB schema declares the column as `jsonb().$type<{ naturalPerson: true; legalCapacity: true; ... }>()`. The literal-`true` typed columns are assignable to `Record<string, boolean>` without a cast. The cast discards the precise type.
How to fix: remove the `as Record<string, boolean>` cast. Pass `application.declarations` directly to the template.

**Issue 4 — `renderToBuffer` type cast duplicated 3× with no explanation.**
What is wrong: all three PDF archival steps repeat `element as import("react").ReactElement<import("@react-pdf/renderer").DocumentProps>`. The root cause (React 19 / react-pdf type boundary mismatch) is not documented. Three repeated casts without context look like copy-paste.
How to fix: annotate each template render function's return type explicitly as `ReactElement<DocumentProps>` (importing from `@react-pdf/renderer`). If the type mismatch persists (React 19's JSX types may be genuinely incompatible), keep one cast per template file with a single-line comment explaining the library boundary, rather than repeating the cast in the workflow.

**Patterns to follow:**
- `BoardVoteValue` type export in `src/db/schema/board-admission.ts`

**Test scenarios:**
- Compilation: passing an unknown string literal as `documentType` produces a TypeScript error
- Compilation: passing a non-`BoardVoteValue` string as a vote value produces a TypeScript error
- Compilation: the declarations field is used in the template without a cast

**Verification:**
- `LegalDocumentType` union exists and is used in both archive functions
- `BoardVoteValueInput` is removed from `board-resolution-rules.ts`; `BoardVoteValue` is imported instead
- No `as Record<string, boolean>` cast on `application.declarations`
- Each template file has an annotated return type or a single documented cast

---

### U10. Code Structure — `subjectUser` Hoisting, `createAdmissionTenure` Helper, Relative Import

**Goal:** Improve code readability by eliminating 5× repeated DB queries for `subjectUser` in the workflow, extracting the duplicated admission-tenure creation logic, and fixing a relative import path.

**Requirements:** R7

**Dependencies:** None

**Files:**
- Modify: `src/inngest/membership-admission-workflow.ts`
- Modify: `src/app/(authenticated)/(app)/people/propose-membership-action.ts`
- Modify: `src/app/(authenticated)/(app)/people/import-google-user-action.ts`
- Create: `src/db/admission.ts` (or co-locate in an appropriate existing file)
- Modify: `src/schema/onboarding-progress.ts`

**Approach:**

**Issue 1 — `subjectUser` fetched 5× independently; line 314 fires two queries in a template literal.**
What is wrong: `db.query.user.findFirst({ where: eqFn(u.id, subjectUserId) })` for `firstName`/`lastName` columns appears at lines 55, 164, 248, 371, and 404 of the workflow. Line 314 fires two separate queries for the same user inside a single template literal to build `subjectName`, producing a silent empty string if either returns `undefined`.
How to fix: load `subjectUser` once in the first Inngest step (`store-inngest-run-id` or a new `load-subject-user` step) and pass the resolved name as a local constant. Pass `subjectUserId` into steps that need it; derive `subjectName` from the one loaded record. This eliminates 4 redundant DB round-trips and makes the template-literal double-query impossible.

**Issue 2 — Resolution text construction and `admissionParticipant` insert duplicated in `propose-membership-action.ts` and `import-google-user-action.ts`.**
What is wrong: both server actions build the German resolution template string, hash it, insert a `boardResolution` row, and insert three `admissionParticipant` rows with identical logic. Any change to the resolution text or participant structure must be applied in two places.
How to fix: extract a `createAdmissionWorkflow(tx, { legalMembershipId, subjectUser, boardRoster, billingApplies })` transaction helper in `src/db/admission.ts`. Both actions call this helper. The helper handles: resolution text generation, hash, `boardResolution` INSERT, and `admissionParticipant` INSERT × 3.

**Issue 3 — Relative import path in `src/schema/onboarding-progress.ts`.**
What is wrong: the file imports `from "../db/schema/auth"` (relative) instead of `from "@/db/schema/auth"` (`@/` alias). The diff modifies this import line without fixing the path, inconsistent with the CLAUDE.md convention.
How to fix: change the import to `from "@/db/schema/auth"`.

**Patterns to follow:**
- Existing `@/` import style throughout the codebase
- Existing transaction helper pattern in the codebase

**Test scenarios:**
- Happy path: workflow function queries `subjectUser` exactly once per run (verifiable via DB mock in a unit test)
- Happy path: `createAdmissionWorkflow` inserts exactly one `board_resolution` and three `admission_participant` rows when called with a valid 3-person board roster
- Compilation: `@/db/schema/auth` import resolves correctly

**Verification:**
- `subjectUser` DB query appears exactly once in the workflow function body
- `propose-membership-action` and `import-google-user-action` both import and call `createAdmissionWorkflow`
- `src/schema/onboarding-progress.ts` uses `@/` for all schema imports

---

### U11. Schema Standards — Drizzle Partial Index, FK Indexes, CLAUDE.md Prefix List

**Goal:** Register the partial unique index with Drizzle, add missing FK indexes on join-heavy tables, and update the CLAUDE.md ID prefix list to match the actual `newId()` keys.

**Requirements:** R7

**Dependencies:** None

**Files:**
- Modify: `src/db/schema/legal-membership.ts`
- Modify: `src/db/schema/board-admission.ts`
- Modify: `src/db/schema/legal-document.ts`
- Modify: `CLAUDE.md`

**Approach:**

**Issue 1 — Partial unique index `legal_membership_active_tenure_idx` not registered with Drizzle.**
What is wrong: the index is created in raw SQL in migration 0014 and documented only as a comment in the schema file. `drizzle/meta/0014_snapshot.json` records `"indexes": {}` for the table. A future `npm run db:generate` run would not know this index exists and could emit a spurious `CREATE UNIQUE INDEX` (failing with "index already exists") or miss a `DROP INDEX` if the status set changes.
How to fix: add the index to the `pgTable` call using `(table, { uniqueIndex, sql }) => ({ activeTenureIdx: uniqueIndex("legal_membership_active_tenure_idx").on(table.userId).where(sql\`status IN ('admission_pending', 'application_pending', 'processing', 'active')\`) })`. Run `npm run db:generate` to confirm Drizzle picks up the index. If Drizzle's version doesn't support `WHERE` on `uniqueIndex`, document the limitation explicitly in a comment and note that future schema regenerations must preserve the index manually.

**Issue 2 — Missing FK indexes on `admission_participant.legal_membership_id` and `legal_document.legal_membership_id`.**
What is wrong: `board_resolution`, `board_vote`, and `membership_application` get implicit indexes via UNIQUE constraints on `legal_membership_id`. `admission_participant` and `legal_document` do not have indexes on their `legal_membership_id` FK. At expected admission counts (≤ 100/year) this is not urgent, but these are the columns queried in every vote-check and document-lookup.
How to fix: add `index("admission_participant_legal_membership_id_idx").on(table.legalMembershipId)` and `index("legal_document_legal_membership_id_idx").on(table.legalMembershipId)` to their respective schema definitions. Generate a migration.

**Issue 3 — CLAUDE.md ID prefix list is stale.**
What is wrong: the ID Generation section of CLAUDE.md was updated in the lifecycle branch to list `usr_`, `gr_`, `aup_`, `aug_`, `wfl_`, `aud_`. This is wrong in two ways: `wfl_` (the `workflow` prefix) was deleted from `id.ts` in the same diff; and the 7 new prefixes added by the lifecycle feature (`lm`, `brs`, `ap`, `bv`, `ma`, `ld`, `tsk`) are missing entirely.
How to fix: update the ID Generation section of CLAUDE.md to list the current `newId()` prefixes as defined in `src/lib/id.ts`. Verify the list matches by reading `id.ts` before writing.

**Test scenarios:**
- Verification: `npm run db:generate` after adding the Drizzle index definition produces no diff or a clean `CREATE INDEX` (not `CREATE UNIQUE INDEX` if it already exists)
- Verification: CLAUDE.md prefix list matches `Object.keys` of the prefix map in `src/lib/id.ts`

**Verification:**
- `legal-membership.ts` schema file registers the partial unique index via Drizzle API
- `admission_participant` and `legal_document` schema files have `index()` calls on `legalMembershipId`
- CLAUDE.md prefix list is accurate

---

### U12. Testing — Server Actions, Inngest Workflow, and Plan-Specified Missing Tests

**Goal:** Write the tests that the original plan's U3–U13 explicitly specified and that remain unwritten.

**Requirements:** R6

**Dependencies:** U2 (transactions simplify testing), U5 (permission gates are testable)

**Files:**
- Create: `src/app/(authenticated)/(app)/people/resolutions/[id]/vote-action.test.ts`
- Create: `src/app/(authenticated)/(app)/people/propose-membership-action.test.ts`
- Create: `src/app/(authenticated)/(app)/membership/application/[step]/submit-application-action.test.ts`
- Create: `src/inngest/membership-admission-workflow.test.ts`
- Create: `src/db/people-actions.test.ts`
- Modify: `src/db/membership.test.ts` (or create if absent)
- Modify: `src/lib/legal-documents/drive-archive.test.ts` (create if absent)
- Modify: `src/lib/board-resolution-rules.test.ts`

**Approach:**

Write tests at the unit level (pure logic) and integration level (DB interaction) using the patterns already established in `src/lib/board-resolution-rules.test.ts` and `src/lib/legal-membership/legal-privileges.test.ts`. Use Node's built-in test runner consistently with the rest of the codebase.

**`castVoteAction` tests (plan U7):**
- Happy path: valid participant casts a `yes` vote → `board_vote` row inserted, Inngest event sent
- Error path: resolution not found → action returns validation error
- Error path: `legal_membership.status !== 'admission_pending'` → action rejects
- Error path: actor not in `admission_participant` for this tenure → action rejects (permission gate first, then domain check)
- Error path: same voter second submission → unique constraint caught, returns "already voted" message
- Error path: `displayedResolutionHash` mismatch → action rejects

**`proposeMembershipAction` tests (plan U5):**
- Happy path: valid proposal creates one `legal_membership` (admission_pending), one `board_resolution`, three `admission_participant` rows, sends Inngest event
- Error path: board roster validation fails → no rows created, action returns setup error
- Error path: target user already has an active tenure → action rejects, no rows created
- Error path: unauthorized user (no `membership.propose` permission) → action rejects
- Regression: no `membershipPayment` row created by proposal

**`submitApplicationAction` tests (plan U9):**
- Happy path: valid submission inserts `membership_application` row and sends Inngest event
- Error path: `legal_membership.status !== 'application_pending'` → action rejects
- Error path: user submitting another person's application by manipulating route params → IDOR guard rejects
- Edge case: second submit attempt → unique constraint returns "already submitted" message

**Inngest workflow tests (plan U3):**
Use Inngest's step mocking utilities to unit-test the workflow logic without real DB or Inngest infrastructure:
- Happy path: 2 yes votes → `application_pending` transition
- Timeout path: `waitForEvent` returns `null` → `manual_followup` transition
- Procedure objection path: any `procedure_objection` vote → `manual_followup` transition
- Unresolved after 3 rounds (e.g., all abstain) → `manual_followup` transition
- Idempotency: `hasArchivedDocument` returning `true` → step skips render+upload

**`people-actions.test.ts` (plan U6 — explicitly listed):**
- Happy path: `getActionRequiredForUser` returns open admission tasks for a user in `admission_participant` who has not yet voted
- Edge case: user who has already voted → not returned in action-required list
- Edge case: user not in any `admission_participant` → empty list

**`activateMembershipPayment` guard tests (plan U10):**
- Edge case: `user.status = 'supporting_alumni'` → operational status not changed to `'member'` after payment activation
- Happy path: `user.status = 'onboarding'` → operational status changes to `'member'` after payment activation
- Error path: `user.legalMembershipState !== 'active_member'` → payment activation skipped, no status change

**`drive-archive.ts` idempotency test (plan U11):**
- Happy path: `archiveLegalDocument` for new `(legalMembershipId, documentType)` inserts one `legal_document` row
- Edge case: calling `archiveLegalDocument` again for the same pair → second call is a no-op (ON CONFLICT), no second Drive upload

**`board-resolution-rules.test.ts` addition (plan U3):**
- Edge case: `['no', 'no', 'no']` → `computeVoteOutcome` returns `'pending'` (unresolved after 3 rounds)
- Edge case: `['abstain', 'abstain', 'abstain']` → `'pending'`

**Patterns to follow:**
- `src/lib/board-resolution-rules.test.ts` for pure logic test style
- `src/lib/legal-membership/legal-privileges.test.ts` for DB-interacting test style

**Verification:**
- All plan-specified test scenarios from U3–U13 are covered
- `npm test` passes with no failures
- `src/lib/workflows/validation.test.ts` is deleted (done in U6) — no false signal from superseded tests

---

## System-Wide Impact

- **Interaction graph:** U8 (`handleServerError`) affects every server action in the codebase — verify client-side error toast logic still handles non-null `serverError` values after the fix. The existing client components read `result.serverError` already; they will now receive a string instead of `undefined`.
- **Error propagation:** After U8, server action errors propagate to the client as sanitized strings. The operational signals (full error objects) are logged server-side via `console.error`.
- **State lifecycle risks:** U2 (atomic transactions) reduces the window for `legal_membership` / `user.legalMembershipState` split-brain. U3 (outbox safety) does not fully eliminate the gap — an orphaned tenure from a failed `inngest.send()` is still possible; the runbook note in U3 covers detection.
- **API surface parity:** U5 adds `can()` to vote-action and resolution page — verify the permission evaluator's `membership.vote_resolution` case handles the officer context correctly. The test in `permissions.test.ts` already confirms this.
- **Integration coverage:** U12's `proposeMembershipAction` test verifies the full create-tenure-then-send-Inngest-event path end-to-end. The Inngest workflow test uses step mocking, not live Inngest infrastructure.
- **Unchanged invariants:** GoCardless reconciliation flow is unchanged. Supporting Alumni operational status preservation (`activateMembershipPayment` guard) is already implemented and remains intact; U12 adds the missing test coverage.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Drizzle's `uniqueIndex().where(sql...)` partial index syntax may not be supported in the installed version | Check Drizzle version before writing U11 schema code. If unsupported, keep the raw SQL migration and document the limitation explicitly in a schema comment with a warning about `db:generate`. |
| U1 email fan-out split changes step IDs from a loop index to `${userId}` — Inngest function replays will skip these new step IDs on in-flight runs | Fan-out emails are the first step of the workflow; no production runs are in progress at fix time. If runs are in-flight, the step-ID change must be deployed after all current runs complete or timeout. |
| U3 `inngest.send()` error surfacing changes the behavior of `proposeMembershipAction` and `submitApplicationAction` — callers that previously received silent success will now see an error | U8 (fixing `handleServerError`) must land alongside or before U3, otherwise the error surfaces as `undefined` serverError. Deploy U8 and U3 together. |
| U6 dropping the `workflow` table is irreversible | Since the `workflow` table was created in this branch and has never been in production, there is no production data at risk. Confirm before running the migration. |

---

## Documentation / Operational Notes

- Add to `docs/membership-lifecycle-setup.md`: a runbook query to detect orphaned tenures — `SELECT id, user_id, status, created_at FROM legal_membership WHERE inngest_run_id IS NULL AND status = 'admission_pending'`. These rows indicate a failed `inngest.send()` and require manual re-triggering of the Inngest workflow.
- After U1 (email fan-out split), the Inngest dashboard will show per-participant step IDs (`send-board-task-email-<userId>`) instead of a single aggregate step. Update operational docs if they reference step names.

---

## Sources & References

- **Origin document:** `docs/plans/2026-05-02-001-feat-membership-lifecycle-workflows-plan.md`
- **Review findings:** `/tmp/compound-engineering/ce-code-review/20260509-015028-4c7ab8f7/` (run artifacts)
- Permission convention: `docs/solutions/conventions/reusable-permission-policy-api-2026-05-02.md`
- Tone convention: `docs/solutions/conventions/reusable-tone-of-voice-and-wording-decisions-2026-05-02.md`
- Inngest v3 `if` CEL syntax: Inngest TypeScript SDK docs, `step.waitForEvent` section
- Related code: `src/inngest/membership-admission-workflow.ts`
- Related code: `src/lib/legal-documents/drive-archive.ts`
- Related code: `src/lib/action-client.ts`
- Related code: `src/db/membership.ts`
