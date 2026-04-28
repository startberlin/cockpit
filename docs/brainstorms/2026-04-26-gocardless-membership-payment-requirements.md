---
date: 2026-04-26
topic: gocardless-membership-payment
---

# GoCardless Membership Payment

## Problem Frame

START Cockpit needs a final membership activation step after a user has completed onboarding details. Admins should be able to see that the person has technically completed onboarding, but the member should still be guided through a final onboarding-style payment step until GoCardless confirms their yearly membership subscription.

The first version should use GoCardless to set up the yearly 40 EUR membership subscription through subscription template `PL01KF12SSWH7XMHG49RY0RF8KYZ`. It should not collect a separate instant first-year payment.

---

## Actors

- A1. Member: Completes onboarding, starts the GoCardless hosted payment flow, and becomes a full member after successful subscription setup.
- A2. Admin: Reviews people and should understand whether a person is still onboarding, payment-pending, or a full member.
- A3. GoCardless: Hosts the subscription setup flow and sends redirect/webhook signals about the resulting billing state.
- A4. START Cockpit: Stores local membership/payment state, starts the GoCardless flow, and reconciles callbacks/webhooks idempotently.

---

## Key Flows

- F1. Payment-pending member sees final onboarding step
  - **Trigger:** A member has completed required onboarding profile details but has not completed GoCardless subscription setup.
  - **Actors:** A1, A4
  - **Steps:** The member can access the existing membership onboarding screen; the top copy explains that they can finalize membership by setting up the yearly membership payment; a clear button starts the GoCardless hosted flow.
  - **Outcome:** The user is treated as payment-pending from their own point of view even though profile onboarding is complete.
  - **Covered by:** R1, R2, R4

- F2. Member starts GoCardless subscription setup
  - **Trigger:** The payment-pending member clicks the payment button.
  - **Actors:** A1, A3, A4
  - **Steps:** START Cockpit creates or reuses the local payment attempt for the current user, sends known customer details to GoCardless where supported, creates the hosted GoCardless flow for template `PL01KF12SSWH7XMHG49RY0RF8KYZ`, and redirects the member to GoCardless.
  - **Outcome:** The member completes subscription setup in GoCardless without START Cockpit creating duplicate customer or subscription records for repeat attempts.
  - **Covered by:** R3, R5, R6, R7

- F3. GoCardless confirms subscription setup
  - **Trigger:** GoCardless redirects the member back or sends webhook events after successful setup.
  - **Actors:** A1, A3, A4
  - **Steps:** START Cockpit reconciles the GoCardless identifiers to the local user, records the subscription/customer state, handles duplicate or out-of-order signals safely, and promotes the member to full member status only after success is confirmed.
  - **Outcome:** The member is no longer shown the onboarding payment prompt and is treated as a full member.
  - **Covered by:** R8, R9, R10

- F4. Admin views completed onboarding
  - **Trigger:** An admin views the people table or member details for a user who has completed profile onboarding but has not paid yet.
  - **Actors:** A2, A4
  - **Steps:** START Cockpit shows that profile onboarding is complete, distinguishes the pending payment state from full membership, and does not offer the "Complete onboarding" action again.
  - **Outcome:** Admins do not re-run onboarding completion for users who are only waiting on payment.
  - **Covered by:** R1, R11, R12

---

## Requirements

**Membership state**
- R1. START Cockpit must distinguish profile onboarding completion from paid membership activation.
- R2. A user who has completed profile onboarding but has not completed payment must still see an onboarding-style membership screen from their own point of view.
- R3. Payment/membership state should be modeled separately from the existing `user.status` lifecycle rather than adding another broad user status.
- R4. The membership onboarding screen copy must change for payment-pending users to say they can finalize membership by setting up the membership payment.

**GoCardless flow**
- R5. The first version must use GoCardless subscription template `PL01KF12SSWH7XMHG49RY0RF8KYZ`.
- R6. The membership subscription is 40 EUR yearly.
- R7. START Cockpit must prefill known user details in the GoCardless flow where GoCardless supports it.
- R8. START Cockpit must identify GoCardless customers and flows with local user identifiers such as `start_cockpit_user_id` and `start_cockpit_user_email` where GoCardless metadata or custom fields support it.
- R9. START Cockpit must avoid creating or billing duplicate GoCardless customers/subscriptions for repeat attempts by the same user.

**Reconciliation and activation**
- R10. A user becomes a full member only after START Cockpit has confirmed successful subscription setup from GoCardless redirect and/or webhook processing.
- R11. Webhook/callback processing must be idempotent so duplicate GoCardless events do not create duplicate local state transitions.
- R12. Admin views must make payment-pending users visibly different from users who are still filling out onboarding details and from full members.
- R13. Admin actions must not offer "Complete onboarding" for users whose profile onboarding is already complete, even if their payment is still pending.

---

## Acceptance Examples

- AE1. **Covers R1, R2, R4.** Given a user has completed all onboarding profile fields but has no confirmed GoCardless subscription, when they open the membership page, they see the existing onboarding-style page with payment-specific copy and a button to start GoCardless setup.
- AE2. **Covers R10.** Given a payment-pending user completes the GoCardless hosted flow successfully, when START Cockpit receives a valid success signal and reconciles it to the user, the user is promoted to full member and no longer sees the payment prompt.
- AE3. **Covers R11.** Given GoCardless sends the same success webhook more than once, when START Cockpit processes both deliveries, only one local subscription/customer association and one membership activation are recorded.
- AE4. **Covers R12, R13.** Given an admin views a user who completed profile onboarding but has not paid, when the admin opens the people table actions, "Complete onboarding" is not shown and the user is marked as payment-pending rather than full member.

---

## Success Criteria

- Members who have finished profile onboarding understand the final payment step and can complete subscription setup without admin help.
- Admins can clearly tell the difference between profile onboarding, payment-pending membership, and full membership.
- Repeated clicks, retries, redirects, and duplicate webhooks do not create duplicate GoCardless customers, subscriptions, or local membership transitions.
- A planner can proceed without inventing the product behavior for state, admin visibility, GoCardless flow shape, or activation rules.

---

## Scope Boundaries

- Do not collect a separate instant first-year payment in v1.
- Do not add a new broad `user.status` solely for payment-pending membership if separate payment/membership state can express it.
- Do not build custom GoCardless payment pages in v1; use the hosted GoCardless flow.
- Do not solve alumni, cancellation, failed renewal, refund, or subscription pause workflows in this brainstorm.
- Do not redesign the membership page beyond the payment-pending prompt and entry point required for this flow.

---

## Key Decisions

- Use subscription template only: This avoids coordinating an instant first payment with a subscription whose first charge would otherwise need to be postponed for one year.
- Keep payment state separate from user lifecycle status: Admins need to know profile onboarding is complete, while members should still experience the final payment step as part of onboarding.
- Use GoCardless-hosted flow: It minimizes payment UX and compliance surface for v1.
- Store local and GoCardless identifiers together: This supports idempotency and duplicate-prevention during retries and webhook processing.

---

## Dependencies / Assumptions

- GoCardless subscription template `PL01KF12SSWH7XMHG49RY0RF8KYZ` exists in the intended GoCardless environment and represents a 40 EUR yearly membership subscription.
- GoCardless can either attach metadata/custom fields with local user identifiers to the relevant customer/subscription resources or START Cockpit can maintain an equivalent local mapping from GoCardless IDs to user IDs.
- The existing membership page and admin people table are the primary surfaces for v1.
- Existing onboarding profile completion is currently derived from required user profile fields, not from `user.status` alone.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R5, R7, R8][Needs research] Verify the exact GoCardless API path for starting a hosted flow from subscription template `PL01KF12SSWH7XMHG49RY0RF8KYZ`, including whether the `PL` identifier is a payment link/template product rather than a Billing Request template ID.
- [Affects R8][Needs research] Verify which GoCardless resources in this flow support metadata/custom fields and what key/value limits apply.
- [Affects R10, R11][Technical] Decide which GoCardless webhook event types are authoritative for activating full membership.
- [Affects R12][Product/UI] Decide the exact admin label for payment-pending users.

---

## Next Steps

-> /ce-plan for structured implementation planning
