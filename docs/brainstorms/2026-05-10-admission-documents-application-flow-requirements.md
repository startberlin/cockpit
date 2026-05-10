---
date: 2026-05-10
topic: admission-documents-application-flow
---

# Admission Documents & Application Flow

## Summary

Fix legal text gaps in the board resolution (conditional Beschlusstext, Sitzungsleiter/Protokollführer assignment), make the membership application flow more official, collect birth date, display the Satzung and Finanzordnung to users before acceptance, and attach both documents directly to the generated Aufnahmeantrag PDF.

---

## Problem Frame

The admission workflow has three layers of gaps that have accumulated since the membership lifecycle plan was implemented.

**Board resolution legal text.** The current Beschlusstext declares unconditional admission, but the actual process requires the person to submit a valid application after the board vote — so the text misrepresents the legal effect. Additionally, R27 of the lifecycle requirements specified that Sitzungsleiter and Protokollführer roles must be determined and documented when a resolution passes. Neither role is assigned, displayed in the PDF, nor communicated to board members anywhere in the current implementation.

**Application flow officiality and data gaps.** The application flow does not clearly identify START Berlin e.V. as the association the user is joining. Birth date — a required datum for German association membership — is not collected. The fee acknowledgement text is a single simplified sentence, when the original plan (R36) required it to reference §2 of the Finanzordnung, state €20 per semester, specify €40 due on joining, and note the non-refundable early-exit rule.

**Document completeness.** Users are asked to accept the Satzung and Finanzordnung via checkboxes without ever seeing either document. The generated Aufnahmeantrag PDF references these documents only as static version strings (`v1`), making it impossible to tell which exact version of the Satzung or Finanzordnung was in effect at admission time.

---

## Requirements

**Board resolution legal text**

- R1. The Beschlusstext must use conditional language: the board resolves to admit the person *subject to their submitting a valid membership application*, not as an unconditional admission declaration.
- R2. When a board resolution passes, the system must determine Sitzungsleiter and Protokollführer from the two approving voters using this fixed rule: President + VP → President = Sitzungsleiter, VP = Protokollführer; President + Head of Finance → President = Sitzungsleiter, Head of Finance = Protokollführer; VP + Head of Finance → VP = Sitzungsleiter, Head of Finance = Protokollführer.
- R3. The board resolution PDF must include a section that names Sitzungsleiter and Protokollführer by name and role after the resolution passes.
- R4. Each board participant must be made aware of whether they are Sitzungsleiter or Protokollführer for the resolution — either on the resolution screen or in the board resolution PDF.

**Application flow officiality and data collection**

- R5. The membership application flow must prominently identify that the user is applying to become an ordentliches Mitglied of START Berlin e.V.
- R6. Birth date must be collected during the application flow and stored on the user record alongside address.
- R7. Birth date must appear in the Aufnahmeantrag PDF alongside name and address.
- R8. The review step must display the user's full name for explicit confirmation before submission.
- R9. The fee acknowledgement declaration must reference §2 of the Finanzordnung, state that €20 per semester applies (€40 due upon joining for the first year and annually thereafter), and make clear the fee is non-refundable on early exit.

**Satzung and Finanzordnung display**

- R10. The Satzung must be displayed to the user — loaded from Google Drive — before they accept it during the application flow.
- R11. The Finanzordnung must be displayed to the user — loaded from Google Drive — before they acknowledge the membership fee.
- R12. Both documents must support expand/collapse or a separate tab interaction so users can read them without leaving the application flow.
- R13. Google Drive file IDs for the Satzung and Finanzordnung must be stored as environment variables; updating the env var to point to a new file version is the only change required to roll out an updated document — no code or data migration needed.

**Aufnahmeantrag PDF attachment**

- R14. The generated Aufnahmeantrag PDF must include the Satzung as appended pages (merged), replacing the current static `applicationVersion` string reference.
- R15. The generated Aufnahmeantrag PDF must include the Finanzordnung as appended pages (merged), replacing the current static `feeTextVersion` string reference.
- R16. A labeled divider must clearly separate the application data section from the attached Satzung and Finanzordnung pages in the merged PDF.

---

## Acceptance Examples

- AE1. **Covers R1.** Given a board resolution is created for a candidate, when the resolution text is read, it states that admission is conditional on the person submitting a valid application — not that admission has been decided unconditionally.

- AE2. **Covers R2, R3, R4.** Given a board resolution passes with President and Head of Finance voting yes, when the board resolution PDF is generated, it names the President as Sitzungsleiter and Head of Finance as Protokollführer. Board participants can see their role assignment.

- AE3. **Covers R2.** Given a board resolution passes with VP and Head of Finance voting yes (President did not vote), when roles are assigned, VP is Sitzungsleiter and Head of Finance is Protokollführer.

- AE4. **Covers R10, R11, R12.** Given a user is on the Declarations step of the application flow, when they are about to accept the bylaws, the Satzung is available to expand and read; when they are about to acknowledge the fee, the Finanzordnung is available to expand and read. Neither document requires them to leave the application flow.

- AE5. **Covers R13.** Given the Satzung is updated in Google Drive and the corresponding env var is updated to the new file ID, when the next user reaches the Declarations step or a new Aufnahmeantrag is generated, the new Satzung version is displayed and attached — without any code deployment.

- AE6. **Covers R6, R7, R8.** Given a user provides their birth date in the address step, when they reach the review step their full name and birth date are displayed alongside address, and all three fields appear in the generated Aufnahmeantrag PDF.

- AE7. **Covers R14, R15, R16.** Given a user submits a complete membership application, when the Aufnahmeantrag PDF is generated and archived in Drive, the PDF contains the application data section followed by a labeled divider and then the full Satzung and Finanzordnung pages.

---

## Success Criteria

- Board resolution PDFs use conditional admission language and correctly identify Sitzungsleiter and Protokollführer for every passing resolution.
- Users read the actual Satzung and Finanzordnung before accepting them — not just checkbox labels that describe the documents abstractly.
- The archived Aufnahmeantrag PDF is self-contained: it includes the candidate's name, birth date, address, declarations, and the exact Satzung and Finanzordnung that were in effect at admission time.
- Rolling out a new version of the Satzung or Finanzordnung requires only updating the Drive file and the env var — no code change, no migration.
- Planning can proceed without inventing the Sitzungsleiter/Protokollführer assignment logic, document display interaction pattern, or PDF merging approach.

---

## Scope Boundaries

- Document branding and visual design update — deferred to a separate follow-up scope (explicitly noted as "next step").
- Version history tracking in the database for Satzung/Finanzordnung changes — env var + Drive file update is sufficient for v1.
- Digital or wet signature support on the Aufnahmeantrag.
- Batch membership-admission resolutions.
- Birth date display or use in parts of the app beyond the application flow and the Aufnahmeantrag PDF.

---

## Key Decisions

- **Sitzungsleiter/Protokollführer assigned post-vote, not pre-assigned:** the assignment is derived from which two officers actually voted yes, so the roles in the legal document reflect real participation rather than anticipated participation.
- **Satzung and Finanzordnung fetched from Google Drive at runtime:** a file update + env var change is the entire version-rollout mechanism. No DB version tracking needed at this scale.
- **Birth date stored on the user record alongside address:** consistent with how other legal-admission personal data is handled; the value is snapshotted onto the membership application record at submission time so the archived PDF reflects the state at admission.
- **PDF attachment via page merging:** the Satzung and Finanzordnung are appended as additional pages to the Aufnahmeantrag PDF. Embedded file attachments inside PDFs are not used, as the existing PDF renderer does not support them and merged pages are more universally readable.

---

## Dependencies / Assumptions

- Google Drive integration via service-account auth already exists for document archival; Satzung and Finanzordnung fetching reuses this infrastructure.
- The Satzung and Finanzordnung are already stored as PDFs in Google Drive and accessible via the existing service account.
- Two new environment variables (one per document) must be added; they do not yet exist.
- The `user` table requires a `birthDate` column; this needs a schema change and migration.

---

## Outstanding Questions

### Resolve Before Planning

- None.

### Deferred to Planning

- [Affects R10, R11][Technical] How are the Drive PDFs served to the browser for display — server-proxied stream, signed URL redirect, or re-encoded as inline data? Evaluate against the existing Drive auth pattern.
- [Affects R14, R15][Technical] Which PDF merging library is used to append Drive-fetched pages to the react-pdf-rendered Aufnahmeantrag — evaluate against existing dependencies before introducing a new one.
- [Affects R3, R4][Technical] Should Sitzungsleiter/Protokollführer also be surfaced on the resolution voting screen (`resolution-vote-client.tsx`) or only in the generated PDF?
- [Affects R6][Technical] Confirm whether `birthDate` column is nullable or required at the DB level, and whether existing users without a birth date need a migration strategy.
