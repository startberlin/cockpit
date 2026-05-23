---
title: "refactor: Database cleanup — drop dead tables, merge board data, simplify PKs"
type: refactor
status: active
date: 2026-05-19
origin: docs/brainstorms/db-cleanup-requirements.md
---

# refactor: Database cleanup — drop dead tables, merge board data, simplify PKs

## Summary

Removes six tables that are either dead code or hold only transient workflow data, consolidates board admission data into `legal_membership` as nullable JSON fields, rewrites document archival to be DB-free, adds a TTL sweep for GoCardless processed events, and replaces surrogate IDs with natural/composite primary keys on three tables. The result is a schema where every table has a clear permanent purpose and no data is stored longer than needed.

---

## Problem Frame

The database has grown table-by-table without a coherence pass. Two tables (`audit_log`, `task`) are fully dead — defined in schema, never queried. Four tables (`board_resolution`, `admission_participant`, `board_vote`, `legal_document`) hold workflow-phase data that becomes redundant once PDFs land in Google Drive. Three tables carry surrogate IDs that are never referenced externally and add noise without benefit. See origin document for full analysis.

---

## Requirements

- R1. Remove `audit_log` and `task` tables, their schema files, relations, and ID prefixes — zero usage anywhere.
- R2. Remove `board_resolution`, `admission_participant`, `board_vote` tables; merge their data as nullable `jsonb`/`text` fields on `legal_membership`.
- R3. Remove `legal_document` table; rewrite `archiveLegalDocument` to use Drive API file search for idempotency and thread Drive file IDs through Inngest step return values.
- R4. Add a 30-day TTL cleanup job for `gocardless_processed_events`.
- R5. Change `email_suppression` PK to `email`; remove surrogate `id` column.
- R6. Change `user_access_grant` and `user_organization_position` PKs to composite; add `'none'` enum value to `department` to replace `NULL`, make column NOT NULL.

---

## Scope Boundaries

- `user.department` nullability is unchanged — it is not part of any PK and has different semantics from the authority table columns.
- `board-resolution-rules.ts` is pure logic with no DB access — kept as-is, continues to work on typed values passed from the JSON fields.
- `membership_payments`, Better Auth tables (`session`, `account`, `verification`), and all other permanently stable tables are untouched.
- The `/people/resolutions/[id]` route stays; only the `id` param changes from `boardResolution.id` to `legalMembershipId`.

### Deferred to Follow-Up Work

- Merging `board_resolution` into `legal_membership` as separate columns rather than JSON was discussed and deferred — JSON fields keep the migration self-contained.

---

## Context & Research

### Relevant Code and Patterns

- `src/db/schema/legal-membership.ts` — target for new board data fields
- `src/db/schema/board-admission.ts` — defines all three board tables being dropped, plus `boardVoteValue` enum and `officerFunction` enum
- `src/db/schema/authority.ts` — defines `userAccessGrant` and `userOrganizationPosition`; contains the check constraints and `nullsNotDistinct()` unique constraints to update
- `src/db/schema/auth.ts` — defines the shared `department` pgEnum; `'none'` is added here
- `src/db/admission.ts` — `createAdmissionWorkflow()`, called only from `propose-membership-action.ts`; deleted in U8
- `src/db/board-resolutions.ts` — `getResolutionDetail()` and `ResolutionDetail` type; replaced in U4
- `src/db/people-actions.ts` — `getPendingBoardActionsForUser()` joins board tables; updated in U4
- `src/lib/legal-documents/drive-archive.ts` — `archiveLegalDocument`, `hasArchivedDocument`, `downloadArchivedDocument`; rewritten in U6
- `src/lib/inngest.ts` — `boardVoteCast` event type imports `BoardVoteValue` from board-admission schema; updated in U5
- `src/lib/authority/assignments.ts` — Zod schemas with `department: z.null().optional()` transforms; updated in U11
- `src/lib/permissions/evaluate.ts` — department-scoped permission check compares `assignment.department`; updated in U11
- `scripts/bootstrap-admin.ts` — raw SQL with `ON CONFLICT (user_id, "grant", scope, department)` targeting the unique constraint; updated in U11
- `src/app/api/webhooks/ses/route.ts` — inserts `emailSuppression` with `newId("emailSuppression")` and `onConflictDoUpdate({ target: emailSuppression.email })`; `id` insert removed in U10
- `src/inngest/index.ts` — Inngest function registry; TTL cron added in U9
- Pattern for Inngest cron: see `syncGroupsCron` or `membershipPaymentProposalsCron` in `src/inngest/`
- Pattern for data backfill scripts: see `scripts/bootstrap-admin.ts` for raw-SQL style

### Institutional Learnings

- The `activate-legal-membership` step's three writes (`legalMembership.status`, `user.legalMembershipState`, `user.status`) must remain inside a single `db.transaction()` — not split across step boundaries. This plan does not touch that step.
- Any column added to `user` that needs to be visible in the session must also be declared in `src/db/schema/auth-fields.ts`. The four new fields are on `legal_membership`, not `user`, so this does not apply.
- `db/*` modules must not be imported (even transitively) by `"use client"` components — the `net`/`tls` error surfaces at the `pg` level, not the import site. The new `legal_membership` query helper in U4 stays in a `server-only` file.
- CLAUDE.md migration rule: edit schema → `npm run db:generate` → `npm run db:migrate`. Never touch generated files in `src/db/migrations/` by hand.
- The `LIVE_TENURE_STATUSES` partial unique index on `legal_membership` must remain intact. None of the new columns affect the status enum or that index.

---

## Key Technical Decisions

- **Board data as JSON on `legal_membership`**: `boardParticipants` and `boardVotes` are `jsonb` arrays; `boardResolutionText`/`boardResolutionHash` are `text`. All nullable — reconfirmation memberships leave them null. This keeps all board admission logic in one row without new join complexity.
- **Resolution route param**: `/people/resolutions/${legalMembershipId}` replaces `/people/resolutions/${boardResolution.id}`. The `legalMembershipId` is already known at the point where the URL is constructed in the workflow, and by the vote-action. No new ID concept needed.
- **Duplicate-vote enforcement via JSON conditional update**: The current unique constraint on `board_vote (legalMembershipId, voterUserId)` is replaced by a `WHERE NOT board_votes @> jsonb_build_array(jsonb_build_object('voterUserId', $id))` guard in the UPDATE statement — atomic and idempotent without a separate uniqueness index.
- **Drive idempotency via filename search**: `archiveLegalDocument` will search the member's Drive folder for an existing file with the given name before uploading. Accepts the edge case of a rare duplicate file on concurrent retry; the cost of this vs. a DB table is acceptable.
- **Step return value threading**: Each archiving `step.run` returns its Drive file ID. Inngest caches step return values, so subsequent steps reference the cached result. This is safe under replay. (Goes against the general "re-read from DB" institutional advice, which is moot when the table is dropped.)
- **`'none'` as sentinel**: Added to the existing `department` pgEnum rather than changing the column type to `text`. Preserves type safety for the remaining valid values.
- **`BoardVoteValue` type relocation**: Moved from `src/db/schema/board-admission.ts` (deleted) to `src/lib/inngest.ts` where `boardVoteCast` event is defined. `board-resolution-rules.ts` imports it from there.
- **Single-deployment strategy**: All code changes (U1–U7, U9–U11) and DROP TABLE migrations (U8) ship together. There is no existing board admission or legal document data to preserve and no in-flight admission workflows; the new nullable JSON columns on `legal_membership` start empty for all rows.

---

## Open Questions

### Resolved During Planning

- **Where does `BoardVoteValue` live after `board-admission.ts` is deleted?** → Inline in `src/lib/inngest.ts` as a plain TypeScript union type `"yes" | "no"`.
- **Is the reconfirmation workflow affected by the `legal_document` removal?** → Yes — `membership-reconfirmation-workflow.ts` queries `legalDocument` in its email step. Covered in U7.
- **Does the `email_suppression` `onConflictDoUpdate` target survive the PK change?** → Yes — Drizzle's conflict target `{ target: emailSuppression.email }` resolves to the column, which is the PK after the change.
- **Are there any currently in-flight admission workflows?** → No. All prior admission flows are complete; no board admission data exists in the database. The new JSON columns start null for all rows and no backfill is needed.

### Deferred to Implementation

- Exact SQL for the `boardVotes` JSON conditional update in the vote action — implementer should validate the `@>` containment operator behavior against the actual JSON shape.
- Whether to add an index on `legal_membership.boardParticipants` for the `admissionParticipations` relation (currently backed by the `admission_participant` table) — low priority, small data volume.

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

**Data model after cleanup (board admission path):**

```
legal_membership
  id, userId, status, inngestRunId, ...
  boardResolutionText  text        -- null for reconfirmations
  boardResolutionHash  text        -- null for reconfirmations
  boardParticipants    jsonb       -- [{userId, officerFunction}]
  boardVotes           jsonb       -- [{voterUserId, value, castAt, displayedResolutionHash}]

membership_application  (unchanged, permanent record)
  id, legalMembershipId, subjectUserId, status
  personalEmail, phone, street, city, ...
  declarations, feeTextVersion, applicationVersion, submittedAt
```

**Drive archival flow (DB-free):**

```
archiveLegalDocument(legalMembershipId, documentType, buffer, fileName, ...)
  1. search Drive folder for existing file named `fileName`
  2. if found → return { driveFileId: existing.id }
  3. upload buffer → return { driveFileId: new.id }

// In workflow:
const { driveFileId } = await step.run("archive-board-resolution", () =>
  archiveLegalDocument(...)   // returns driveFileId
)
// driveFileId is Inngest-cached; later steps reference it directly
await step.run("send-board-completion-email", () =>
  sendEmailWithAttachment(driveFileId)
)
```

---

## Implementation Units

### U1. Remove `audit_log` and `task` dead tables

**Goal:** Delete the two tables that are defined in schema but never written to or queried.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Delete: `src/db/schema/audit-log.ts`
- Delete: `src/db/schema/task.ts`
- Modify: `src/db/schema/index.ts` — remove all imports, exports, and relations for `auditLog`, `task`, `taskStatus`, `taskRelations`, `auditLogRelations`; remove `auditLog`/`task` entries from the `schema` object; remove `actorAuditLogs`/`targetAuditLogs` from `usersRelations`; remove `tasks` from `legalMembershipRelations` and `usersRelations`
- Modify: `src/lib/id.ts` — remove `auditLog: "aud"` and `task: "tsk"` entries
- Generate: `npm run db:generate` → produces migration with `DROP TABLE audit_log, DROP TABLE task`

**Approach:**
- Both tables are empty (never written to) — no data loss.
- Remove the two files, clean up `index.ts` and `id.ts`, generate migration.
- The `tsk_` and `aud_` prefixes will no longer appear in `newId()`.

**Test scenarios:**
- Test expectation: none — purely dead code removal with no behavioral change.

**Verification:**
- `npm run lint` passes with no import errors.
- `npm run db:migrate` applies cleanly.
- No other file references `auditLog` or `task` schema symbols (grep confirms zero hits outside the deleted files).

---

### U2. Add board admission data fields to `legal_membership`

**Goal:** Add four nullable fields to `legal_membership` that will hold the board resolution text, hash, participants list, and votes list — currently spread across three separate tables.

**Requirements:** R2

**Dependencies:** None (can run in parallel with U1)

**Files:**
- Modify: `src/db/schema/legal-membership.ts` — add `boardResolutionText text nullable`, `boardResolutionHash text nullable`, `boardParticipants jsonb nullable`, `boardVotes jsonb nullable`; define and export `BoardParticipant` and `BoardVote` TypeScript types for the JSON shapes
- Generate: `npm run db:generate` → produces migration with four `ALTER TABLE legal_membership ADD COLUMN` statements

**Approach:**
- `BoardParticipant`: `{ userId: string; officerFunction: "president" | "vice_president" | "head_of_finance" }`
- `BoardVote`: `{ voterUserId: string; value: "yes" | "no"; castAt: string; displayedResolutionHash: string }`
- All four columns nullable. Existing rows receive `NULL` — correct, since they represent memberships before this schema revision.
- Use Drizzle's `.$type<BoardParticipant[]>()` and `.$type<BoardVote[]>()` on the jsonb columns.

**Test scenarios:**
- Test expectation: none — additive schema change with no behavioral change yet.

**Verification:**
- Migration applies cleanly against the running database.
- `legal_membership` rows created after this migration have the four new columns available (null by default).

---

### U4. Update resolution reads — page, query helper, people table

**Goal:** Reroute the resolution voting page and all related reads to use `legalMembershipId` as the route param and to query board data from `legal_membership` JSON fields instead of the three separate tables.

**Requirements:** R2

**Dependencies:** U2

**Files:**
- Modify: `src/db/board-resolutions.ts` — rewrite `getResolutionDetail(legalMembershipId)` to query `legal_membership` (reading `boardParticipants`, `boardVotes`, `boardResolutionText/Hash`) instead of joining `boardResolution` → `admissionParticipant` → `boardVote`. Update the `ResolutionDetail` type if needed.
- Modify: `src/db/people-actions.ts` — rewrite `getPendingBoardActionsForUser()` to join `legalMembership` on `boardParticipants @> [{userId}]` (or expand as a subquery) instead of joining `admissionParticipant`; return `legalMembershipId` as the resolution identifier instead of `resolutionId`.
- Modify: `src/app/(authenticated)/(app)/people/resolutions/[id]/page.tsx` — the `id` param is now a `legalMembershipId`; pass it to the updated `getResolutionDetail`.
- Modify: `src/app/(authenticated)/(app)/people/resolutions/[id]/resolution-vote-client.tsx` — update any reference to `resolutionId` in the `ResolutionDetail` type.
- Modify: `src/components/people-table.tsx` — update the href to use `legalMembershipId` instead of `pendingAction.resolutionId`.

**Approach:**
- `getResolutionDetail` now takes a `legalMembershipId` instead of a `boardResolutionId`.
- The query reads `legal_membership` for the four board fields and joins `user` once for the subject.
- Participants and votes are parsed directly from the JSON columns using the `BoardParticipant[]` / `BoardVote[]` types defined in U2.
- `getPendingBoardActionsForUser` uses a Postgres JSON containment check (`boardParticipants @> '[{"userId":"..."}]'`) to find memberships where the user is a participant with a pending status. Return `legalMembershipId` as the route identifier.
- The resolution page auth gate (participant check) moves from a DB join to checking `resolution.participants.some(p => p.userId === currentUser.id)` on the parsed JSON — same logic, different data source.
- `src/db/board-resolutions.ts` is kept as a file but fully rewritten. It can be renamed to `src/db/resolution.ts` if cleaner.

**Patterns to follow:**
- `src/db/people.ts` for the pattern of building a query against `legalMembership` with user joins.

**Test scenarios:**
- Happy path: visiting `/people/resolutions/${legalMembershipId}` renders the correct resolution text, participants, and vote status for an in-progress admission.
- Happy path: `getPendingBoardActionsForUser` returns the correct `legalMembershipId` for a user who is a participant with a pending vote.
- Edge case: visiting the page with a `legalMembershipId` that has no board data (reconfirmation) returns 404.
- Edge case: visiting the page as a non-participant returns 404 (auth gate preserved).
- Edge case: `getPendingBoardActionsForUser` returns empty when the user has no pending admissions.

**Verification:**
- The resolution voting page loads and displays correctly for an admission currently in `admission_pending` status.
- The people table shows the correct voting link for board members with pending actions.

---

### U5. Update board admission writes — propose-membership-action and vote-action

**Goal:** Write board admission data directly to `legal_membership` JSON fields at proposal time and when votes are cast, instead of inserting into the three separate tables.

**Requirements:** R2

**Dependencies:** U2

**Files:**
- Modify: `src/app/(authenticated)/(app)/people/propose-membership-action.ts` — replace the call to `createAdmissionWorkflow(tx, ...)` with inline writes to `legalMembership.boardResolutionText`, `boardResolutionHash`, and `boardParticipants` inside the existing transaction.
- Modify: `src/app/(authenticated)/(app)/people/resolutions/[id]/vote-action.ts` — replace `boardVote` insert with a conditional JSON array append on `legalMembership.boardVotes`; validate user is a participant by checking `boardParticipants`; validate board resolution hash by reading `boardResolutionHash`.
- Modify: `src/lib/inngest.ts` — inline `BoardVoteValue` as `"yes" | "no"` union type, removing the import from `src/db/schema/board-admission.ts`.

**Approach:**
- **Proposal**: The resolution text and hash are computed exactly as in `createAdmissionWorkflow` (SHA-256 of the German resolution text). The write goes to `legal_membership` as part of the same transaction that creates the `legal_membership` row.
- **Vote**: The vote action performs an `UPDATE legal_membership SET boardVotes = boardVotes || $newVote::jsonb WHERE id = $legalMembershipId AND status = 'admission_pending' AND NOT (COALESCE(boardVotes, '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('voterUserId', $userId)))`. This atomically guards against duplicate votes without a unique constraint.
- The participant validation (user must be in `boardParticipants`) replaces the `admissionParticipant` table join in vote-action; read the `boardParticipants` JSON field from `legalMembership` and check membership in application code.
- The `boardVoteCast` Inngest event is still sent after a successful vote — unchanged.
- `src/db/admission.ts` is no longer needed after this unit; it can be deleted here or in U8.

**Patterns to follow:**
- Existing transaction pattern in `propose-membership-action.ts`.
- Drizzle's `sql` template tag for the conditional JSON append if Drizzle's typed API cannot express it.

**Test scenarios:**
- Happy path: proposing a membership creates a `legal_membership` row with non-null `boardResolutionText`, `boardResolutionHash`, and `boardParticipants` with 3 entries (president, vice_president, head_of_finance).
- Happy path: casting a "yes" vote appends a `BoardVote` entry to `boardVotes` and fires the `boardVoteCast` event.
- Edge case: casting a duplicate vote (same voter, same membership) is a no-op — the update matches zero rows; return an appropriate error/message.
- Edge case: casting a vote when `status` is not `admission_pending` fails gracefully.
- Error path: proposing a membership without a valid board roster (missing president/VP/HoF) is rejected before the write (existing board-roster validation in `board-roster.ts` still runs).

**Verification:**
- Proposing a membership produces the correct JSON fields on `legal_membership`.
- Voting produces the correct `boardVotes` entry on the corresponding `legal_membership` row.
- The `boardVoteCast` Inngest event is received by the workflow after a vote.

---

### U6. Rewrite `archiveLegalDocument` to be DB-free

**Goal:** Remove all database dependency from the document archival helper. Idempotency moves to a Drive filename search; Drive file IDs are returned by the function rather than stored in a DB row.

**Requirements:** R3

**Dependencies:** None (library change, consumers updated in U7)

**Files:**
- Modify: `src/lib/legal-documents/drive-archive.ts` — rewrite `archiveLegalDocument` to (1) search the member's Drive folder for an existing file with the target filename, (2) if found return its ID, (3) otherwise upload and return the new file ID. Remove all `legalDocument` table reads and writes. Remove `hasArchivedDocument` (no longer needed — callers use the Drive search implicitly). Keep `downloadArchivedDocument` unchanged (Drive-only, no DB dependency today).

**Approach:**
- The Drive API `files.list` with a `name = '...' and '...' in parents and trashed = false` query already supports exact filename lookup. `getOrCreateUserFolder` already performs this pattern for folders.
- The function signature changes from returning `{ driveFileId, driveUrl, sha256 }` to `{ driveFileId: string }` — callers only ever used `driveFileId` for subsequent downloads.
- Remove the `renderer` concept — it was only stored in the DB row and never used in queries.
- Remove the `sha256` from the return — computed but unused after the DB row is gone. Keep the hash computation internally if needed for other purposes; otherwise drop it.
- `hasArchivedDocument` is deleted — its only caller was within `drive-archive.ts` itself.

**Patterns to follow:**
- `getOrCreateUserFolder` in the same file for the Drive search-before-create pattern.

**Test scenarios:**
- Happy path: calling `archiveLegalDocument` for a file not yet in Drive uploads the file and returns a `driveFileId`.
- Happy path (idempotency): calling `archiveLegalDocument` for a file already present in Drive by name returns the existing file ID without re-uploading.
- Error path: Drive API `files.list` failure propagates as an error (no silent retry or fallback).
- Error path: Drive upload failure propagates as an error.

**Verification:**
- The function returns a Drive file ID in both the upload and the pre-existing cases.
- No imports from `src/db/` remain in `drive-archive.ts`.

---

### U7. Restructure admission and reconfirmation workflows

**Goal:** Update both Inngest workflows to read board data from `legal_membership` JSON fields instead of the dropped tables, and to pass Drive file IDs through step return values instead of DB lookups.

**Requirements:** R2, R3

**Dependencies:** U2, U5, U6

**Files:**
- Modify: `src/inngest/membership-admission-workflow.ts` — major refactor:
  - `load-board-task-data`: read `boardParticipants` from `legalMembership` instead of querying `admissionParticipant`; build resolution URL using `legalMembershipId` instead of `boardResolution.id`.
  - `evaluate-votes-round-N`: read `boardVotes` from `legalMembership` instead of querying `boardVote`.
  - `archive-board-resolution`: read `boardResolutionText/Hash` and `boardParticipants`/`boardVotes` from `legalMembership`; call updated `archiveLegalDocument`; **return the `driveFileId`**.
  - `archive-membership-application`: call updated `archiveLegalDocument`; **return the `driveFileId`**.
  - `send-application-submitted-email`: receive `driveFileId` from the cached return value of `archive-membership-application` rather than querying `legalDocument`.
  - `archive-admission-confirmation`: read `boardParticipants` from `legalMembership`; call updated `archiveLegalDocument`; **return the `driveFileId`**.
  - `send-admission-confirmed-email`: receive `driveFileId` from cached return of `archive-admission-confirmation`.
  - `load-board-completion-data`: receive `driveFileId` for the board resolution from cached return of `archive-board-resolution` rather than querying `legalDocument`.
  - Remove all imports from `src/db/schema/board-admission.ts` and `src/db/schema/legal-document.ts`.
- Modify: `src/inngest/membership-reconfirmation-workflow.ts`:
  - `archive-membership-application`: call updated `archiveLegalDocument`; return `driveFileId`.
  - `archive-admission-confirmation`: same.
  - `send-confirmation-email`: receive both file IDs from cached step return values instead of querying `legalDocument`.
  - Remove import from `src/db/schema/legal-document.ts`.

**Approach:**
- Inngest caches each `step.run` return value. A step that already completed in a prior execution returns the cached value instantly on replay — threading `driveFileId` across steps is therefore safe and idempotent.
- The institutional concern about "re-reading from DB over threading return values" is moot here: the DB table is being dropped. The Drive filename search (U6) provides the idempotency guarantee within a single step retry.
- Steps that previously computed `subjectName` from the DB can continue to derive it from the `subject` cached result of the first step — no change needed there.

**Patterns to follow:**
- Existing multi-step chaining in `membership-admission-workflow.ts` — the `subject` variable from step 1 is already threaded through all subsequent steps.

**Test scenarios:**
- Integration: proposing a membership, casting three "yes" votes, and letting the workflow run to completion produces the correct PDF files in Drive and sends the correct emails with attachments.
- Integration: a workflow that times out waiting for votes (mocked `step.waitForEvent` returns null) sets `status = 'manual_followup'` and terminates cleanly without errors.
- Edge case: a step that uploads a file to Drive but crashes before returning is retried; the retry finds the file already in Drive (via the U6 filename search) and returns the existing file ID without re-uploading.
- Edge case: the reconfirmation workflow completes for a user with `importedPaidThroughAt` set — the `create-proposed-payment` step anchors to the renewal date (existing logic, verify it still works after refactor).

**Verification:**
- Both workflows execute end-to-end in the Inngest dev server without errors.
- No imports from `board-admission.ts` or `legal-document.ts` remain in either workflow file.

---

### U8. Drop board admission tables and `legal_document` — schema and migration

**Goal:** Remove the six schema files, clean up all exports and relations, and generate the DROP TABLE migrations.

**Requirements:** R1, R2, R3

**Dependencies:** U4, U5, U7

**Files:**
- Delete: `src/db/schema/board-admission.ts`
- Delete: `src/db/schema/legal-document.ts`
- Delete: `src/db/admission.ts`
- Modify: `src/db/board-resolutions.ts` — already rewritten in U4; can be renamed to `src/db/resolution.ts` if cleaner
- Modify: `src/db/schema/index.ts` — remove all imports, exports, and relations for `boardResolution`, `admissionParticipant`, `boardVote`, `officerFunction`, `boardVoteValue`, `legalDocument`; remove `boardResolution`, `admissionParticipants`, `boardVotes` from `legalMembershipRelations`; remove `admissionParticipations`, `boardVotes` from `usersRelations`
- Modify: `src/lib/id.ts` — remove prefixes: `boardResolution: "brs"`, `admissionParticipant: "ap"`, `boardVote: "bv"`, `legalDocument: "ld"`
- Generate: `npm run db:generate` → produces migration with `DROP TABLE board_resolution, DROP TABLE admission_participant, DROP TABLE board_vote, DROP TABLE legal_document`

**Approach:**
- Ships in the same deployment as U4, U5, and U7 — no staging gate needed. There is no existing board admission or legal document data and no in-flight workflows that reference these tables.
- After the migration applies, the old tables are permanently gone. No data is lost.

**Test scenarios:**
- Test expectation: none beyond migration correctness — behavioral changes landed in U4/U5/U7.

**Verification:**
- `npm run db:migrate` applies the DROP TABLE statements cleanly.
- `npm run lint` and TypeScript compilation pass with no references to the deleted symbols.
- grep for `boardResolution`, `admissionParticipant`, `boardVote`, `legalDocument` across `src/` returns zero hits (excluding this plan and the requirements doc).

---

### U9. Add TTL cleanup for `gocardless_processed_events`

**Goal:** Prevent the idempotency log from growing unboundedly by deleting records older than 30 days on a daily schedule.

**Requirements:** R4

**Dependencies:** None

**Files:**
- Create: `src/inngest/gocardless-events-cleanup.ts` — Inngest cron function that deletes `gocardless_processed_events` rows where `processedAt < now() - interval '30 days'`
- Modify: `src/inngest/index.ts` — add the new cron function to `inngestFunctions`

**Approach:**
- Use Inngest's `cron` trigger (daily schedule, e.g. `"0 3 * * *"`).
- A single `step.run` wrapping a Drizzle `delete().where(lt(gocardlessProcessedEvents.processedAt, thirtyDaysAgo))`.
- No batching needed — the table is small and the delete is a direct indexed scan on `processedAt`. Add an index on `processedAt` if one doesn't exist (check the current schema).
- Log the count of deleted rows.

**Patterns to follow:**
- `src/inngest/membership-payment-proposals-cron.ts` or `src/inngest/sync-groups-cron.ts` for the cron function pattern and registration.

**Test scenarios:**
- Happy path: records older than 30 days are deleted; records within the 30-day window are retained.
- Edge case: table is empty — no error, zero rows deleted.
- Edge case: all records are within 30 days — no rows deleted.

**Verification:**
- The cron function appears in the Inngest dev server's function list.
- A manual trigger deletes the correct rows (verifiable against a test with a known old record).

---

### U10. Change `email_suppression` primary key to `email`

**Goal:** Remove the surrogate `id` column from `email_suppression` and use `email` as the primary key.

**Requirements:** R5

**Dependencies:** None

**Files:**
- Modify: `src/db/schema/email-suppression.ts` — remove `id` column; change `email` from `notNull().unique()` to `primaryKey()`
- Modify: `src/lib/id.ts` — remove `emailSuppression` prefix entry (if present)
- Modify: `src/app/api/webhooks/ses/route.ts` — remove `id: newId("emailSuppression")` from both insert value objects
- Generate: `npm run db:generate` → produces migration: `ALTER TABLE email_suppression DROP COLUMN id`, adjust PK

**Approach:**
- The SES webhook's `onConflictDoUpdate({ target: emailSuppression.email, ... })` conflict clause already targets the `email` column — after the PK change this resolves to the PK itself and continues to work without modification.
- `src/lib/email.ts` queries `emailSuppression.findMany` without selecting `id` — no change needed.
- The `emailSuppression` prefix in `id.ts` may not exist (the schema currently has a generated `id` but it may use `newId("emailSuppression")` in the webhook). Confirmed: `src/app/api/webhooks/ses/route.ts` uses `newId("emailSuppression")` — the prefix is `"es"` or similar; remove it from `id.ts`.

**Test scenarios:**
- Happy path: a bounce webhook inserts a new suppression record using only `email`, `reason`, `detail`, `suppressedAt`.
- Happy path (idempotency): a duplicate bounce for the same email triggers the `onConflictDoUpdate` and updates `reason`/`detail`.
- Happy path: `lib/email.ts` suppression check still correctly identifies suppressed emails.

**Verification:**
- The SES webhook endpoint processes a bounce event without inserting an `id` field.
- TypeScript compilation passes with no `id` column references on `emailSuppression`.

---

### U11. Change `user_access_grant` and `user_organization_position` to composite PKs

**Goal:** Add `'none'` to the `department` enum, make `department` NOT NULL with a `'none'` default, drop the surrogate `id` columns, and set composite primary keys on both authority tables.

**Requirements:** R6

**Dependencies:** None

**Files:**
- Modify: `src/db/schema/auth.ts` — add `'none'` to the `department` pgEnum values array
- Modify: `src/db/schema/authority.ts`:
  - `userOrganizationPosition`: remove `id` column; make `department` NOT NULL with default `'none'`; set composite PK on `(userId, position, scope, department)`; replace `nullsNotDistinct()` unique with a regular unique (now unnecessary — PK enforces it); update check constraints from `department IS NULL` / `IS NOT NULL` to `department = 'none'` / `department != 'none'`
  - `userAccessGrant`: same pattern — remove `id`, make `department` NOT NULL default `'none'`, composite PK, update check constraint
- Modify: `src/lib/id.ts` — remove `userOrganizationPosition` and `userAccessGrant` prefix entries
- Modify: `src/db/authority.ts` — change all `department === null` checks to `department === 'none'`; change all `department: null` assignments to `department: 'none'`
- Modify: `src/lib/authority/assignments.ts` — update Zod schemas: `department: z.null().optional()` → `z.literal('none').optional()` for global positions and grants; update transform at line 81 from `null` to `'none'`; update line 85 from `null` to `'none'`
- Modify: `src/lib/authority/model.ts` — update `PositionAssignment` and `GrantAssignment` types: `department?: null` → `department?: 'none'`
- Modify: `src/lib/permissions/evaluate.ts` — update department comparison logic (line 138); `assignment.department` is now `'none'` for global, non-`'none'` for department scope
- Modify: `scripts/bootstrap-admin.ts` — update raw SQL: change `NULL` to `'none'` in the INSERT values; update the `ON CONFLICT` target if the named unique constraint changes (check whether the composite PK replaces it entirely)
- Modify: `src/app/(authenticated)/(app)/people/directory/[id]/update-authority-action.ts` — change `department: null` to `department: 'none'` in grant construction
- Generate: `npm run db:generate` → produces migration: add `'none'` to the enum; `UPDATE` existing rows to set `department = 'none'` where `department IS NULL`; `ALTER TABLE` to NOT NULL; drop `id` columns; drop old unique constraints; add composite PKs

**Approach:**
- The migration must first add the enum value (`ALTER TYPE department ADD VALUE 'none'`), then update existing rows, then set NOT NULL. Drizzle should generate this correctly but verify the migration output before applying.
- After the PK change, the named unique constraints (`user_grant_scope_department_unique`, `user_position_scope_department_unique`) become redundant (PK enforces uniqueness) — they can be dropped.
- `bootstrap-admin.ts` conflict target changes from the named unique constraint to the PK columns: `ON CONFLICT (user_id, "grant", scope, department) DO NOTHING` — this syntax targets the PK and should work unchanged if Postgres resolves it by column list, but verify against the actual constraint name after migration.
- `user.department` (the user's own department membership) is nullable and unchanged — adding `'none'` to the enum is backward-compatible for that column.

**Test scenarios:**
- Happy path: assigning a global position (president) to a user writes `department = 'none'` to `userOrganizationPosition`.
- Happy path: assigning a department head position writes the actual department name to `userOrganizationPosition`.
- Happy path: permission evaluation for a global grant returns true for any department context.
- Happy path: permission evaluation for a department-scoped position returns true only when the target user's department matches.
- Edge case: attempting to assign two presidents fails with a unique violation on the composite PK.
- Error path: attempting to assign a `department_head` with `department = 'none'` fails the check constraint.
- Integration: the authority update action (`update-authority-action.ts`) writes and reads back the correct composite PK rows.

**Verification:**
- `npm run db:migrate` applies: enum value added, existing rows updated, NOT NULL enforced, old `id` columns dropped, composite PKs created.
- `src/db/authority.ts` has zero `department === null` or `department: null` references.
- `scripts/bootstrap-admin.ts` runs successfully against the migrated schema.
- Authority assignment tests pass.

---

## System-Wide Impact

- **Interaction graph:** The `boardVoteCast` Inngest event is still fired from `vote-action.ts` and consumed by the admission workflow — the event shape is unchanged. The `inngest.ts` event type definition loses the `board-admission` import; `BoardVoteValue` is inlined there.
- **Error propagation:** Vote-action duplicate guards move from Postgres `23505` error catching to a zero-rows-updated check on the conditional JSON update.
- **State lifecycle risks:** U8's DROP TABLE migration ships with U7 in a single deployment. There is no existing board admission or legal document data, so no data loss occurs and no in-flight workflows are at risk.
- **API surface parity:** The resolution voting page URL changes from `brs_xxx` to `lm_xxx`. Any external link (e.g., in a Slack message or email already sent) pointing to the old URL format will 404 after U4 deploys. This is acceptable — those links are only sent during an active admission window and are short-lived.
- **Integration coverage:** Both Inngest workflows must be run end-to-end in the dev environment after U7 before deploying to production.
- **Unchanged invariants:** `membership_application` creation, form step actions, and submission flow are completely unchanged. The `activate-legal-membership` transaction in the admission workflow is unchanged. GoCardless payment reconciliation is unchanged.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `ALTER TYPE department ADD VALUE 'none'` requires a full table scan in Postgres and cannot run in a transaction | In Postgres 12+, `ADD VALUE` to an enum is instant and transactional if no catalog cache entry exists. If it fails inside the Drizzle migration transaction, run it manually outside a transaction first |
| `bootstrap-admin.ts` conflict target breaks after PK change | Verify and update the script in U11 before running it post-migration |
| Resolution URLs in already-sent emails point to old `brs_xxx` param | Acceptable — those emails are only sent during active admission windows and board members will be notified of the URL change |
| Drizzle generates incorrect migration for composite PK + NOT NULL + enum change combination | Review generated migration before applying; run against a local DB copy first |

---

## Sources & References

- **Origin document:** [docs/brainstorms/db-cleanup-requirements.md](docs/brainstorms/db-cleanup-requirements.md)
- Related code: `src/db/schema/board-admission.ts`, `src/db/schema/legal-membership.ts`, `src/lib/legal-documents/drive-archive.ts`, `src/inngest/membership-admission-workflow.ts`
- Institutional learnings: `docs/solutions/architecture-patterns/member-lifecycle-entry-points-and-application-flow-2026-05-10.md`, `docs/solutions/architecture-patterns/membership-journey-vs-payment-journey-2026-05-12.md`
