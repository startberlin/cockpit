---
date: 2026-05-11
topic: safer-payments-manual-approval
---

# Safer Payments — Manual Finance Admin Approval

## Problem Frame

The current payment setup creates a GoCardless subscription automatically when a member's mandate is confirmed. This means GoCardless will auto-charge every year with no human in the loop. Even if the setup is correct today, there is real operational risk: a member could leave but still be charged, the amount could change, or an exception (hardship, timing) could go unnoticed.

The fix is to remove automatic recurring charging entirely and replace it with a per-cycle approval queue. A finance admin must explicitly approve every annual charge before any money moves. No charge ever happens automatically.

---

## Actors

- **A1. Finance admin**: A member holding the `head_of_finance` position or the new `finance_admin` app-level grant. Reviews and approves or declines pending charges on the Payments page.
- **A2. Member (subject of charge)**: Has set up a GoCardless mandate during onboarding. Is charged only after a finance admin approves.
- **A3. START Cockpit**: Creates `proposed` charge rows on schedule, executes charges via GoCardless one-time payments on admin approval, and tracks per-cycle status.
- **A4. GoCardless**: Executes one-time Direct Debit payments when instructed. Sends webhook confirmation when a payment settles.
- **A5. Inngest cron job**: Runs daily at 9 am. Detects members without current coverage and creates `proposed` rows if none exist.

---

## Key Flows

### F1. Finance admin reviews and approves a pending charge

- **Trigger:** A finance admin opens the Payments page.
- **Steps:** The page shows all `proposed` membership_payment rows where `activation_date <= today`. For each row the admin sees: member name, activation date, proposed amount (40 EUR), and the member's GoCardless payment history fetched live from the API. The admin clicks "Charge."
- **Outcome:** START Cockpit creates a GoCardless one-time Direct Debit payment against the member's stored mandate. The row status moves immediately to `pending`. Subsequent GoCardless webhooks advance the row through `submitted` → `confirmed` → `paid_out`, or terminate it at `failed`, `cancelled`, or `charged_back`.

### F2. Finance admin declines a charge

- **Trigger:** Finance admin decides a member should not be charged this cycle (e.g., they have already left, financial hardship arrangement, timing issue).
- **Steps:** Admin clicks "Decline" on a proposed row.
- **Outcome:** Row status moves to `declined`. The member is not charged. The row stays declined permanently; the cron job will create a new `proposed` row the next time it detects no current coverage.

### F3. Cron job creates a new charge proposal

- **Trigger:** Daily at 9 am. For each active member: check whether they have a `confirmed` or `paid_out` membership_payment row where `activation_date + 1 year > today`.
- **Steps:** If no coverage AND no `proposed` row already exists for this member → create a new `proposed` row with `activation_date = now`. If a `proposed` row already exists, skip (no duplicate). If coverage exists, skip.
- **Outcome:** Finance admin sees the new row on the Payments page immediately (activation_date is today).

### F4. Member is imported from an existing system with a known paid-through date

- **Trigger:** Admin imports a member who was paying manually (or via another system) and whose membership coverage runs until a known date.
- **Steps:** On import, START Cockpit creates a `proposed` membership_payment row with `activation_date = paid_through_date + 1 day`.
- **Outcome:** The row does not appear on the Payments page until that date arrives. The admin does not need to remember to act on it — it will surface automatically.

### F5. Mandate setup (onboarding, unchanged UX)

- **Trigger:** A new member completes profile onboarding.
- **Steps:** Member is directed to the GoCardless hosted flow to authorize a SEPA mandate. On redirect return, START Cockpit verifies the mandate, stores the mandate ID and GoCardless customer ID at the user level, and creates an initial `proposed` membership_payment row with `activation_date = today`.
- **Outcome:** No GoCardless subscription is created. The finance admin sees the proposed charge immediately on the Payments page.

---

## Requirements

### Membership payments data model

- **R1.** Replace the subscription-based `membership_payment` model with a per-cycle `membership_payments` table. Each row represents one annual payment cycle for one member.
- **R2.** Each `membership_payments` row has at minimum: `id`, `userId`, `status`, `activation_date`, `amount` (always 4000 EUR-cents for now), `gocardlessPaymentId` (populated on charge execution), `createdAt`, `updatedAt`.
- **R3.** Status values mirror the GoCardless payment lifecycle, with two pre-GoCardless states prepended:

  | Status | UI label | Set by |
  |---|---|---|
  | `proposed` | "Proposed" + Charge / Decline buttons | Row creation |
  | `declined` | "Declined" | Admin action |
  | `pending` | "Scheduled" | GoCardless payment creation (synchronous API response) |
  | `submitted` | "Sent to Bank" | `payments:submitted` webhook |
  | `confirmed` | "Confirmed" ✓ | `payments:confirmed` webhook |
  | `paid_out` | "Paid Out" | `payments:paid_out` webhook |
  | `failed` | "Failed" | `payments:failed` webhook |
  | `cancelled` | "Cancelled" | `payments:cancelled` webhook |
  | `charged_back` | "Charged Back" | `payments:charged_back` webhook |

  `pending` is set synchronously when the admin clicks "Charge" — no webhook polling required for that transition. All subsequent states are driven by webhooks.
- **R4.** The GoCardless mandate ID and GoCardless customer ID are stored at the user level, not per-cycle. Planning decides whether that means two columns on the `user` table or a thin per-user satellite record.
- **R5.** Remove `paidThroughAt` and `gocardlessSubscriptionId` from the active data model. Coverage is derived purely from `membership_payments` rows.
- **R6.** A member is "paid up" when their most recent `confirmed` or `paid_out` row satisfies `activation_date + 1 year > today`. Coverage is confirmed at `payments:confirmed` — `paid_out` is GoCardless's internal payout batch and does not affect the member's coverage date.
- **R7.** The `activation_date` of a new cycle row is always the previous cycle's `activation_date + 1 year` (not the approval date). For first-time charges, `activation_date = today` at row creation.

### Cron job

- **R8.** An Inngest cron function runs daily at 9 am and checks every active member for current coverage (R6).
- **R9.** If a member has no current coverage AND no `proposed` or `pending` or `submitted` row exists: create a `proposed` row with `activation_date = now`. Rows in-flight (`pending`, `submitted`) count as active attempts and suppress duplicate proposals.
- **R10.** If a `proposed` row already exists for a member (any in `proposed` state): do not create another. One pending proposal per member at a time.
- **R11.** The cron job is idempotent: running it twice in one day produces the same outcome as running it once.

### Payments page

- **R12.** A new Payments page is added to the app, accessible only to members holding the `head_of_finance` position or the `finance_admin` grant.
- **R13.** The Payments page shows all `membership_payments` rows for the current member set, grouped or sorted by status. Rows with `activation_date > today` are hidden (future proposals not yet due).
- **R14.** All active statuses are visible in the table with their UI labels (R3). The admin can see at a glance which members are proposed, in-flight at each GoCardless stage, confirmed, or in a failed/charged-back state. No spinner is shown — status labels are sufficient. Because SEPA Core Direct Debit takes days to progress through `submitted` → `confirmed`, no real-time polling is required; a normal page reload reflects the latest webhook-driven state.
- **R15.** For each row, the page displays: member name, activation date, proposed amount, and the member's GoCardless payment history fetched live from the GoCardless API.
- **R16.** Each `proposed` row has a "Charge" action. Clicking it triggers a GoCardless one-time Direct Debit payment and moves status to `accepted`. The GoCardless payment ID is stored on the row.
- **R17.** Each `proposed` row has a "Decline" action. Clicking it moves status to `declined`.
- **R18.** Charging and declining must be idempotent server actions — double-submitting "Charge" does not create a second GoCardless payment.

### Authorization

- **R19.** A new `finance_admin` app-level grant is added to the permission system alongside the existing `head_of_finance` position.
- **R20.** The `finance_admin` grant can be assigned to any member without requiring them to hold a formal organization position.
- **R21.** Server-side enforcement on the Payments page and its actions requires either `head_of_finance` or `finance_admin`. Client UI gates (`<Can>` / `useCan()`) hide the Payments nav entry for members without either.

### GoCardless integration

- **R22.** No GoCardless subscription is created at any point in the new flow. The mandate authorization (hosted GoCardless flow) during onboarding is unchanged; only the post-mandate step changes.
- **R23.** Each finance admin approval creates a GoCardless one-time payment resource against the member's stored mandate. Amount: 4000 EUR-cents.
- **R24.** START Cockpit listens for these GoCardless payment webhook events on the existing `/api/gocardless/webhooks` handler, mapping each to the corresponding local status:

  | Webhook event | Local status |
  |---|---|
  | `payments:submitted` | `submitted` |
  | `payments:confirmed` | `confirmed` |
  | `payments:paid_out` | `paid_out` |
  | `payments:failed` | `failed` |
  | `payments:cancelled` | `cancelled` |
  | `payments:charged_back` | `charged_back` |

  All handlers are idempotent — receiving the same event twice does not change an already-advanced status.

- **R25.** A failed payment (`failed` status) can be retried via the GoCardless `POST /payments/{id}/actions/retry` endpoint (up to 3 times, only while the mandate is active). Retrying resets the row back to `pending` and the webhook cycle resumes. Whether the UI exposes a Retry button is a planning decision.
- **R25.** GoCardless payment history shown on the Payments page is fetched live from the GoCardless API (payments against the member's customer/mandate), not from local rows.

### Import / transition

- **R26.** When a member is imported with a known paid-through date, START Cockpit creates a `proposed` membership_payment row with `activation_date = paid_through_date + 1 day`.
- **R27.** This row does not appear on the Payments page until `activation_date <= today`, so the admin is not prompted to act prematurely.

---

## Acceptance Examples

- **AE1. Covers R6, R13, R15.** Given a member's `executed` payment has `activation_date` of 2025-03-01, on 2026-03-02 the cron job creates a `proposed` row with `activation_date = 2026-03-01`. The Payments page shows it that same morning with the member's GoCardless history alongside.

- **AE2. Covers R16, R18, R24.** Finance admin clicks "Charge" on a proposed row. START Cockpit calls GoCardless, records the payment ID, sets status to `accepted`. A few days later GoCardless sends a payment-confirmed webhook. Status moves to `executed`. Clicking "Charge" a second time before the status changes does not create a second GoCardless payment.

- **AE3. Covers R10, R11.** Cron runs at 9 am and creates a `proposed` row for a member without coverage. If the cron runs again at 9 am the next day and the row is still `proposed`, no second row is created.

- **AE4. Covers R17.** Admin clicks "Decline" on a proposed row. Status moves to `declined`. The row disappears from the active queue. The next cron run detects no coverage and no existing `proposed` row, so it creates a fresh `proposed` row with `activation_date = now`.

- **AE5. Covers R26, R27.** A member is imported with a paid-through date of 2026-12-31. A `proposed` row is created with `activation_date = 2027-01-01`. The Payments page does not show this row until January 1, 2027.

- **AE6. Covers R7.** Admin approves a charge on 2026-05-20 for a row with `activation_date = 2026-05-01`. The next cycle's `activation_date` is 2027-05-01, not 2027-05-20. The two-week approval delay does not compress the member's coverage period.

- **AE7. Covers R19–R21.** A member without the `head_of_finance` position is assigned the `finance_admin` grant. They can access the Payments page and approve charges. A member with neither cannot see the Payments nav entry and cannot reach the page directly.

---

## Success Criteria

- No member is ever charged without an explicit finance admin action.
- Finance admins see exactly who needs to be charged and can review GoCardless history before deciding.
- The "one year later" cycle is date-accurate: coverage starts from `activation_date`, not from the approval date.
- The cron job never creates duplicate proposals.
- The `finance_admin` grant can be assigned without giving someone the `head_of_finance` position.

---

## Scope Boundaries

- Existing active GoCardless subscriptions are not automatically cancelled or migrated. Migration plan is deferred to planning.
- GoCardless payment failures (e.g., insufficient funds after `accepted` status) are out of scope — to be addressed in a follow-up.
- Member-facing notification when a charge is executed is out of scope.
- Custom per-member amounts are out of scope — all charges are 40 EUR.
- No refund or charge reversal workflow.
- Payments page is a queue and approval surface only — not a full payment audit dashboard.

---

## Key Decisions

- **Mandate at user level, cycles in membership_payments:** Keeps the per-cycle table simple (no repeated GoCardless setup data) while the mandate/customer ID travels with the user.
- **activation_date governs coverage, not approval date:** Protects members from losing coverage days due to admin processing delay.
- **One proposal at a time per member:** Prevents admin confusion from stacked proposals. Cron skips members with an open `proposed` row.
- **Task system skipped:** The `membership_payments` table itself serves as the work queue. The Payments page queries it directly — no separate task records needed.
- **finance_admin grant separate from head_of_finance position:** Allows delegating payment access without assigning a formal org position.

---

## Dependencies / Assumptions

- The GoCardless mandate collected during onboarding is a durable SEPA Core Direct Debit mandate and remains usable for one-time payments years after setup.
- GoCardless one-time payments against a confirmed mandate are supported without re-authorizing the hosted flow.
- The existing `head_of_finance` position in `src/lib/authority/model.ts` is the correct authority anchor; no new org positions are needed.
- The existing GoCardless webhook handler (`/api/gocardless/webhooks`) can be extended to handle payment settlement events.
- Inngest supports cron scheduling (already in use for other workflows).

---

## Outstanding Questions

### Resolve Before Planning

_None — all pre-planning questions resolved via GoCardless sandbox inspection and API docs (2026-05-11)._

- **Webhook events** (resolved): full status map in R24. All nine statuses (two pre-GC + seven GC-driven) confirmed from live sandbox events and `POST /payments` API spec.
- **Failed payment handling** (resolved): `failed`, `cancelled`, and `charged_back` are terminal rows. The cron job re-proposes when no in-flight or covered row exists.
- **Retry** (resolved): GoCardless supports `POST /payments/{id}/actions/retry` up to 3 times on an active mandate; retrying resets the row to `pending`.

### Deferred to Planning

- Exact schema: whether the mandate ID and GoCardless customer ID go on the `user` table or a thin satellite record.
- Migration plan for members currently on active GoCardless subscriptions.
- Whether the existing `membership_payment` (singular) table is repurposed, renamed, or dropped.
- Navigation placement for the new Payments page.
- Exact GoCardless API call for a one-time Direct Debit payment against a mandate.

---

## Next Steps

-> `/ce-plan` for structured implementation planning
