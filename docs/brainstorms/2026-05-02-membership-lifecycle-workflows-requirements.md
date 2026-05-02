---
date: 2026-05-02
topic: membership-lifecycle-workflows
---

# Membership Lifecycle Workflows

## Problem Frame

START Cockpit currently mixes operational membership, profile completion, payment setup, and legal membership evidence too tightly. The next membership lifecycle version should make legal membership explicit without making workflow progress duplicate status fields.

The product direction is to keep operational access and relationship state in `user.status`, add a small durable legal membership state, and let admission workflows carry temporary progress such as board voting, application submission, payment setup, document generation, and task assignment.

This matters because START Berlin needs to distinguish people who participate operationally from people who are legal members with voting and election rights. It also needs a path for existing Members or Supporting Alumni whose old membership documents are missing: they should be operationally treated as they are today, but legally treated like not-yet-members until the same admission workflow is completed.

---

## Actors

- A1. Onboarding user: A person with a START Cockpit account who participates in onboarding but is not yet a legal member.
- A2. Existing operational Member or Supporting Alumni: A person imported or already present as active in START operations.
- A3. Legal Member or Supporting Alumni: A person whose legal membership basis is documented and active.
- A4. Alumni user: A former participant who does not need active legal member data collection.
- A5. Department Lead: Can propose onboarding users for legal membership admission.
- A6. Board Member: Can vote on membership admission resolutions.
- A7. Admin: Can create/import users and start required admission workflows for legacy cleanup.
- A8. START Cockpit: Stores profile data, operational status, legal membership state, tasks, workflows, documents, and audit history.

---

## Key Flows

- F1. Status-aware profile completion
  - **Trigger:** A user signs in or loads the app.
  - **Actors:** A1, A2, A3, A4, A8
  - **Steps:** START Cockpit checks which profile fields are required for this user's current operational and legal state. It blocks app access until required fields are complete. Onboarding users and Alumni must provide personal email and phone, but not address. Legal Members and Supporting Alumni must provide personal email, phone, and address.
  - **Outcome:** Users cannot skip required profile data, while address collection moves out of generic onboarding for people who are not legal members.
  - **Covered by:** R4, R5, R6, R7

- F2. Propose onboarding user for legal membership
  - **Trigger:** A Department Lead, Board Member, or Admin decides an onboarding user should be invited to become a legal member.
  - **Actors:** A1, A5, A6, A7, A8
  - **Steps:** The proposer starts an individual admission workflow from the user record. START Cockpit creates a board-resolution task for all current Board Members. Board Members vote in the task center. If the board resolution passes, START Cockpit invites the user into the member-facing finalize membership workflow.
  - **Outcome:** The old "Complete onboarding" action becomes a legally clearer "Propose for membership" action, and payment setup is no longer the direct next step.
  - **Covered by:** R8, R9, R10, R11, R12, R13, R14

- F3. Import existing operational member with missing documents
  - **Trigger:** An Admin imports or reviews an operational Member or Supporting Alumni and marks that START does not have sufficient membership documents.
  - **Actors:** A2, A6, A7, A8
  - **Steps:** START Cockpit keeps the person's operational status as Member or Supporting Alumni, sets legal membership state to `not_member`, and immediately creates an individual admission workflow with a board-resolution task. After board approval, the person receives the same member-facing finalize membership workflow as an onboarding user.
  - **Outcome:** Legacy cleanup uses the same legal admission path without requiring a Department Lead to start a separate proposal.
  - **Covered by:** R1, R2, R3, R9, R10, R12, R13, R15

- F4. Finalize membership
  - **Trigger:** A board resolution has approved the person's admission subject to a complete application.
  - **Actors:** A1, A2, A6, A8
  - **Steps:** The user opens a guided "Finalize membership" workflow. First they submit the legal membership application with required declarations and address. START Cockpit creates the admission confirmation and sets legal membership state to `active_member`. If billing applies, the same guided workflow then asks the user to complete payment setup.
  - **Outcome:** Legal membership starts after board approval plus complete application and admission confirmation; payment setup remains required for completion, but is not the legal trigger.
  - **Covered by:** R16, R17, R18, R19, R20

---

## Requirements

**Membership state and profile requirements**
- R1. START Cockpit must keep operational relationship/access state separate from legal membership state.
- R2. Operational state remains the place for values such as `onboarding`, `member`, `supporting_alumni`, and `alumni`.
- R3. V1 legal membership state must use only `not_member`, `active_member`, and `former_member`.
- R4. Supporting Alumni must be treated as `active_member` when START has sufficient legal membership basis/documents.
- R5. Workflow progress must not be encoded as legal membership state. Temporary progress such as board vote pending, application pending, or payment pending belongs to workflow/task records.
- R6. Profile completion must be status-aware. All users require personal email and phone. Onboarding users, Alumni, and operational Members or Supporting Alumni whose legal state is `not_member` do not require address during profile completion. Active legal Members and Supporting Alumni require address.
- R7. Missing required profile data must continue to block app access through the profile completion flow. The flow should include or exclude fields/steps based on what is required for the user.

**Admission workflow and task center**
- R8. The current "Complete onboarding" action must be reframed as "Propose for membership."
- R9. Department Leads, Board Members, and Admins can start an admission workflow for an onboarding user once the user account exists.
- R10. Imported or existing operational Members and Supporting Alumni with missing membership documents must be assigned `legal_membership_state = not_member`.
- R11. When an Admin imports a Member or Supporting Alumni with missing documents, START Cockpit must immediately create an individual admission workflow and board-resolution task.
- R12. V1 must use individual admission workflows only. Batch board resolutions are out of scope for v1.
- R13. START Cockpit must introduce a general task center for assigned tasks, while also surfacing the most important current membership task contextually on the membership/home surface.
- R14. The task center foundation should be adaptable to future operational tasks, but v1 only needs the tasks required by membership admission and board resolutions.

**Board resolution behavior**
- R15. A board-resolution task must be sent to all current Board Members who are eligible to vote on legal membership admission, with task-center visibility and an email notification.
- R16. Board Members must be able to vote yes, no, abstain, or object to the electronic procedure.
- R17. A board resolution passes only when at least two of three Board Members actively vote yes and no Board Member objects to the electronic procedure. Silence must not count as approval.
- R18. A procedure objection must stop electronic finalization and leave the workflow requiring manual/offline handling.
- R19. When a board resolution passes, START Cockpit must record the resolution outcome, determine the required chair/procedure-lead and minute-taker roles for the documentation, create the required resolution documentation, and invite the person to finalize membership.

**Member-facing finalize membership flow**
- R20. The member-facing experience must be one guided "Finalize membership" workflow with separate internal steps for application and payment setup when billing applies.
- R21. Profile onboarding remains a prerequisite and cannot be skipped. The finalize membership workflow can assume personal email and phone already exist.
- R22. The membership application must collect the required legal application information, including address/contact address, full name confirmation, birth date or majority/legal-capacity confirmation, natural person confirmation, support for START Berlin's purpose, bylaws acceptance, privacy notice acknowledgement, and any required application motivation or version acknowledgements.
- R23. After board approval plus complete application and admission confirmation, START Cockpit must set `legal_membership_state = active_member` before payment setup is completed.
- R24. Payment setup remains part of the guided completion workflow for statuses that require billing, but payment completion must not be treated as the legal membership trigger.
- R25. The membership/home surface should show the user's current membership completion state: board resolution pending, application required, payment setup required, or all done.

**Documents, audit, and legal privileges**
- R26. Legal privileges such as voting, election eligibility, and formal member lists must be based on legal membership state, not operational status alone.
- R27. Every legally relevant admission event must create durable structured records and audit history.
- R28. Board resolutions, membership applications, and admission confirmations must produce readable archived documents with database references. Google Drive may serve as the readable archive, but the database remains the source of workflow and status truth.
- R29. Finalized legal records, vote records, application snapshots, document references, and generated document hashes must be treated as immutable except through explicit corrections or replacement versions.

---

## Acceptance Examples

- AE1. **Covers R1, R3, R5.** Given an onboarding user has a board vote pending, when their user record is inspected, their legal membership state is still `not_member`; the pending vote is visible only through the admission workflow/task.
- AE2. **Covers R6, R7.** Given an onboarding user has personal email and phone but no address, when they load the app, profile completion is considered complete and address is not requested yet.
- AE3. **Covers R6, R7.** Given a legal Member or Supporting Alumni has personal email and phone but no address, when they load the app, START Cockpit blocks access with the adaptive profile completion flow until address is provided.
- AE4. **Covers R8, R9, R12, R19.** Given an onboarding user exists, when a Department Lead selects "Propose for membership," START Cockpit creates one individual board-resolution task and does not invite the user directly to payment setup.
- AE5. **Covers R10, R11, R20.** Given an Admin imports a Supporting Alumni but marks membership documents as missing, when the import completes, the person keeps operational Supporting Alumni status, legal state is `not_member`, and an admission workflow starts with a board task.
- AE6. **Covers R16, R17, R18.** Given three Board Members receive a resolution task, when two vote yes and the third does not vote, the resolution can pass only if no Board Member has objected to the electronic procedure. If any Board Member objects, the electronic workflow stops.
- AE7. **Covers R20, R22, R23, R24.** Given a user's admission was board-approved, when they submit a complete application, START Cockpit confirms admission and sets legal state to `active_member`; if billing applies, payment setup remains as the next guided step.
- AE8. **Covers R25, R26.** Given an operational Member has missing documents and an admission workflow pending, when they view membership/home, they see that START is preparing their application workflow and they are not included in legal voting/election eligibility until legal state becomes `active_member`.

---

## Success Criteria

- START Cockpit can distinguish operational access from legal membership without overloading `user.status`.
- Onboarding users and imported missing-document Members/Supporting Alumni use the same legal admission workflow.
- Active legal Members and Supporting Alumni are forced to provide address as soon as possible, while Onboarding users and Alumni are not.
- Board Members have a clear task-centered way to approve admission resolutions without treating silence as consent.
- Members experience application and payment as one coherent "Finalize membership" workflow.
- Planning can proceed without inventing product behavior for legal state, profile gating, board voting, imports, or member-facing membership completion.

---

## Scope Boundaries

- V1 does not support batch membership-admission resolutions.
- V1 does not implement digital resignation, exclusion workflows, or former-member reactivation workflows.
- V1 does not create separate operational access levels for onboarding users versus active Members. The legal state gates legal privileges such as voting, not normal tool access.
- V1 does not make payment setup the legal admission trigger.
- V1 does not require a full future task taxonomy for IT/offboarding work, but the task center should avoid being named or shaped only around membership.
- V1 does not require a separate member-data editing/audit portal beyond what is necessary for profile completion and legal admission.
- V1 does not resolve final legal wording, BGB/Satzung compliance, or whether additional electronic-signature measures are required.

---

## Key Decisions

- Keep legal membership state small: durable legal truth is easier to reason about than duplicating workflow progress in status fields.
- Treat Supporting Alumni as legal members when documented: operationally they differ from Members, but legally they still need active member treatment and address collection.
- Use one admission workflow for onboarding and missing-document imports: this prevents a special legacy cleanup path from drifting away from the normal legal process.
- Start board tasks immediately on missing-document import: START has no evidence of prior admission, so the system should not wait for a Department Lead proposal.
- Keep profile onboarding as the required data gate: users cannot skip personal email and phone, and the adaptive flow can also collect address from active legal Members and Supporting Alumni.
- Make "Propose for membership" replace "Complete onboarding": the label should match the legal effect and avoid implying automatic membership.
- Set legal membership active before payment setup: legal admission is based on board approval plus complete application and confirmation; payment remains an operational/billing requirement.

---

## Dependencies / Assumptions

- START Cockpit currently has operational statuses for onboarding, member, supporting alumni, and alumni.
- Current app access already depends on profile completion, so adapting required fields by user/legal state is consistent with the product shape.
- Current payment setup exists and can remain part of the membership completion workflow after application submission.
- The board currently has three eligible voters for these resolutions.
- Legal and Satzung review is required before relying on the electronic resolution process in production, especially voting thresholds, text-form/procedure rules, and document wording.
- Google Drive is acceptable as a readable legal archive as long as database records remain authoritative for workflow and status.

---

## Outstanding Questions

### Resolve Before Planning

- None.

### Deferred to Planning

- [Affects R13, R14][Technical] Decide the minimal task center model that supports board vote tasks, member workflow tasks, contextual membership surfacing, and future task types without overbuilding v1.
- [Affects R15, R16, R17, R18][Technical] Decide how current Board Members and officer functions are determined at vote time.
- [Affects R19, R27, R28, R29][Technical] Decide how PDFs, hashes, Drive archival, and document references are generated and stored.
- [Affects R20, R23, R24][Technical] Decide how the existing payment flow composes with the new admission workflow without making payment the legal trigger.
- [Affects R15, R16, R17, R18, R19][Needs legal review] Validate electronic board resolution requirements against START Berlin's Satzung and current German association-law requirements before production rollout.

---

## Next Steps

-> /ce-plan for structured implementation planning.
