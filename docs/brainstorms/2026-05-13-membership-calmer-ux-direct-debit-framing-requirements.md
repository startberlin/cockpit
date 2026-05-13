---
date: 2026-05-13
topic: membership-calmer-ux-direct-debit-framing
---

# Membership Page: Calmer UX & Direct Debit Framing

## Summary

Replace the alarm-style amber notice block and "Action required" badge on the membership page with a calm task-card pattern. Reframe all payment-related copy — across the notice block, hero card body, and payment button — to accurately describe direct debit mandate setup rather than payment collection, emphasizing convenience and user control.

---

## Problem Frame

The membership page's notice block uses `TriangleAlertIcon`, an amber background, and an amber border uniformly across all notice states — application pending, payment not started, mandate cancelled, and manual followup. Most of these states are simply "next steps" rather than emergencies, but the uniform alarm aesthetic creates anxiety disproportionate to the actual urgency.

The "Action required" badge in the hero card amplifies this — it's the same label regardless of whether the user needs to fill out a form, authorize a direct debit, or is simply waiting for manual review.

Payment-related copy further misrepresents what is happening: GoCardless is being used to collect a signed mandate for future one-off payment collection, not to take a payment immediately. This wrong framing appears in multiple places: "Set up your yearly membership payment" (notice title), "Set up payment" (button), "Opening payment..." (loading state), "We still need your payment details" (hero body for `active_no_payment`), and "there is a problem with your payment" (hero body for `active_cancelled`). All of these either imply an imminent charge or use alarming language that is disproportionate to the actual situation.

---

## Requirements

**Notice block visual style**

- R1. The notice block background changes from amber (`bg-amber-50`) to a soft blue info style (`bg-blue-50`, `border-blue-200`) for actionable notices (application pending, payment not started, payment cancelled, membership reconfirmation pending).
- R2. The icon color changes from `text-amber-700` to `text-blue-600` for actionable notices.
- R3. `TriangleAlertIcon` is replaced with a contextually appropriate icon per notice type (see Acceptance Examples).
- R4. Passive notices (alumni, manual followup) retain a neutral style (`bg-secondary/50`, `border-border`) and use an informational icon rather than `TriangleAlertIcon`.

**Notice copy — per state**

- R5. `payment_not_started` notice title: "Set up your direct debit". Body: "Authorize your annual membership fee to be collected automatically. You'll be notified in advance of each payment and can cancel at any time."
- R6. `payment_cancelled` notice title: "Update your direct debit". Body: "Your direct debit authorization has expired or been cancelled. Set up a new one to keep your membership running smoothly."
- R7. `application_pending` copy is unchanged (title and body are already appropriate in tone).
- R8. `membership_reconfirmation_pending` copy is unchanged.
- R9. `manual_followup` copy is unchanged.
- R10. `alumni` copy is unchanged.

**Hero card body copy**

- R11. `active_no_payment` hero body changes from "Your membership is active. We still need your payment details." to "Your membership is active. Just one step left — set up your direct debit to complete your account."
- R12. `active_cancelled` hero body changes from "Your membership is active but there is a problem with your payment." to "Your membership is active. Your direct debit authorization needs updating."

**Payment button**

- R13. The payment button label changes from "Set up payment" to "Set up direct debit" in the initial setup context (`payment_not_started`).
- R14. The payment button label in the update context (`payment_cancelled`) reads "Update direct debit".
- R15. The loading state changes from "Opening payment..." to "Opening bank authorization..." in both contexts.

**Hero card badge**

- R16. The "Action required" badge in the hero card is replaced with a task-specific short label per notice type:
  - `application_pending` → "Application pending"
  - `membership_reconfirmation_pending` → "Confirmation needed"
  - `payment_not_started` → "Direct debit needed"
  - `payment_cancelled` → "Direct debit expired"
  - `manual_followup` → badge is hidden (passive state, user is waiting — no action)
  - `alumni` → badge is hidden (passive state)
- R17. The badge styling changes from amber (`border-amber-700/30`, `text-amber-700`, `bg-amber-700` dot) to a neutral muted style that does not suggest alarm.

---

## Acceptance Examples

- AE1. **Covers R1, R2, R3, R5, R11, R13, R15.** Given a member with `payment_not_started`, the notice block shows a soft blue card with a bank/mandate-appropriate icon, title "Set up your direct debit", body mentioning automatic collection and advance notification, and a button labelled "Set up direct debit" that shows "Opening bank authorization..." while loading. The hero card body reads "Your membership is active. Just one step left — set up your direct debit to complete your account." The hero badge reads "Direct debit needed" in a neutral muted style.

- AE2. **Covers R1, R2, R3, R6, R12, R14, R15.** Given a member with `payment_cancelled`, the notice block shows a soft blue card with title "Update your direct debit", body mentioning the authorization has expired, and a button labelled "Update direct debit". The hero card body reads "Your membership is active. Your direct debit authorization needs updating." The hero badge reads "Direct debit expired".

- AE3. **Covers R4, R16.** Given a member with `manual_followup`, the notice block uses neutral styling (no blue), and the hero card shows no badge.

- AE4. **Covers R16, R17.** Given a member with `application_pending`, the hero card shows a muted badge reading "Application pending" — no amber color, no "Action required" text.

---

## Success Criteria

- A member seeing the page for the first time understands they need to authorize a direct debit — not that they are being charged immediately.
- No amber coloring appears on the membership page for any notice state or badge.
- The notice block, hero card body, and badge all communicate the specific task for each state rather than a generic alarm.
- The word "payment" does not appear in any copy surface where the actual action is setting up or updating a direct debit mandate.

---

## Scope Boundaries

- No changes to the application form flow itself (`/membership/application/*`).
- No changes to the overall layout or structure of the membership page.
- No changes to the mandate flow logic, GoCardless integration, or server actions.
- The GoCardless-hosted page copy (outside this app) is out of scope.

---

## Key Decisions

- **Soft blue for actionable notices, neutral for passive ones**: Blue is "something to do" without alarm; neutral avoids drawing attention to states where the user is simply waiting.
- **Badge hidden for manual_followup and alumni**: These are passive/resolved states — surfacing a badge implies the user should act when they cannot or need not.
- **"Bank authorization" in loading state rather than "payment"**: Accurately describes what GoCardless is doing (mandate signing) and avoids implying a charge is happening.
