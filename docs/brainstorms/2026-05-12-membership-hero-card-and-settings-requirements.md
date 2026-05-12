---
date: 2026-05-12
topic: membership-hero-card-and-settings
---

# Membership Hero Card and Settings Subpage

## Summary

Rework the My Membership page's hero card to show only legal membership status and user status (no payment CTAs), introduce a single priority-ranked notice block for action items, add a read-only contact details card with a linked settings subpage for editing, and define directional copy for all ~11 membership state combinations.

---

## Problem Frame

The current membership page distributes its main card logic across `task-card.tsx` and `MembershipSection` / `onboarding.tsx`, conflating two independent journeys: the membership journey (legal status, application flow, reconfirmation) and the payment journey (mandate setup, GoCardless reconciliation). Per `docs/solutions/architecture-patterns/membership-journey-vs-payment-journey-2026-05-12.md`, these are independent and must not be coupled in the UI.

In practice this means a legally admitted member sees payment CTAs inside the membership status card, and a member whose mandate was cancelled sees the same copy as someone who never set up payment at all. The existing `billing-copy.ts` was written before the tone-of-voice guide was established and does not follow it.

The result is a membership status view that reads like a billing interface, and a component structure that requires payment state to render membership identity — a coupling that grows harder to untangle as both journeys evolve independently.

---

## Requirements

**Hero card — structure**

- R1. The hero card shows only the member's legal membership status and user status. No payment CTAs, payment state copy, or mandate-related logic appears inside the card.
- R2. For active member and supporting alumni states (rows 2–5 of the state table, R8), the card headline is "Hi [firstName]". All other states use a context-specific headline per R8.
- R3. The processing state renders a visible spinner in the hero card alongside the status text. No user action is required; the card auto-updates by preserving the existing React Query polling behaviour.
- R4. A badge on the hero card indicates when an action is pending. The badge is visible for all states where a notice block is shown (R10–R13); it is absent when no action is required.

**Hero card — state evaluation and copy**

- R5. The hero card state is determined by evaluating signals in priority order: (1) `userStatus === "alumni"` overrides all other signals; (2) `legalMembership.status`; (3) `user.legalMembershipState === "active_member"` without a legalMembership record (backward-compat path for imported members, treated as rows 2–5 based on payment state); (4) default onboarding state.
- R6. The `admission_pending` legalMembership status is opaque to the member: from their perspective it is indistinguishable from the initial onboarding state. No mention of a board review or admission process is shown until the member reaches `application_pending`.
- R7. For active member and supporting alumni states, the hero card subtitle distinguishes three payment sub-states using `gocardlessMandateId` and `gocardlessCustomerId`:
  - Mandate active (`gocardlessMandateId` set): positive confirmation copy.
  - Customer ID set, no mandate ID (mandate previously cancelled): "Your membership is active but there is a problem with your payment."
  - No customer ID, no mandate ID (payment never set up): "Your membership is active. We still need your payment details."
- R8. The hero card renders the following content per state. **All copy strings are directional — they require product owner approval before they ship. Suggestions and improvements during planning are actively welcome.**

| # | Condition | Card headline | Card body |
|---|---|---|---|
| 1 | `userStatus = alumni` *(evaluated first, overrides all)* | "Hi [firstName]" | *(none)* |
| 2 | `active` + member + mandate active | "Hi [firstName]" | "Thank you for being part of START Berlin." |
| 3 | `active` + supporting\_alumni + mandate active | "Hi [firstName]" | "Thank you for continuing to support START Berlin." |
| 4 | `active` + (member / supporting\_alumni) + customer ID set, no mandate ID | "Hi [firstName]" | "Your membership is active but there is a problem with your payment." |
| 5 | `active` + (member / supporting\_alumni) + no customer ID, no mandate ID | "Hi [firstName]" | "Your membership is active. We still need your payment details." |
| 6 | `processing` | "Your membership documents are being prepared" *(+ spinner)* | "This usually only takes a moment. The page will update automatically." |
| 7 | `manual_followup` | "We need a moment" | "We need to take a closer look. We'll reach out to you directly." |
| 8 | `application_pending` | "Fill out your membership application and join START Berlin e.V." | "The START Berlin board has invited you to submit your membership application and become an official member." |
| 9 | `membership_reconfirmation_pending` | "Confirm your START Berlin membership" | "We have you on record as a member, but we still need your official confirmation and a few details. This only takes a few minutes." |
| 10 | `cancelled` *(non-alumni)* | "Your membership has ended" | "Your START Berlin membership is no longer active. Get in touch if you have any questions." |
| 11 | All other states: no legalMembership, `admission_pending`, initial onboarding | "Welcome to START Berlin" | "Your membership details will appear here once your onboarding is complete." |

**Notice block**

- R9. A single notice block appears below the hero card when an action is required. At most one notice is shown at a time.
- R10. Membership actions take priority over payment actions. A payment notice is only shown when `legalMembership.status === "active"` and no membership notice applies.
- R11. Membership action notices (highest priority, one at a time, directional copy requires approval):
  - `application_pending`: "Fill out your membership application — a few details are needed to generate your membership documents. This only takes a few minutes." + "Start application" button → `/membership/application/personal-information`
  - `membership_reconfirmation_pending`: "Confirm your membership — we need a few details to confirm your membership. This only takes a few minutes." + "Confirm membership" button → `/membership/application/personal-information`
  - `manual_followup`: informational only, no CTA button — shows contact email `hello@startberlin.com`
- R12. Payment action notices (shown only when membership is active and no membership notice applies, directional copy requires approval):
  - No customer ID, no mandate ID: "Set up your yearly membership payment — START Berlin membership costs 40 EUR per year. It covers the essentials that keep the association running and helps fund events and member benefits throughout the year." + "Set up payment" button
  - Customer ID set, no mandate ID: payment problem copy + CTA to re-add payment details (exact recovery flow determined during planning)
- R13. The alumni state (row 1) shows an informational notice with no CTA: the member is no longer part of START Berlin e.V. but is welcome to rejoin if they would like. No rejoin flow exists yet.
- R14. States with no notice (rows 2, 3, 6, 10, 11): the notice block is absent and the badge does not appear.

**Contact details card**

- R15. A read-only contact details card appears below the hero card (and any notice block). It shows: personal email, phone, workspace email (read-only), and address fields.
- R16. The contact details card has an "Edit details" link that navigates to the membership settings subpage (R17).

**Membership settings subpage**

- R17. A new settings subpage at `/membership/settings` allows the member to edit their contact details: personal email, phone, street, city, state/region, zip, and country.
- R18. The settings subpage is styled and structured consistently with the membership application form steps — same form layout, label conventions, and field helper text approach.
- R19. The workspace email field is shown as read-only in settings (it comes from Google Workspace and cannot be changed by the member).

**Page structure**

- R20. Data fetching for the membership page is consolidated in the server component (`page.tsx`): current user, active legal membership, and membership state are fetched once and passed down. No duplicate fetches across child components.
- R21. The hero card logic is centralised in a single component that derives its render state from a well-defined input — replacing the current delegation chain (`MembershipTaskCard` → `MembershipSection`) with a single component that handles all states.
- R22. Existing behaviour is unchanged: the Tools section (Slack, Notion cards) below the main card; React Query polling on the processing state; the application form itself.

---

## Acceptance Examples

- AE1. **Covers R6, R14.** Given `legalMembership.status = admission_pending`, when the member opens their membership page, the hero card shows "Welcome to START Berlin" with onboarding copy and no notice block or badge appears.
- AE2. **Covers R5, R10, R12.** Given `legalMembership.status = active`, `userStatus = member`, `gocardlessMandateId = null`, and `gocardlessCustomerId = null`, when the member opens their membership page, the hero card shows "Hi [firstName]" / "Your membership is active. We still need your payment details." and a payment setup notice is shown below.
- AE3. **Covers R7, R12.** Given `legalMembership.status = active`, `gocardlessCustomerId` is set, and `gocardlessMandateId = null`, when the member opens their membership page, the hero card body reads "Your membership is active but there is a problem with your payment." and the payment problem notice is shown.
- AE4. **Covers R9, R10.** Given `legalMembership.status = application_pending` and payment has not been set up, when the member opens their membership page, the membership application notice is shown — not a payment notice.
- AE5. **Covers R2, R14.** Given `legalMembership.status = active`, `userStatus = member`, and `gocardlessMandateId` is set, when the member opens their membership page, the hero card shows "Hi [firstName]" / "Thank you for being part of START Berlin." and no notice or badge appears.
- AE6. **Covers R1, R13.** Given `userStatus = alumni`, when the member opens their membership page, the alumni informational notice is shown regardless of `legalMembership` state or payment state.
- AE7. **Covers R3, R14.** Given `legalMembership.status = processing`, when the member opens their membership page, the hero card displays a spinner alongside "Your membership documents are being prepared" and no notice block is shown.

---

## Success Criteria

- A member in the active state with payment set up sees a calm, action-free page: "Hi [firstName]" + thank-you copy, contact details card, and tools section — nothing requiring attention.
- A member who needs to take an action (apply, confirm, set up payment) sees exactly one notice block with a clear CTA. Membership actions always precede payment actions.
- The hero card renders from a single, well-defined state input with no payment logic embedded in it and no overlapping delegation chains.
- Copy for every state follows the tone-of-voice guide (warm, outcome-first, no provider terminology) and has been approved by the product owner before shipping.

---

## Scope Boundaries

- The `...` lifecycle menu (update payment details, view payment history, end membership) is not in scope.
- Payment pages, GoCardless flows, and mandate management are out of scope — this work introduces the notice block pointing to them, not the flows themselves.
- Backend changes, schema changes, and Inngest workflow changes are out of scope.
- The membership application form (`/membership/application/[step]`) is unchanged.
- A rejoin flow for alumni members is out of scope — the informational notice is a placeholder for a future feature.

---

## Key Decisions

- **Hero card shows no payment logic.** The membership card is the member's legal status view. Payment information belongs in the notice block and the payments page — separating them here prevents the card from becoming a billing interface as both journeys evolve independently.
- **`admission_pending` is opaque.** Members are not informed of the board review process until their application is ready (`application_pending`). This avoids creating expectations or anxiety around a step they cannot influence.
- **Alumni check is evaluated first.** `userStatus === "alumni"` overrides all legalMembership signals. Alumni status is an operational classification that supersedes active legal membership records; billing and legal membership are irrelevant to the alumni view.
- **Mandate-cancelled state is distinct from never-set-up.** `gocardlessCustomerId` exists but `gocardlessMandateId` is null means a mandate was cancelled, not that payment was never attempted. These two cases have different copy and potentially different recovery CTAs.
- **Copy is directional, not final.** All copy strings in R8 and R11–R13 are approved for use during planning but require explicit product owner sign-off before they ship. Improvements and suggestions during planning are actively welcome.

---

## Dependencies / Assumptions

- `gocardlessCustomerId` is available in the user record (confirmed in `src/db/schema/auth.ts`) but is not currently surfaced by `getStructuredMembershipState` — the state logic will need to be extended to distinguish the cancelled-mandate case (R7).
- The backward-compat path for imported members (`user.legalMembershipState === "active_member"` with no active `legalMembership` record) is treated as the active member state and resolves to rows 2–5 based on payment state.
- The membership application form at `/membership/application/personal-information` is the shared entry point for both `application_pending` and `membership_reconfirmation_pending` action notices.
- Contact details fields for the settings subpage: `personalEmail`, `phone`, `street`, `city`, `state`, `zip`, `country` (confirmed in `src/db/schema/auth.ts`). `email` (workspace email) is read-only.

---

## Outstanding Questions

### Resolve Before Planning

- None.

### Deferred to Planning

- [Affects R12][Technical] Determine the correct recovery CTA for the "mandate cancelled" payment state — the GoCardless re-mandate flow may differ from initial setup.
- [Affects R17][Needs research] Confirm whether the settings form should use the same multi-step server action pattern as the application steps or a simpler standalone save action.
- [Affects R19][Product] Confirm whether the workspace email field should be shown as read-only in the settings subpage or omitted entirely.
