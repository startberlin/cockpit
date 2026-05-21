---
date: 2026-05-21
topic: membership-transitions
---

# Membership Transitions

## Summary

Six new member lifecycle transitions — covering alumni graduation (self-service with departmental approval), voluntary self-cancellation (with a light acknowledgement step), and board-initiated removal — each with distinct authorization, data-deletion, and communication outcomes. The `cancelled` status is added to `user.status`. All transitions involving Google account deletion collect the member's personal email upfront and generate a PDF archived to Google Drive.

---

## Problem Frame

The cockpit currently handles one direction of the membership lifecycle: onboarding → member. Members who graduate to alumni, downgrade to supporting alumni, or leave the association (voluntarily or not) have no supported transition path. This means off-system manual steps for data cleanup, Google account deletion, and payment cancellation — and no audit trail for exits.

Alumni and supporting-alumni are protected statuses requiring 1+ years of community contribution, enforced by departmental approval. Cancellation (voluntary or involuntary) ends the association relationship entirely and triggers data deletion. These flows are distinct enough that they require separate Inngest workflows and separate UX paths, but share common infrastructure: the personal email collection step, PDF generation, and the revamped email system.

---

## Actors

- A1. **Member** — initiates alumni requests and voluntary self-cancellation; can retract pending requests
- A2. **Department head** — approves or rejects alumni/supporting-alumni requests; acknowledges cancellation requests; falls back to legal board if the member has no department
- A3. **Legal board member** (president / VP / head of finance) — fallback approver when no department; can initiate board-kicked removal of any user regardless of status
- A4. **Admin** — can initiate board-kicked removal; sees cancelled users in the admin directory

---

## Key Flows

- F1. **Self-cancellation request**
  - **Trigger:** A1 submits a cancellation request in the cockpit
  - **Actors:** A1, A2/A3
  - **Steps:** Member confirms/updates personal email → submits request → Inngest workflow fires → pending card appears on "My membership" page → acknowledgement notification sent to dept head (or board if no dept) → dept head acknowledges (or timeout elapses) → cancellation executes: GoCardless cancelled, Google account deleted, start email nulled, personal data deleted (name kept), sessions revoked, PDF generated and archived, confirmation sent to personal email
  - **Outcome:** `user.status = "cancelled"`, `legalMembershipState = "former_member"`, `legalMembership.status = "cancelled"` with `endedAt`
  - **Escape:** Member retracts request before acknowledgement → workflow cancelled, status unchanged
  - **Covered by:** R1, R2, R3, R5, R6, R7, R10, R15, R16, R17

- F2. **Board-initiated removal (kick)**
  - **Trigger:** A3 or A4 initiates removal from the admin directory
  - **Actors:** A3/A4
  - **Steps:** Board member selects "Remove member", provides reason → cancellation executes immediately: GoCardless cancelled, Google account deleted, start email nulled, personal data deleted (name kept), sessions revoked, PDF generated and archived, confirmation sent to member's existing personal email
  - **Outcome:** Same final state as F1; no pending state visible to the member
  - **Covered by:** R1, R2, R4, R6, R7, R10, R15, R16

- F3. **Alumni / supporting-alumni request**
  - **Trigger:** A1 submits an alumni or supporting-alumni request
  - **Actors:** A1, A2/A3
  - **Steps:** Member confirms/updates personal email → request flow presents supporting-alumni vs. full-alumni options with pros/cons → for full alumni: "Stay connected?" step (pre-filled personal email; member opts in or out of alumni contact list) → request submitted → Inngest fires → pending card on "My membership" → approval notification sent to dept head/board → dept head approves or rejects → if approved: transition executes → if rejected: member notified, can re-request
  - **Outcome (alumni):** `user.status = "alumni"`, `legalMembershipState = "former_member"`, `legalMembership.status = "cancelled"`, GoCardless cancelled, Google account deleted, start email nulled, personalEmail kept only if opted in; PDF generated, archived, sent to personal email
  - **Outcome (supporting alumni):** `user.status = "supporting_alumni"`, department nulled; Google account and GoCardless unchanged; no PDF required
  - **Escape:** Member retracts request before decision → workflow cancelled, status unchanged
  - **Covered by:** R8, R9, R10, R11, R12, R13, R14, R15, R16, R17

---

## Requirements

**Cancellation — self-initiated**

- R1. A member, supporting alumni, or onboarding user can submit a self-cancellation request from within the cockpit
- R2. Before submitting, the member is asked to confirm or update their personal email — this is where the confirmation PDF and email will be delivered
- R3. A submitted self-cancellation request enters a pending state; a light acknowledgement step is sent to the member's department head (or legal board if no department assigned); the approver cannot block the cancellation, only acknowledge it
- R4. If the acknowledgement is not completed within 7 days, the cancellation proceeds automatically
- R5. While pending, the member sees a "Your cancellation request is being processed" card on the "My membership" page with a self-service "Cancel request" button; retracting the request cancels the Inngest workflow and restores the prior status

**Cancellation — board-initiated**

- R6. A legal board member can initiate a removal ("kick") of any user from the admin directory regardless of their status (`onboarding`, `member`, `supporting_alumni`); this executes immediately with no pending state and no acknowledgement step
- R7. A reason is recorded on the cancellation (`resigned` vs. `removed_by_board`) for audit purposes

**Cancellation — execution (applies to both self-initiated and board-initiated)**

- R8. GoCardless subscription and mandate are cancelled via API immediately; no refund is issued for remaining coverage
- R9. The user's Google Workspace account is **suspended immediately** and **hard-deleted after 7 days** via an Inngest delayed step; this gives a short safety window for accidental or disputed transitions before the deletion becomes irreversible
- R10. `user.email` (start email) is nulled; `user.personalEmail` is nulled for cancelled users (name is retained); all other personal fields are cleared (address, phone, birth date); operational fields (`department`, GoCardless IDs, `gocardlessSetupSessionId`) are also nulled
- R11. All active sessions for the user are immediately revoked
- R12. Any in-flight Inngest admission or reconfirmation workflow for the user is cancelled using the stored `inngestRunId`
- R13. `user.status → "cancelled"`, `user.legalMembershipState → "former_member"`, `legalMembership.status → "cancelled"` with `endedAt = now`
- R14. A cancellation PDF is generated (equivalent in structure to the admission confirmation PDF), archived to Google Drive, and sent to the member's personal email before it is deleted
- R15. Cancelled users are excluded from all non-admin views across the app; they appear only in the admin directory

**Alumni / supporting-alumni request**

- R16. A member or supporting alumni can submit an alumni/supporting-alumni request from within the cockpit; re-requests are allowed after rejection
- R17. Before submitting, the member confirms or updates their personal email; this email is pre-filled in the "Stay connected?" step for full-alumni requests
- R18. The request flow presents both options (supporting alumni: stays part of community, still pays dues; full alumni: leaves entirely) with pros/cons; this step applies only when the current status is `member` (supporting-alumni → alumni skips the choice)
- R19. For full-alumni requests, a "Stay connected?" step asks whether to retain the personal email for alumni communications; the opted-in email is stored as `personalEmail` if the user proceeds
- R20. Requests enter a pending state visible on "My membership" with a "Cancel request" button; approval notification sent to the dept head or board
- R21. The department head can approve or reject the request; on rejection the member is notified and the status is unchanged
- R22. Alumni/supporting-alumni status is protected; the department head's approval enforces the 1+ year eligibility requirement via human judgment — no automated enforcement
- R23. On approval of a full-alumni request: GoCardless subscription and mandate cancelled immediately (no refund), Google account deleted, start email nulled, personal data cleared unless opted in, `user.status → "alumni"`, `user.legalMembershipState → "former_member"`, `legalMembership.status → "cancelled"`, sessions revoked, PDF generated and archived, confirmation sent to personal email
- R24. On approval of a supporting-alumni request: `user.status → "supporting_alumni"`, `department → null`; Google account, start email, and GoCardless are unchanged; no PDF required
- R25. `supporting_alumni → alumni` follows the same Inngest-backed approval flow and execution as `member → alumni`
- R26. `member → supporting_alumni` is a small transition: department is removed and status is updated; payment, Google account, and start email are unchanged

**Email communications**

- R27. All new emails use the revamped `EmailShell` with appropriate `eyebrow` and `footerAudience`; they use `EmailCta`, `EmailDetailBlock`, and `EmailStatusBadge` where appropriate; copy never surfaces GoCardless terms, internal status names, or system identifiers
- R28. Member-facing emails for transitions that delete the start email are sent to the confirmed personal email collected during the request flow
- R29. New member-facing emails: cancellation-request-received, cancellation-confirmed, alumni-request-received, alumni-request-rejected, alumni-confirmed, supporting-alumni-confirmed
- R30. New approver-facing emails: transition-acknowledgement-needed (dept head/board for cancellation), alumni-approval-needed (dept head/board for alumni requests); these use `footerAudience="board"`
- R31. All new email files export realistic `PreviewProps`

**Schema**

- R32. `cancelled` is added to the `user_status` pg enum
- R33. `user.email` and `user.personalEmail` must become nullable to support data deletion for cancelled users

---

## Acceptance Examples

- AE1. **Covers R3, R4, R5.** Given a member with no department who submits a self-cancellation request, when 7 days pass with no acknowledgement from the legal board, the cancellation executes automatically and the member receives a confirmation email at their personal address.

- AE2. **Covers R5.** Given a member with a pending self-cancellation request, when they click "Cancel request" on "My membership", the Inngest workflow is cancelled and their status remains `member`.

- AE3. **Covers R21, R22.** Given a member who requests alumni status and the department head rejects the request, the member receives a rejection email, their status is unchanged, and they can submit a new request at any time.

- AE4. **Covers R19, R23.** Given a member who requests full alumni and opts out of "Stay connected?", when the dept head approves, `personalEmail` is nulled along with all other personal data, and the confirmation PDF is sent to the email they provided before it is deleted.

- AE5. **Covers R6, R15.** Given a board member who removes an onboarding user via the admin directory, the removal executes immediately, no pending card is shown to the removed user, and the user is hidden from all non-admin views.

- AE6. **Covers R26, R24.** Given a member who requests to become a supporting alumni and the dept head approves, the member's department is cleared and status becomes `supporting_alumni`; their Google account, start email, and GoCardless mandate are unchanged.

---

## Success Criteria

- A member can self-cancel or request alumni status entirely within the cockpit without any off-system manual steps required from admins for data cleanup, Google account deletion, or payment cancellation
- Admins can remove any user from the admin directory with a single board-authenticated action that leaves a complete audit trail
- All post-transition data states are clean: no orphaned GoCardless mandates, no lingering Google accounts, no stale sessions

---

## Scope Boundaries

- Automated enforcement of the "1+ year" alumni eligibility rule — deferred; department head judgment is the gate
- Formal Vereinsrecht board resolution vote for involuntary removal — excluded; board member authority in the cockpit is sufficient authorization
- Reversibility / re-admission of cancelled users — excluded
- Slack access management — excluded; not cockpit-controlled
- GDPR full erasure request handling as a separate feature — excluded; the cancellation data deletion covers the practical case
- Any upward re-promotion paths (cancelled → member, alumni → member) — excluded
- `supporting_alumni → member` re-promotion — excluded

---

## Key Decisions

- **Self-cancellation has an acknowledgement step, not an approval step:** A resigning member cannot be blocked from leaving, but the department head must have the opportunity to speak with them and handle handover before the irreversible deletion runs. A 7-day timeout ensures the process completes automatically if the dept head is unresponsive.
- **Personal email collected before start email is deleted:** The member's start email is the primary auth and notification address. For any transition that deletes it, the flow must collect a confirmed personal email first — so there is always a delivery address for the confirmation PDF.
- **No refund for mid-period billing:** GoCardless subscription and mandate are cancelled immediately on transition; no partial refund is issued.
- **Board-initiated removal executes immediately:** No pending state. The board member's authority is the authorization; a separate acknowledgement step would create an inconsistency where the person being removed sees a "pending" card before they are removed.
- **Google account suspended first, hard-deleted after 7 days via Inngest:** Immediate suspension cuts off access at the moment of transition. The hard deletion is scheduled as an Inngest delayed step, providing a 7-day safety window to reverse an accidental or disputed action before it becomes irreversible.
- **PDF generated for all destructive transitions:** Cancellation and alumni transitions generate a PDF for the association's records, mirroring the admission confirmation PDF pattern.

---

## Dependencies / Assumptions

- Google Workspace Admin SDK supports account deletion (same SDK used for account creation in `new-user-workflow.ts`)
- GoCardless API supports subscription and mandate cancellation (sandbox environment available for testing)
- Inngest run cancellation is possible using the stored `inngestRunId` on `legalMembership`
- The `email` and `personalEmail` NOT NULL constraints can be relaxed via Drizzle migration without breaking Better Auth
- The `footerAudience` prop supports "board" for dept-head / board-member emails (confirmed — `EmailShell` already has this variant)

---

## Outstanding Questions

### Resolve Before Planning

*(none)*

### Deferred to Planning

- [Affects R12][Technical] Confirm that Inngest provides a reliable API or SDK method for cancelling a workflow run by `runId` — or that the admission workflow can be made to self-cancel when it re-reads the user's status mid-run
- [Affects R14][Technical] Determine whether the cancellation/alumni PDF can reuse the existing PDF generation infrastructure from the admission workflow, or whether a new template is needed
- [Affects R3, R20][Technical] Determine whether dept head lookup follows the existing authority resolution logic from `src/db/authority.ts` or needs a new query
