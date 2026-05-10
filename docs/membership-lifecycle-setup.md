# Membership Lifecycle Setup Guide

This document is the operations checklist for activating the membership lifecycle
feature in production. Work through it in order before enabling the feature for
any member.

---

## Prerequisites

### 1. Authority assignments

Board members who will vote on admissions must hold the `legal_officer` position.
Verify the current legal officers in START Cockpit under People → each member's
profile → Organization Positions. Expect at least 3 legal officers (one for each
vote slot in the admission workflow).

The admission workflow sends emails to whoever has an active `admission_participant`
snapshot on the `legal_membership` row. This snapshot is created at proposal time
from the current legal officers. Update legal-officer assignments **before** proposing
new admissions.

### 2. Google Drive folder

The `GOOGLE_DRIVE_LEGAL_DOCUMENTS_FOLDER_ID` environment variable must point to a
Google Drive folder that the service account (`digital-connection-management@start-berlin.com`)
can write to.

Steps:
1. Create or identify the archival folder in Google Drive.
2. Share it with the service account email using "Editor" access.
3. Copy the folder ID from the URL (`https://drive.google.com/drive/folders/<FOLDER_ID>`).
4. Set `GOOGLE_DRIVE_LEGAL_DOCUMENTS_FOLDER_ID=<FOLDER_ID>` in Vercel environment variables.

### 3. Resend configuration

Lifecycle emails are sent from `notifications@cockpit.start-berlin.com`. Verify
this sender is verified in Resend and that the `RESEND_API_KEY` environment
variable is set.

---

## Rollout order

### Step 1: Backfill existing members

Existing Members and Supporting Alumni with verified paper documents need to be
classified before the new lifecycle is used. The rule:

- **Documents verified** → set `user.legalMembershipState = "active_member"` AND
  create an `active` `legal_membership` row for the user.
- **Documents missing** → leave `user.legalMembershipState = "not_member"` and
  use the import-missing-documents flow to start a board admission workflow.

Use the import action in People → member profile → Import Existing Member to
trigger the board admission workflow for members with missing documents.

This backfill must be complete before enabling legal-privilege checks based on
`legalMembershipState`.

### Step 2: Legal review

Have the board review the admission resolution text (`board_resolution.resolutionText`)
before any real admission. The text is set at proposal time and becomes part of
the archived PDF. A legal officer should confirm it matches the Satzung wording.

### Step 3: Test with a non-production member

Run one full admission cycle end-to-end:
1. Propose admission for a test account.
2. Have three legal officers cast votes in START Cockpit.
3. Verify the Inngest run advances through all steps in the Inngest dashboard.
4. Confirm PDFs appear in the Google Drive folder.
5. Confirm the test member's `legalMembershipState` is set to `"active_member"`.
6. Confirm all four lifecycle emails were delivered.

### Step 4: Enable for production

Once the test cycle passes, the feature is ready for real admissions. There is no
feature flag — the system is live as soon as legal officers have the correct
authority assignments and the Drive folder is configured.

---

## Legal privileges

Legal privileges (voting eligibility, election candidacy) derive exclusively from
`user.legalMembershipState = "active_member"`. The operational `user.status` field
is never sufficient on its own.

Helper: `src/lib/legal-membership/legal-privileges.ts` exports `isLegalMember()`
and `filterLegalMembers()` for use in permission checks and UI queries.

Key invariants:
- A member in `admission_pending` or `application_pending` tenure status does NOT
  have legal privileges yet. Legal privileges only begin after the `activate-legal-membership`
  Inngest step sets `legalMembershipState = "active_member"`.
- A `former_member` loses legal privileges even if `user.status` is still `"member"`.
- Supporting Alumni (`user.status = "supporting_alumni"`) with `legalMembershipState = "active_member"`
  have full legal privileges.

---

## Monitoring

- The Inngest run ID is stored on `legal_membership.inngestRunId`. Use it to look up
  the live admission workflow in the Inngest dashboard.
- If a workflow stalls (e.g., a vote times out), the status advances to `manual_followup`.
  Search for these rows: `SELECT * FROM legal_membership WHERE status = 'manual_followup'`.
- Archived PDFs are stored in the `legal_document` table with their Google Drive URL
  and SHA-256 hash. Query to verify: `SELECT * FROM legal_document WHERE legal_membership_id = '<id>'`.
