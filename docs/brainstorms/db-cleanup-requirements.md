# Database Cleanup — Requirements

**Date:** 2026-05-19
**Status:** Ready for planning

## Problem

The database has grown table-by-table without a pass for necessity. Several tables are dead code, several hold data indefinitely that's only needed for the duration of a workflow, and a few use surrogate IDs where a natural or composite key is the right model.

Goal: as few tables as possible, each with a clear ongoing purpose, storing only data that's still needed.

---

## Decisions

### 1. Remove dead tables

Two tables have schema definitions, ID prefixes, and Drizzle relations wired up — but zero actual query usage in the codebase:

| Table | Why remove |
|---|---|
| `audit_log` | Never written to. Only reference is the `aud_` ID prefix in `src/lib/id.ts`. |
| `task` | Never queried or inserted into. The `tsk_` prefix exists; the "BoardResolutionTaskAssigned" email is a template name, not a task record. |

Both tables and their schema files, relations, ID prefix entries, and any schema/index exports are removed entirely.

### 2. Merge board admission data into `legal_membership` and keep `membership_application` as the user's self-declaration

There are two distinct concepts here that should stay separate:

- **`legal_membership`** is the process record for the entire admission lifecycle — it owns `status`, timestamps, `inngestRunId`, and the board's decision. Board data belongs here.
- **`membership_application`** is the user's self-declaration — what they agreed to, which version of the bylaws, their personal details at submission time. This concept is shared equally between the full admission path and the reconfirmation path (which has no board process). It should contain no board data.

The three board admission tables (`board_resolution`, `admission_participant`, `board_vote`) are dropped entirely. Their data is consolidated into `legal_membership` as typed JSON fields.

#### New fields on `legal_membership`

| Field | Type | What it holds |
|---|---|---|
| `boardResolutionText` | `text` (nullable) | The resolution text the board voted on |
| `boardResolutionHash` | `text` (nullable) | SHA-256 of the resolution text |
| `boardParticipants` | `jsonb` (nullable) | Array of `{ userId, officerFunction }` |
| `boardVotes` | `jsonb` (nullable) | Array of `{ voterUserId, value, castAt, displayedResolutionHash }` |

All four fields are null for reconfirmation memberships, which have no board process. They are populated at proposal time in `propose-membership-action.ts` when the `legalMembership` row is created. Votes are appended to `boardVotes` as each vote is cast (currently handled by `vote-action.ts`).

#### `membership_application` is kept permanently with no structural changes

`membership_application` captures the user's legal agreement — declarations, bylaws version, personal details at submission time. This is a permanent record worth keeping after activation. Its creation timing is unchanged: it continues to be created lazily when the user saves their first form step.

### 3. Drop `legal_document` entirely

The `legal_document` table serves two purposes today:

1. **Idempotency within a retried Inngest step** — if the Drive upload succeeds but the step crashes before returning, a retry would upload again. The DB record prevents this.
2. **Drive file ID lookup** — later steps fetch `driveFileId` from the DB to download the PDF for email attachments.

Both are solvable without a table:

- **Idempotency**: Replace the DB check with a Drive API file search by name within the member's folder. If a file with that name already exists, return its ID. Drive already provides this.
- **Drive file ID propagation**: Each archiving `step.run` returns the Drive file ID. Inngest caches step return values, so subsequent steps access the ID from the cached result rather than a DB lookup.

The `legal_document` table and its schema file are dropped entirely. The `archiveLegalDocument` helper in `src/lib/legal-documents/drive-archive.ts` is rewritten to be DB-free.

### 3. TTL cleanup for `gocardless_processed_events`

This table is an idempotency log: it records GoCardless webhook event IDs that have already been processed. GoCardless replays events for a few days at most. The table currently grows unboundedly.

**Change:** Add a periodic cleanup job that deletes rows older than 30 days. This is long enough to safely cover any replay window while keeping the table small.

### 4. Composite primary keys where surrogates are redundant

Three tables use a surrogate `id` column where the natural/composite key is stable, not null, and already enforced via a unique constraint. The `id` is never referenced as a foreign key by other tables and is never used in application code for lookups or mutations.

#### `email_suppression`

- **Current PK:** `id` (surrogate)
- **New PK:** `email` (already NOT NULL + UNIQUE)
- No complications. Simple swap.

#### `user_access_grant`

- **Current PK:** `id` (surrogate)
- **New PK:** `(userId, grant, scope, department)`
- **Complication:** `department` is currently nullable (global-scope grants have no department). PK columns must be NOT NULL.
- **Decision:** Replace NULL with a sentinel value and make `department` NOT NULL. This eliminates the nullable column.
- **Sentinel value:** Use `'none'` as a new enum value on the existing `department` pgEnum to represent "no department" (global scope). Make `department` NOT NULL with default `'none'`. Update the check constraints, which currently test `department IS NULL` / `IS NOT NULL`, to test `department = 'none'` / `department != 'none'`.
- Existing application code deletes and re-inserts grants by `userId`, never by `id`. No FK references to `user_access_grant.id` exist in the schema.

#### `user_organization_position`

- **Current PK:** `id` (surrogate)
- **New PK:** `(userId, position, scope, department)`
- Same sentinel-value approach as `user_access_grant` above: add `'none'` to the `department` enum, make the column NOT NULL, update check constraints.
- Same application code pattern: deletes by `userId`, no FK references to the `id` column.

---

## Out of scope

- Merging `board_resolution` into `legal_membership` (they're 1:1, but that's a separate refactor)
- Changes to `membership_payments` (financial records, kept indefinitely)
- Any changes to Better Auth tables (`session`, `account`, `verification`)
- Restructuring the permanently stable tables: `user`, `batch`, `group`, `group_criteria`, `users_to_groups`, `legal_membership`

---

## Summary table

| Table | Outcome |
|---|---|
| `audit_log` | **Remove entirely** |
| `task` | **Remove entirely** |
| `board_resolution` | **Remove entirely** — data merged into `legal_membership.boardResolutionText/Hash` |
| `admission_participant` | **Remove entirely** — data merged into `legal_membership.boardParticipants` |
| `board_vote` | **Remove entirely** — data merged into `legal_membership.boardVotes` |
| `legal_document` | **Remove entirely** — idempotency via Drive API, file IDs via Inngest step results |
| `membership_application` | Keep permanently; no structural changes; creation timing unchanged |
| `legal_membership` | Keep; add nullable board data fields (`boardResolutionText`, `boardResolutionHash`, `boardParticipants`, `boardVotes`) |
| `gocardless_processed_events` | Keep; add 30-day TTL cleanup |
| `email_suppression` | Change PK to `email` |
| `user_access_grant` | Change PK to composite; `department` sentinel `'none'` |
| `user_organization_position` | Change PK to composite; `department` sentinel `'none'` |
| All other tables | No change |
