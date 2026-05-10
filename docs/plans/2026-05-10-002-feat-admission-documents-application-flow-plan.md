---
title: "feat: Admission Documents & Application Flow"
type: feat
status: active
date: 2026-05-10
origin: docs/brainstorms/2026-05-10-admission-documents-application-flow-requirements.md
---

# feat: Admission Documents & Application Flow

## Summary

Eight implementation units touching `src/db/admission.ts`, `src/lib/board-resolution-rules.ts`, the membership application route, the board resolution PDF template and Inngest workflow, and a new `public/legal/` directory for static document files. The plan introduces `pdf-lib` for merging Satzung and Finanzordnung pages into the Aufnahmeantrag, and computes SHA-256 hashes of the static files at submission time to replace the current "v1" version strings.

---

## Problem Frame

See origin document. In brief: the board resolution uses unconditional admission language; Sitzungsleiter/Protokollführer roles are never assigned or communicated; birth date is not collected; the fee acknowledgement text is underspecified; and users accept the Satzung and Finanzordnung without ever seeing them, while the generated Aufnahmeantrag PDF contains only "v1" strings rather than the actual document content.

---

## Requirements

- R1. Conditional Beschlusstext: board resolves to admit the person subject to submitting a valid application.
- R2. Sitzungsleiter/Protokollführer determined from the two yes-voters: highest officer rank = Sitzungsleiter, other = Protokollführer (President > Vice President > Head of Finance).
- R3. Board resolution PDF includes a "Verfahren" section naming Sitzungsleiter and Protokollführer after the resolution passes.
- R4. Board participants can see their assigned role on the resolution screen when the resolution has passed.
- R5. Application flow prominently identifies START Berlin e.V. membership.
- R6. Birth date collected in application flow and stored on the user record.
- R7. Birth date appears in the Aufnahmeantrag PDF alongside name and address.
- R8. Review step displays the user's full name.
- R9. Fee acknowledgement references §2 Finanzordnung, €20/semester, €40 first year, non-refundable on early exit.
- R10. Satzung displayed to user (loaded from `public/legal/`) before acceptance.
- R11. Finanzordnung displayed to user (loaded from `public/legal/`) before fee acknowledgement.
- R12. Both documents support expand/collapse interaction.
- R13. Updating a document requires only replacing the static file and deploying — no code change.
- R14. Aufnahmeantrag PDF includes Satzung as merged pages.
- R15. Aufnahmeantrag PDF includes Finanzordnung as merged pages.
- R16. A labeled divider separates the application section from the attached documents.

**Origin acceptance examples:** AE1 (R1), AE2 + AE3 (R2, R3, R4), AE4 (R10–R12), AE5 (R13), AE6 (R6, R7, R8), AE7 (R14–R16)

---

## Scope Boundaries

- Document branding and visual design — deferred to follow-up scope.
- Version history tracking in the DB for Satzung/Finanzordnung changes.
- Digital or wet signature support.
- Batch membership-admission resolutions.
- Birth date display outside the application flow and Aufnahmeantrag PDF.
- Retroactive updates to in-flight board resolutions or membership applications.

### Deferred to Follow-Up Work

- Document branding pass: separate PR once this plan ships.

---

## Context & Research

### Relevant Code and Patterns

- `src/db/admission.ts` — `createAdmissionWorkflow` generates the resolution text; `resolutionTextVersion` tracks the template version.
- `src/lib/board-resolution-rules.ts` — `computeVoteOutcome` determines whether a vote passed; `OfficerFunction` enum and `BoardVoteValue` are defined in `src/db/schema/board-admission.ts`.
- `src/db/board-resolutions.ts` — `getResolutionDetail` already returns participants with `officerFunction` and votes with `value`; no schema changes needed for U8.
- `src/lib/legal-documents/templates/board-resolution.tsx` — `BoardResolutionTemplateData` interface and `renderBoardResolutionTemplate` are the targets for R3.
- `src/lib/legal-documents/templates/membership-application.tsx` — `MembershipApplicationTemplateData`, `renderMembershipApplicationTemplate`, and `DECLARATION_LABELS` map; targets for birth date (R7) and fee text (R9).
- `src/lib/legal-documents/drive-archive.ts` — Drive upload pattern and `createServiceAccountAuth` usage; `sha256Hex` utility in `src/lib/legal-documents/document-hash.ts` is reused for file hashing.
- `src/inngest/membership-admission-workflow.ts` — `archive-board-resolution` and `archive-membership-application` steps are the targets for U7 and U9.
- `src/app/(authenticated)/(app)/membership/application/[step]/(steps)/step-address.tsx` — client component with form; `saveApplicationAddressAction` writes to the `user` table.
- `src/app/(authenticated)/(app)/membership/application/[step]/(steps)/step-review.tsx` — client component; declarations live here (the `/declarations` route is a redirect to `/review`).
- `src/app/(authenticated)/(app)/membership/application/[step]/submit-application-action.ts` — inserts `membership_application` row and writes address fields to user; `feeTextVersion: "v1"` and `applicationVersion: "v1"` are the static strings being replaced.
- `src/db/schema/auth.ts` — `user` table; address fields are nullable text columns; `birthDate` follows the same pattern.
- `src/db/schema/membership-application.ts` — `membership_application` table; `feeTextVersion` and `applicationVersion` are `text().notNull()` columns.
- `src/app/(authenticated)/(app)/people/resolutions/[id]/resolution-vote-client.tsx` — receives `ResolutionDetail` and renders the vote UI; `officerFunctionLabel` helper already exists here.
- `src/env.ts` — uses `@t3-oss/env-nextjs` with explicit `runtimeEnv` mapping; follow this pattern for any new env vars.

### Institutional Learnings

- Never manually edit migration files; always edit schema then run `npm run db:generate` → `npm run db:migrate`.
- All file paths in the plan are repo-relative; `public/` is served as static assets by Next.js at the root URL path (e.g., `public/legal/satzung.pdf` → `/legal/satzung.pdf`).

### External References

- `pdf-lib` npm package: `PDFDocument.load(bytes)` + `copyPages` + `addPage` is the standard merge pattern. No other PDF manipulation dependency exists in the project.

---

## Key Technical Decisions

- **Static files in `public/legal/` for Satzung and Finanzordnung:** eliminates the Drive API call for display, guarantees the file shown to the user and the file merged into the Aufnahmeantrag are identical within the same deployment. Updating requires replacing the file and deploying. (see origin: Key Decisions)
- **SHA-256 hash of each PDF file stored in `applicationVersion` / `feeTextVersion` at submission time:** the hash is computed by reading `public/legal/satzung.pdf` and `public/legal/finanzordnung.pdf` in the submit action using the existing `sha256Hex` utility. This replaces the static "v1" strings with a cryptographic identity of the document version the user accepted. No column rename or migration needed.
- **Sitzungsleiter/Protokollführer derived from officer function priority:** the highest-ranked yes-voter (President > VP > HoF) is Sitzungsleiter; the other yes-voter is Protokollführer. This is a pure function over the vote and participant records — no new DB columns required.
- **Resolution screen shows roles when resolution has passed:** `computeResolutionRoles` is called client-side using data already present in `ResolutionDetail`. This satisfies R4 without waiting for the PDF to be generated.
- **`birthDate` nullable on `user` table:** existing users have no birth date; the Zod schema for the application flow enforces it at submission time.
- **Divider pages added via `pdf-lib`:** a simple single-page PDF with a centered title ("Anhang 1: Satzung" / "Anhang 2: Finanzordnung") is constructed in memory and merged between the application section and each attached document.

---

## Open Questions

### Resolved During Planning

- Drive proxy vs. static files: static files chosen for guaranteed same-file identity and implementation simplicity.
- `applicationVersion`/`feeTextVersion` semantics: repurposed to store SHA-256 hashes rather than renamed, no migration needed beyond the meaning change.
- Sitzungsleiter/Protokollführer on resolution screen: yes, shown post-resolution using the same computation as the PDF.
- `birthDate` DB nullability: nullable column, Zod-enforced at application time.

### Deferred to Implementation

- Whether `pdf-lib` handles all PDF versions present in the Satzung/Finanzordnung files: verify at implementation time by loading them with `PDFDocument.load` in a quick test.
- Exact date input component to use for birth date (HTML `<input type="date">` vs. a date-picker component from the UI library).

---

## Implementation Units

### U1. Conditional Beschlusstext

**Goal:** Change the resolution text in `createAdmissionWorkflow` from unconditional admission to conditional admission, and bump the version string.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/db/admission.ts`

**Approach:**
- Replace the `resolutionText` template string with the conditional form: `Der Vorstand beschließt die Aufnahme von [Name] als ordentliches Mitglied des Vereins START Berlin e.V., sofern die betreffende Person einen entsprechenden Aufnahmeantrag stellt.`
- Change `resolutionTextVersion` from `"v1"` to `"v2"` to distinguish new resolutions from existing ones.

**Patterns to follow:**
- Existing `resolutionText` construction in `src/db/admission.ts`

**Test scenarios:**
- Happy path: `createAdmissionWorkflow` called with a subject user → the resulting `resolutionText` contains the word `sofern` (conditional language).
- Happy path: `resolutionTextVersion` is `"v2"` in the inserted `boardResolution` row.
- Covers AE1: the resolution text is not an unconditional admission declaration.

**Verification:**
- `src/db/admission.ts` contains `sofern` in the resolution text template.
- `resolutionTextVersion` is `"v2"`.

---

### U2. Birth Date — DB Schema and Migration

**Goal:** Add a nullable `birthDate` column to both the `user` table and the `membership_application` table.

**Requirements:** R6

**Dependencies:** None

**Files:**
- Modify: `src/db/schema/auth.ts`
- Modify: `src/db/schema/membership-application.ts`
- Generate: `drizzle/<next_migration>_add_birth_date.sql` (via `npm run db:generate`)

**Approach:**
- Add `birthDate: date("birth_date")` (nullable) to the `user` table in `src/db/schema/auth.ts`, following the same pattern as the existing nullable address fields (`street`, `city`, etc.).
- Add `birthDate: date("birth_date")` (nullable) to `membership_application` — nullable at DB level because the column is new and existing rows will have no value; the application flow Zod schema enforces it at submission time.
- Run `npm run db:generate` then `npm run db:migrate`.

**Patterns to follow:**
- Nullable text columns in `src/db/schema/auth.ts` (e.g., `street`, `city`)

**Test scenarios:**
- Test expectation: none — pure schema migration, behavioral enforcement is in U3.

**Verification:**
- `npm run db:generate` produces a migration adding `birth_date date` to both tables.
- `npm run db:migrate` applies without error.

---

### U3. Birth Date — Address Step, Actions, Review, and PDF Template

**Goal:** Collect birth date in the address step, persist it to the user record and the application snapshot, display it in the review step alongside full name, and render it in the Aufnahmeantrag PDF.

**Requirements:** R6, R7, R8

**Dependencies:** U2

**Files:**
- Modify: `src/app/(authenticated)/(app)/membership/application/[step]/application-validation.ts`
- Modify: `src/app/(authenticated)/(app)/membership/application/[step]/(steps)/step-address.tsx`
- Modify: `src/app/(authenticated)/(app)/membership/application/[step]/(steps)/step-address-action.ts`
- Modify: `src/app/(authenticated)/(app)/membership/application/[step]/submit-application-action.ts`
- Modify: `src/app/(authenticated)/(app)/membership/application/[step]/(steps)/step-review.tsx`
- Modify: `src/lib/legal-documents/templates/membership-application.tsx`

**Approach:**

*Validation:*
- Add `birthDate: z.string().min(1, "Please enter your date of birth.")` to `applicationAddressSchema` and to `submitApplicationSchema`.

*Address step UI (`step-address.tsx`):*
- Add a date input field for birth date below the country field. Populate its default value from `user.birthDate ?? ""`.

*Address action (`step-address-action.ts`):*
- Extend the parsed input to write `birthDate` to the `user` table alongside the address fields.

*Submit action (`submit-application-action.ts`):*
- Snapshot `birthDate` from `parsedInput.address.birthDate` into the `membership_application` insert, alongside the existing address fields.
- Also write `birthDate` to the `user` table in the same transaction (consistent with the existing address sync).

*Review step (`step-review.tsx`):*
- Add a "Your Details" section above the address section showing the user's full name (`user.firstName user.lastName`) and formatted birth date. This satisfies R8.

*PDF template (`membership-application.tsx`):*
- Add `birthDate: string` to `MembershipApplicationTemplateData`.
- Add a "Geburtsdatum" field row in the "Angaben zur Person" section of the rendered PDF.
- Update the Inngest `archive-membership-application` step (in U9) to pass `birthDate` from the application record.

**Patterns to follow:**
- Existing nullable address fields in `step-address.tsx` and `step-address-action.ts`
- Existing address snapshot in `submit-application-action.ts`

**Test scenarios:**
- Happy path: address step submits with a valid `birthDate` → user record's `birthDate` is updated.
- Error path: address step submitted without `birthDate` → Zod validation error returned.
- Happy path: submit action with `birthDate` → `membership_application` row has `birthDate` set.
- Covers AE6: after address step, review step shows full name and birth date; generated PDF includes birth date.

**Verification:**
- `applicationAddressSchema` and `submitApplicationSchema` include `birthDate`.
- `membership_application` row has a non-null `birthDate` after a complete application submission.
- `MembershipApplicationTemplateData` includes `birthDate` and the PDF template renders it.

---

### U4. Static Legal Document Files Infrastructure

**Goal:** Establish `public/legal/` as the location for static Satzung and Finanzordnung PDFs and create a server-only helper that reads them from the filesystem.

**Requirements:** R10, R11, R13 (foundational for R14, R15)

**Dependencies:** None

**Files:**
- Create: `public/legal/satzung.pdf` *(place the actual PDF here — see post-plan note)*
- Create: `public/legal/finanzordnung.pdf` *(place the actual PDF here — see post-plan note)*
- Create: `src/lib/legal-documents/static-documents.ts`

**Approach:**
- `static-documents.ts` exports two functions: `readSatzungBuffer(): Promise<Buffer>` and `readFinanzordnungBuffer(): Promise<Buffer>`. Both use `node:fs/promises` to read the respective files from the `public/legal/` directory at the path `path.join(process.cwd(), "public", "legal", "<filename>.pdf")`.
- Mark the file `"server-only"` to prevent accidental client-side import.
- Export the static URL paths as constants (`SATZUNG_URL = "/legal/satzung.pdf"`, `FINANZORDNUNG_URL = "/legal/finanzordnung.pdf"`) for use by the UI in U5.

**Patterns to follow:**
- `"server-only"` import guard in `src/lib/legal-documents/drive-archive.ts`

**Test scenarios:**
- Test expectation: none for the utility itself — reading from `public/legal/` is verified during U9 integration.

**Verification:**
- `public/legal/satzung.pdf` and `public/legal/finanzordnung.pdf` exist and are readable.
- `readSatzungBuffer()` returns a non-empty Buffer without error.

---

### U5. Application Flow Identity, Fee Text, and Document Viewer

**Goal:** Make the application flow identity prominent, update the fee acknowledgement to match R9, and add expand/collapse document viewers for Satzung and Finanzordnung in the review step.

**Requirements:** R5, R9, R10, R11, R12

**Dependencies:** U4

**Files:**
- Modify: `src/app/(authenticated)/(app)/membership/application/[step]/layout.tsx`
- Modify: `src/app/(authenticated)/(app)/membership/application/[step]/(steps)/step-review.tsx`
- Modify: `src/lib/legal-documents/templates/membership-application.tsx`

**Approach:**

*Layout (`layout.tsx`):*
- Change the heading from "Membership Application" to "Membership Application — START Berlin e.V." or add a sub-heading that makes the association identity explicit.

*Fee acknowledgement text:*
- Update the `acknowledgesFee` declaration label in the `DECLARATIONS` array of `step-review.tsx` to: `"I acknowledge that, in accordance with §2 of the Financial Regulations of START Berlin e.V., a membership fee of €20 per semester applies. Upon joining, €40 are due for the first year; subsequent annual payments of €40 are due every 12 months. I understand that the membership fee is non-refundable if I leave the association early."`
- Update the `acknowledgesFee` entry in `DECLARATION_LABELS` in `membership-application.tsx` (PDF template) to the same text so the archived PDF matches the UI.

*Document viewer (Satzung and Finanzordnung):*
- In `step-review.tsx`, add an expand/collapse section above the `acceptsBylaws` checkbox using a `<details>`/`<summary>` element (or an existing Accordion component from the UI library if available). The expanded state shows an `<iframe src={SATZUNG_URL} />` (using the constant from `static-documents.ts`). Label: "Read the Satzung (bylaws)".
- Add a second expand/collapse above the `acknowledgesFee` checkbox in the same way, loading `FINANZORDNUNG_URL`. Label: "Read the Finanzordnung (financial regulations)".
- Import `SATZUNG_URL` and `FINANZORDNUNG_URL` from `src/lib/legal-documents/static-documents.ts` (these are plain string constants, safe to import in a client component).

**Patterns to follow:**
- Existing `Field`, `FieldSet`, `FieldLegend` component usage in `step-review.tsx`

**Test scenarios:**
- Covers AE4: Satzung is accessible before the acceptsBylaws checkbox; Finanzordnung is accessible before the acknowledgesFee checkbox.
- Happy path: `acknowledgesFee` label in `DECLARATIONS` and `DECLARATION_LABELS` both contain "§2" — confirming the R9-compliant text is used consistently in UI and PDF.
- Visual check: layout heading includes "START Berlin e.V."

**Verification:**
- `acknowledgesFee` text contains "§2" and "non-refundable" in both `step-review.tsx` and `membership-application.tsx`.
- `<details>` elements wrapping `<iframe>` tags exist in `step-review.tsx` for both documents.

---

### U6. Sitzungsleiter/Protokollführer — Utility Function

**Goal:** Add a `computeResolutionRoles` function that determines Sitzungsleiter and Protokollführer from participants and votes.

**Requirements:** R2

**Dependencies:** None

**Files:**
- Modify: `src/lib/board-resolution-rules.ts`
- Test: `src/lib/board-resolution-rules.test.ts`

**Approach:**

Function signature:
```
computeResolutionRoles(
  participants: Array<{ userId: string; officerFunction: OfficerFunction }>,
  votes: Array<{ voterUserId: string; value: BoardVoteValue }>
): { sitzungsleiter: { userId: string; officerFunction: OfficerFunction }; protokollfuehrer: { userId: string; officerFunction: OfficerFunction } } | null
```

Logic:
1. Filter votes to those with `value === "yes"`.
2. Find the participant objects matching the yes-voter user IDs.
3. Sort the two yes-voting participants by officer function priority (president = 1, vice_president = 2, head_of_finance = 3).
4. The lower number = Sitzungsleiter; the higher number = Protokollführer.
5. Return `null` if fewer than 2 yes-voting participants are found (defensive; should not occur when called post-approval).

**Patterns to follow:**
- Existing `computeVoteOutcome` in `src/lib/board-resolution-rules.ts`

**Test scenarios:**
- Covers AE2: President + VP voted yes → President = Sitzungsleiter, VP = Protokollführer.
- Covers AE3: VP + Head of Finance voted yes → VP = Sitzungsleiter, HoF = Protokollführer.
- Edge case: President + Head of Finance voted yes → President = Sitzungsleiter, HoF = Protokollführer.
- Edge case: All three voted yes → uses the two highest-priority yes voters (President = Sitzungsleiter, VP = Protokollführer).
- Edge case: Fewer than 2 yes votes → returns `null`.
- Edge case: One voter's userId does not match any participant → that voter is ignored; function returns `null` if fewer than 2 matched participants remain.

**Verification:**
- `computeResolutionRoles` is exported from `src/lib/board-resolution-rules.ts`.
- All test scenarios pass in `src/lib/board-resolution-rules.test.ts`.

---

### U7. Sitzungsleiter/Protokollführer — Board Resolution PDF

**Goal:** Update the board resolution PDF template and the Inngest workflow step to include a "Verfahren" section naming Sitzungsleiter and Protokollführer.

**Requirements:** R3

**Dependencies:** U6

**Files:**
- Modify: `src/lib/legal-documents/templates/board-resolution.tsx`
- Modify: `src/inngest/membership-admission-workflow.ts`

**Approach:**

*Template (`board-resolution.tsx`):*
- Add `sitzungsleiter: { name: string; officerFunction: string }` and `protokollfuehrer: { name: string; officerFunction: string }` to `BoardResolutionTemplateData`.
- Add a new "Verfahren" section in the rendered PDF (between the Beschlusstext and the vote table) showing: "Sitzungsleiter: [name] ([function])" and "Protokollführer: [name] ([function])".

*Inngest workflow (`archive-board-resolution` step):*
- After loading participants and votes, call `computeResolutionRoles` to derive the two roles.
- If `computeResolutionRoles` returns `null` (resolution passed but roles can't be determined — shouldn't happen in normal flow), throw a descriptive error consistent with the existing null-guard pattern.
- Pass the computed roles into `renderBoardResolutionTemplate`.

**Patterns to follow:**
- Existing null guard at lines 242–244 of `src/inngest/membership-admission-workflow.ts`
- Existing section/style structure in `board-resolution.tsx`

**Test scenarios:**
- Covers AE2: `renderBoardResolutionTemplate` called with President as Sitzungsleiter and VP as Protokollführer → "Verfahren" section includes both names.
- Error path: `computeResolutionRoles` returns `null` in the Inngest step → step throws a descriptive error (not a silent undefined-access TypeError).

**Verification:**
- `BoardResolutionTemplateData` includes `sitzungsleiter` and `protokollfuehrer`.
- The rendered PDF contains a section with both role names (verifiable via a snapshot render or integration test).

---

### U8. Sitzungsleiter/Protokollführer — Resolution Vote Screen

**Goal:** Show Sitzungsleiter and Protokollführer on the resolution detail screen when the resolution has passed (status is no longer `admission_pending`).

**Requirements:** R4

**Dependencies:** U6

**Files:**
- Modify: `src/app/(authenticated)/(app)/people/resolutions/[id]/resolution-vote-client.tsx`

**Approach:**
- In `resolution-vote-client.tsx`, call `computeResolutionRoles` using the `participants` and the votes already available in the `ResolutionDetail` prop.
- Render a "Verfahren" section (conditionally, only when the computed result is non-null and the resolution status is not `admission_pending`) showing Sitzungsleiter and Protokollführer names and functions.
- `computeResolutionRoles` is a pure function and can be called from the client component — no additional server round-trip needed.
- Import `computeResolutionRoles` from `src/lib/board-resolution-rules.ts`.

**Patterns to follow:**
- Existing `officerFunctionLabel` helper in `resolution-vote-client.tsx`

**Test scenarios:**
- Covers AE2: resolution passed with President + HoF votes → screen shows President as Sitzungsleiter and HoF as Protokollführer.
- Edge case: resolution is still `admission_pending` (votes not yet complete) → "Verfahren" section is not rendered.
- Edge case: `computeResolutionRoles` returns `null` (e.g., no yes votes yet) → section not rendered, no crash.

**Verification:**
- "Verfahren" section appears in the resolution detail UI after resolution passes.
- Section is absent while the resolution is still in `admission_pending` state.

---

### U9. Aufnahmeantrag PDF — Merge Satzung and Finanzordnung

**Goal:** Merge the Satzung and Finanzordnung PDFs into the generated Aufnahmeantrag PDF, archive the merged result, and record the SHA-256 hashes of the static files in place of the "v1" version strings.

**Requirements:** R7 (birth date in PDF, carried from U3), R14, R15, R16

**Dependencies:** U4, U3

**Files:**
- Modify: `package.json` (add `pdf-lib`)
- Create: `src/lib/legal-documents/pdf-merge.ts`
- Modify: `src/app/(authenticated)/(app)/membership/application/[step]/submit-application-action.ts`
- Modify: `src/inngest/membership-admission-workflow.ts`
- Modify: `src/lib/legal-documents/templates/membership-application.tsx`

**Approach:**

*`pdf-lib` dependency:*
- Add `pdf-lib` as a production dependency. It has no build-time requirements and works in Node.js.

*Merge utility (`pdf-merge.ts`):*
- Mark `"server-only"`.
- Export `mergePdfsWithAttachments(mainPdfBuffer: Buffer, attachments: Array<{ title: string; buffer: Buffer }>): Promise<Buffer>`.
- Implementation: load the main PDF with `PDFDocument.load(mainPdfBuffer)`. For each attachment: create a new single-page "divider" PDF in memory with the attachment title centered on the page; copy its page into the main document; then load the attachment PDF with `PDFDocument.load(buffer)` and copy all its pages into the main document. Return `mainDoc.save()` as a Buffer.

*Submit action (`submit-application-action.ts`):*
- Import `readSatzungBuffer` and `readFinanzordnungBuffer` from `static-documents.ts` and `sha256Hex` from `document-hash.ts`.
- At submission time, compute `sha256Hex(await readSatzungBuffer())` and store in `applicationVersion`; compute `sha256Hex(await readFinanzordnungBuffer())` and store in `feeTextVersion`. These replace the hardcoded `"v1"` strings.

*Inngest `archive-membership-application` step:*
- After rendering the main Aufnahmeantrag PDF with `renderToBuffer`, call `mergePdfsWithAttachments` with the main buffer and two attachments:
  - `{ title: "Anhang 1: Satzung", buffer: await readSatzungBuffer() }`
  - `{ title: "Anhang 2: Finanzordnung", buffer: await readFinanzordnungBuffer() }`
- Archive the merged buffer (not the original `renderToBuffer` output).
- Also pass `birthDate` from `application.birthDate` to `renderMembershipApplicationTemplate` (completing the U3 PDF change).

**Patterns to follow:**
- `archiveLegalDocument` usage pattern in the existing `archive-board-resolution` step
- `"server-only"` guard in `src/lib/legal-documents/drive-archive.ts`

**Test scenarios:**
- Covers AE7: merged PDF buffer contains more pages than the original Aufnahmeantrag PDF alone (verifiable by counting pages with `pdf-lib`).
- Happy path: `submit-application-action` stores a 64-char hex string (SHA-256) in `applicationVersion` and `feeTextVersion` rather than `"v1"`.
- Covers AE5: replacing `public/legal/satzung.pdf` with a different file changes the hash stored at next submission — verifiable by computing `sha256Hex` on both files.
- Edge case: one of the static PDF files is corrupt or unloadable by `pdf-lib` → the Inngest step throws a descriptive error; the workflow retries.

**Verification:**
- `pdf-lib` is listed in `package.json` dependencies.
- `membership_application.applicationVersion` and `feeTextVersion` contain SHA-256 hashes (not `"v1"`) after a complete submission.
- The archived Aufnahmeantrag PDF has more pages than the Aufnahmeantrag template alone.
- Divider pages with "Anhang 1: Satzung" and "Anhang 2: Finanzordnung" are present in the merged PDF.

---

## System-Wide Impact

- **Interaction graph:** U9 changes what is archived in Drive for `membership_application`. The `legalDocument` table and the Drive folder remain unchanged — only the content of the archived PDF grows.
- **Error propagation:** The Inngest `archive-membership-application` step can now throw if `pdf-lib` fails to load a static file. The existing Inngest retry behavior handles transient failures; a truly corrupt PDF file will cause the step to fail permanently until the file is replaced and a redeployment occurs.
- **State lifecycle risks:** SHA-256 hashes stored in `applicationVersion`/`feeTextVersion` are computed at submission time. If a new deployment changes the static files between a user starting and submitting the application, the hash reflects the file present at submission, not the file the user saw (a different deployment was running at view time). This window is intentionally accepted as a known, vanishingly rare edge case.
- **API surface parity:** The `MembershipApplicationTemplateData` interface gains `birthDate`; any other caller of `renderMembershipApplicationTemplate` (if any) must be updated. Verify with a grep before shipping.
- **Unchanged invariants:** `archiveLegalDocument` upload path, `getResolutionDetail` query, and the overall Inngest step sequencing are unchanged.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `pdf-lib` cannot load specific PDF versions of the Satzung/Finanzordnung | Test `PDFDocument.load` against the actual files before merging logic is complete; fall back to appending raw pages if needed |
| Static file unavailable at Inngest run time (missing from `public/`) | The `readSatzungBuffer` / `readFinanzordnungBuffer` helpers throw if the file is missing; this surfaces as a clear Inngest step failure rather than a silent corrupt PDF |
| Birth date field blank for users who began the address step before U3 ships | `birthDate` is nullable in the DB; the Zod schema requires it at submission time only — users must re-enter the address step after the deploy |
| In-flight board resolutions (created before U1) have the old unconditional text | The stored `resolutionText` column is immutable per R43; old resolutions keep their original text. Only new proposals after deploy use the conditional text |

---

## Documentation / Operational Notes

- After deploying, place `public/legal/satzung.pdf` and `public/legal/finanzordnung.pdf` in the repo before the deploy (see post-plan note below).
- To update the Satzung or Finanzordnung: replace the file in `public/legal/`, commit, and deploy. The new SHA-256 will be stored for the next submitted application.
- `resolutionTextVersion: "v2"` distinguishes new conditional resolutions from legacy "v1" unconditional resolutions in the DB, useful for any future audit query.

---

## Sources & References

- **Origin document:** `docs/brainstorms/2026-05-10-admission-documents-application-flow-requirements.md`
- Related code: `src/db/admission.ts`, `src/lib/board-resolution-rules.ts`
- Related code: `src/lib/legal-documents/templates/`
- Related code: `src/inngest/membership-admission-workflow.ts`
- Related code: `src/app/(authenticated)/(app)/membership/application/[step]/`
- Prior plan: `docs/plans/2026-05-02-001-feat-membership-lifecycle-workflows-plan.md` (origin of R27/R35/R36 requirements that this plan fulfills)
