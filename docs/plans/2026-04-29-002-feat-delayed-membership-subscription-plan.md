---
title: "feat: Add delayed membership subscription start"
type: feat
status: completed
date: 2026-04-29
origin: docs/brainstorms/2026-04-28-google-workspace-existing-user-linking-requirements.md
---

# feat: Add Delayed Membership Subscription Start

## Overview

Correct the imported-member billing lifecycle so imported members can set up GoCardless billing immediately while START Cockpit delays the first yearly charge until after their already-paid membership period ends.

The important architectural choice is to keep billing unified: imported members, newly onboarded members, retries, the GoCardless return page, and any webhook-backed repair should all use the same membership payment row and the same finalization service that creates the GoCardless subscription. Import should only contribute the covered-through date; it should not create a separate manual-active membership mode that hides billing setup.

---

## Problem Frame

The import feature currently captures a paid-through date, but the billing semantics are wrong: imported paid-through users are treated like manually active members until the date expires. That prevents the desired behavior. They should be asked to set up their membership billing now, just like newly onboarded members, but GoCardless should not collect the first annual membership fee until after the imported paid-through date.

This plan follows the origin document's revised membership timing requirements (see origin: `docs/brainstorms/2026-04-28-google-workspace-existing-user-linking-requirements.md`) and focuses specifically on integrating GoCardless `start_date` into the existing membership flow.

---

## Requirements Trace

- R18. The import flow must capture whether the imported user is already covered by a prior membership payment.
- R19. If covered, START Cockpit must capture the paid-through date needed to determine the first future GoCardless charge date.
- R20. Imported users with remaining paid membership time must still be asked to set up GoCardless payment/subscription promptly.
- R21. Imported users must be able to set up membership payment without completing profile onboarding first.
- R22. For imported users with a paid-through date, the GoCardless subscription must start after that date.
- R23. New users who complete onboarding through the normal flow must still be asked to start membership payment immediately.

**Origin actors:** A1 Import admin, A3 Existing Workspace user, A5 START Cockpit
**Origin flows:** F3 Imported user reaches membership payment
**Origin acceptance examples:** AE6 imported paid-through member can set up GoCardless now with first charge after paid-through date, AE7 normal onboarding still starts payment immediately

---

## Scope Boundaries

- Do not add a second billing implementation for imports.
- Do not delay showing the payment setup UI until the paid-through date.
- Do not model full historical membership payments or invoice history.
- Do not change the annual 40 EUR membership amount or yearly interval.
- Do not switch the whole flow to Billing Request `subscription_request` as part of this plan; START Cockpit should keep the current mandate-first flow and add `start_date` to explicit subscription creation.
- Do not require imported members to finish profile onboarding before payment setup.
- Do not change Alumni or Supporting Alumni import billing behavior; this plan only concerns imported users with Member status.

---

## Context & Research

### Relevant Code and Patterns

- `src/app/(authenticated)/(app)/people/import-google-user-action.ts` currently writes imported paid-through users as `provider: "manual"` and `status: "active"`. This is the main behavior to correct.
- `src/db/schema/membership.ts` already has `paidThroughAt`, GoCardless provider identifiers, and one membership row per user.
- `src/db/membership.ts` owns creation and mutation helpers for membership rows and should stay the central persistence boundary.
- `src/app/(authenticated)/(app)/membership/start-payment-action.ts` is the single entry point for starting membership billing setup.
- `src/app/(authenticated)/(redirect)/membership/payment-return/page.tsx`, `payment-return-redirect.tsx`, and `finalize-payment-action.ts` are the user-facing return path from GoCardless. The client redirect component calls the server action, and that server action delegates to `reconcileMembershipPaymentForUser`.
- `src/lib/gocardless/membership-flow.ts` creates the Billing Request / Billing Request Flow and later creates the yearly subscription.
- `src/lib/gocardless/membership-reconciliation.ts` is the existing shared finalization/reconciliation path that verifies the mandate and calls `createMembershipSubscription`; it is used by the GoCardless return page today and is the right single place for delayed subscription start behavior.
- `src/lib/membership-status.ts` decides whether the membership page shows profile onboarding, payment pending, payment processing, or full member.
- `src/app/(authenticated)/(app)/membership/onboarding.tsx` owns the payment setup copy that must tell imported paid-through members they are covered until a specific date.
- `src/lib/gocardless/membership-flow.test.ts` and `src/lib/membership-status.test.ts` are the closest existing test patterns.
- This repo uses Node's built-in test runner via `node --import tsx --test` and does not currently have a React component testing harness, so UI copy logic should be factored into small pure helpers when it needs direct automated coverage.

### Institutional Learnings

- No `docs/solutions/` directory exists in this repo, so there were no local institutional learnings to apply.

### External References

- GoCardless subscriptions support `start_date` as the first payment charge date and require it to be on or after the mandate's `next_possible_charge_date`. Source: [GoCardless API reference](https://developer.gocardless.com/api-reference).
- GoCardless Billing Request `subscription_request[start_date]` exists, but the API reference shows Billing Request subscription request currency/support constraints that do not match START Cockpit's current SEPA mandate-first implementation. The safer integration is to continue creating the mandate through Billing Requests, then pass delayed start date when creating `/subscriptions`. Source: [GoCardless API reference](https://developer.gocardless.com/api-reference).

---

## Key Technical Decisions

- **Use the existing membership row as the single billing state:** Imported member coverage is `paidThroughAt` on the same `membership_payment` row used by normal GoCardless setup, not a separate manual-active membership path.
- **Keep imported paid-through rows payment-setup eligible:** Import should create or leave a pending GoCardless-capable membership payment row with `paidThroughAt`, so the member sees the normal payment setup CTA immediately.
- **Compute delayed subscription start once, near subscription creation:** Convert `paidThroughAt` into a subscription first-charge date in the shared payment finalization/reconciliation boundary that the GoCardless return page calls, where the mandate ID is known and the subscription is created.
- **Treat paid-through dates as inclusive:** If an admin enters "paid through 2026-09-30", the earliest intended first charge date is 2026-10-01, subject to GoCardless mandate timing.
- **Keep `start_date` optional:** Normal newly onboarded members and imported members without paid-through coverage should omit `start_date`, preserving immediate-first-charge behavior.
- **Inform users at setup time, not only at import:** The membership billing UI must tell covered imported members that their membership fee is paid until X and that setting up GoCardless now will not charge them before the current period ends.

---

## Open Questions

### Resolved During Planning

- **Where should delayed billing be integrated?** In the existing GoCardless subscription creation path, not in import-specific billing code.
- **Should imported paid-through members skip billing setup until the paid-through date?** No. They should set up payment promptly; only the first charge is delayed.
- **Should profile onboarding block imported member payment setup?** No. Imported Members can set up billing before finishing profile onboarding, while non-imported users keep the existing onboarding prerequisite.
- **What date should be sent to GoCardless?** The day after the paid-through date, because the admin-entered date is a covered-through date.

### Deferred to Implementation

- **Exact local helper names:** Choose names that fit the edited modules during implementation.
- **Timezone normalization details:** Implementation should normalize date-only admin input into a stable date-only subscription start value and avoid leaking end-of-day timestamps into GoCardless payloads.
- **Provider error copy:** If GoCardless rejects `start_date` because of mandate timing or validation, implementation should map that through the existing payment setup error path with a concise user-facing message.

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```mermaid
sequenceDiagram
    participant Admin as Import admin
    participant Import as Import action
    participant DB as membership_payment
    participant Member as Imported member
    participant UI as Membership UI
    participant Start as start-payment-action
    participant Recon as finalization service
    participant GC as GoCardless

    Admin->>Import: Import Member with paid-through date
    Import->>DB: Create pending membership row with paidThroughAt
    Member->>UI: Open /membership
    UI-->>Member: Explain paid until X; show billing setup CTA
    Member->>Start: Start membership payment setup
    Start->>GC: Create mandate Billing Request Flow
    GC-->>Member: Hosted mandate setup
    Member->>Recon: Return from GoCardless
    Recon->>DB: Read paidThroughAt from same payment row
    Recon->>GC: Create yearly subscription with start_date = day after X
    Recon->>DB: Activate same membership row with subscription ID
```

---

## Implementation Units

- U1. **Correct Imported Membership Row Semantics**

**Goal:** Make import store paid-through coverage without marking the user manually active or bypassing billing setup.

**Requirements:** R18, R19, R20, R22, AE6

**Dependencies:** None

**Files:**
- Modify: `src/app/(authenticated)/(app)/people/import-google-user-action.ts`
- Modify: `src/db/membership.ts`
- Test: `src/app/(authenticated)/(app)/people/import-google-user-action.test.ts`

**Approach:**
- Change imported Member payment rows so `paidThroughAt` records coverage but the row remains eligible for GoCardless setup.
- Avoid `provider: "manual"` and `status: "active"` for paid-through imports unless there is an already-created subscription.
- Keep Alumni and Supporting Alumni imports outside this billing path unless existing code already creates a harmless row for them; implementation should prefer no payment setup requirement for non-Member statuses.
- Centralize imported payment-row creation in `src/db/membership.ts` so the import action does not hand-code membership persistence rules.

**Patterns to follow:**
- `createOrReuseMembershipPayment`, `markMembershipCheckoutStarted`, and `activateMembershipPayment` in `src/db/membership.ts`.
- Existing import action transaction style in `src/app/(authenticated)/(app)/people/import-google-user-action.ts`.

**Test scenarios:**
- Covers AE6. Happy path: importing a Member with `paidThroughAt: 2026-09-30` creates a membership row that stores `paidThroughAt` and remains payment pending / setup eligible.
- Happy path: importing a Member without `paidThroughAt` creates the same pending billing setup state as before.
- Edge case: importing Supporting Alumni or Alumni with no department does not create a state that asks them for membership billing.
- Error path: failed duplicate import does not create or mutate a membership payment row.

**Verification:**
- Imported paid-through Members are not considered fully paid solely because an admin entered `paidThroughAt`.
- The paid-through date remains available for later GoCardless subscription creation.

---

- U2. **Allow Imported Members to Start Billing Before Profile Completion**

**Goal:** Let imported Members use the same payment setup action before completing profile onboarding, while preserving the normal onboarding gate for newly created users.

**Requirements:** R20, R21, R23, AE6, AE7

**Dependencies:** U1

**Files:**
- Modify: `src/lib/membership-status.ts`
- Modify: `src/lib/membership-status.test.ts`
- Modify: `src/app/(authenticated)/(app)/membership/start-payment-action.ts`
- Test: `src/lib/membership-status.test.ts`

**Approach:**
- Add a narrow imported-member billing eligibility rule, grounded in durable imported identity and Member status, rather than broadly disabling profile onboarding checks.
- Make `getMembershipViewState` return `payment_pending` for imported Members with a pending payment row even when profile data is incomplete.
- Keep non-imported users with incomplete onboarding in `profile_onboarding`.
- Keep normal newly onboarded users on the existing admin-complete-then-payment flow.
- Ensure `startMembershipPaymentAction` uses the same eligibility decision as the page state so the server action does not reject a member after the UI shows the CTA.

**Patterns to follow:**
- Existing view-state ordering and tests in `src/lib/membership-status.ts` and `src/lib/membership-status.test.ts`.
- Existing server-side guard in `src/app/(authenticated)/(app)/membership/start-payment-action.ts`.

**Test scenarios:**
- Covers AE6. Happy path: imported Member with incomplete profile and pending payment row sees `payment_pending`.
- Covers AE7. Regression: normal non-imported user with incomplete profile and pending payment row still sees `profile_onboarding`.
- Edge case: imported Alumni or Supporting Alumni with incomplete profile does not see membership payment setup.
- Regression: checkout-started state remains `payment_processing`.
- Regression: active GoCardless subscription still yields `full_member`.

**Verification:**
- The UI and server action agree on when an imported Member can start payment setup.
- Existing onboarding-first behavior remains intact for normal new users.

---

- U3. **Thread Delayed Start Date Through Return Finalization**

**Goal:** Pass the first-charge date through the existing GoCardless return finalization path to the `/subscriptions` creation call when the membership row has a future paid-through date.

**Requirements:** R19, R20, R22, R23, AE6, AE7

**Dependencies:** U1

**Files:**
- Modify: `src/lib/gocardless/types.ts`
- Modify: `src/lib/gocardless/membership-flow.ts`
- Modify: `src/lib/gocardless/membership-reconciliation.ts`
- Test: `src/lib/gocardless/membership-flow.test.ts`

**Approach:**
- Add an optional subscription start-date concept to the local GoCardless membership flow types.
- In the shared finalization/reconciliation code called by `finalizeMembershipPaymentAction`, derive the optional first-charge date from the existing payment row's `paidThroughAt` immediately before `createMembershipSubscription` is called.
- Send GoCardless a date-only `start_date` only when the derived first-charge date is in the future.
- Omit `start_date` for normal members and imported members without paid-through coverage so GoCardless keeps using its default first possible charge date.
- Keep idempotency tied to user and mandate as today; the same delayed start date should be produced on retries from the same local payment row.

**Technical design:** Directional rule for the date transform:

```text
paidThroughAt exists and is today-or-future
  -> subscription start date = local date after paidThroughAt
otherwise
  -> no explicit start_date
```

**Patterns to follow:**
- Existing `createMembershipSubscription` boundary in `src/lib/gocardless/membership-flow.ts`.
- Existing finalization authority in `src/lib/gocardless/membership-reconciliation.ts`.
- Existing metadata/idempotency helper tests in `src/lib/gocardless/membership-flow.test.ts`.

**Test scenarios:**
- Covers AE6. Happy path: payment with `paidThroughAt: 2026-09-30` creates a subscription payload with `start_date: "2026-10-01"`.
- Covers AE7. Regression: payment without `paidThroughAt` creates a subscription payload without `start_date`.
- Edge case: expired `paidThroughAt` does not send a past `start_date`.
- Error path: GoCardless validation failure during subscription creation leaves retry possible through the existing reconciliation failure path.
- Integration: return finalization and retry reconciliation both derive the same start date from the same payment row.

**Verification:**
- There is one subscription creation path for normal and imported members.
- The only behavioral difference for imported paid-through Members is the optional `start_date` in the GoCardless subscription payload.

---

- U4. **Explain Paid-Through Coverage in Membership Billing UI**

**Goal:** Inform imported paid-through Members that their fee is covered until X and that GoCardless setup now will only charge after that period ends.

**Requirements:** R20, R21, R22, AE6

**Dependencies:** U1, U2

**Files:**
- Create: `src/app/(authenticated)/(app)/membership/billing-copy.ts`
- Create: `src/app/(authenticated)/(app)/membership/billing-copy.test.ts`
- Modify: `src/app/(authenticated)/(app)/membership/page.tsx`
- Modify: `src/app/(authenticated)/(app)/membership/onboarding.tsx`
- Modify: `src/app/(authenticated)/(app)/membership/payment-button.tsx`
- Test: `src/app/(authenticated)/(app)/membership/billing-copy.test.ts`

**Approach:**
- Pass the current membership payment row or a narrow paid-through view model from `page.tsx` into `MembershipOnboarding`.
- Factor the paid-through title/description/CTA supporting text into a pure helper so the date-sensitive user promise is directly testable without adding a React test framework in this PR.
- When payment is pending and `paidThroughAt` is present in the future, show copy that the membership fee has been paid until the formatted date.
- Make the CTA context clear: setting up billing now authorizes the future subscription and should not charge before the current membership period has ended.
- Keep the default payment-pending copy for normal newly onboarded members and imported Members without paid-through coverage.

**Patterns to follow:**
- Existing compact card copy in `src/app/(authenticated)/(app)/membership/onboarding.tsx`.
- Existing date formatting style in `src/components/people-table.tsx` and `src/app/(authenticated)/(app)/people/[id]/profile-card.tsx`.
- Existing pure Node test style in `src/lib/membership-status.test.ts`.

**Test scenarios:**
- Happy path: copy helper with future `paidThroughAt: 2026-09-30` returns text that includes the paid-until date and delayed-charge explanation.
- Happy path: copy helper without `paidThroughAt` returns the normal "set up yearly membership payment" meaning.
- Edge case: copy helper with expired `paidThroughAt` does not promise delayed charging.

**Verification:**
- Imported covered members understand why they should set up billing now and when the first charge will happen.
- Normal payment setup copy remains concise and unchanged where no paid-through date exists.

---

- U5. **Preserve Reconciliation and Provider-State Invariants**

**Goal:** Ensure activation, retry, and webhook-backed reconciliation continue to use the same local state after delayed subscriptions are added.

**Requirements:** R20, R22, R23, AE6, AE7

**Dependencies:** U1, U3

**Files:**
- Modify: `src/db/membership.ts`
- Modify: `src/lib/gocardless/membership-reconciliation.ts`
- Test: `src/lib/gocardless/membership-flow.test.ts`
- Test: `src/lib/membership-status.test.ts`

**Approach:**
- Keep `activateMembershipPayment` as the only successful local activation transition for GoCardless subscriptions.
- Preserve `paidThroughAt` on activation so UI/admin surfaces can still show why the subscription starts later.
- Ensure already-active reconciliation remains idempotent when a delayed-start subscription ID is already stored.
- Confirm retry logic does not discard `paidThroughAt` when resetting failed Billing Request IDs or starting a new checkout attempt.

**Patterns to follow:**
- Existing idempotent reconciliation behavior in `src/lib/gocardless/membership-reconciliation.ts`.
- Existing unique provider ID columns in `src/db/schema/membership.ts`.

**Test scenarios:**
- Happy path: after delayed subscription creation succeeds, activation stores the subscription ID and leaves `paidThroughAt` intact.
- Regression: repeated return finalization for an already-active delayed subscription returns the existing hosted redirect without a second subscription.
- Error path: failed Billing Request retry clears failed provider request IDs without clearing paid-through coverage.
- Integration: imported paid-through Member moves from `payment_pending` to `full_member` only after GoCardless subscription activation.

**Verification:**
- Delayed subscriptions are not a special membership subtype after activation; they are normal active GoCardless memberships with preserved coverage metadata.

---

## System-Wide Impact

- **Interaction graph:** Import action creates a local pending membership row with `paidThroughAt`; membership page shows the same payment setup flow; the GoCardless return page calls the shared finalization/reconciliation service; that service creates the subscription with optional `start_date`; activation updates the same row.
- **Error propagation:** Import validation errors happen before writes. GoCardless subscription validation errors should use the existing reconciliation failure path and leave retry possible.
- **State lifecycle risks:** The highest risk is accidentally treating `paidThroughAt` as active coverage that hides payment setup. Tests should pin `payment_pending` before activation and `full_member` only after subscription activation.
- **API surface parity:** The membership page and `startMembershipPaymentAction` must share the same eligibility semantics so the UI never advertises an action the server rejects.
- **Integration coverage:** The delayed start date is only meaningful across import, page state, payment start, return finalization, and GoCardless payload creation; unit tests should cover each boundary and at least one cross-boundary scenario through reconciliation.
- **Unchanged invariants:** New users still use the normal onboarding-complete payment flow; all successful members still become active through GoCardless subscription activation; Alumni and Supporting Alumni are not pushed into membership billing setup by this change.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `paidThroughAt` continues to be interpreted as manual active membership | U1 and U2 explicitly change import and membership-status semantics, with tests pinning payment setup eligibility. |
| GoCardless rejects `start_date` because of mandate timing | Only send future date-only values and rely on GoCardless' documented `next_possible_charge_date` validation; preserve retry through existing reconciliation errors. |
| Profile onboarding bypass becomes too broad | Gate the bypass narrowly to imported Members who have a billing setup row; keep normal users and non-Member imported statuses on existing behavior. |
| Date/timezone off-by-one causes an early charge | Treat admin input as a date-only covered-through value and derive the next local calendar date for GoCardless `start_date`. |
| Billing logic spreads into import UI | Keep subscription start calculation in GoCardless reconciliation / membership flow code; import only stores `paidThroughAt`. |

---

## Documentation / Operational Notes

- The import admin UI label should stay "Paid through" or equivalent, but developer-facing notes should clarify that this is coverage metadata used to delay the first GoCardless charge, not proof of an active subscription.
- The membership setup UI is the user-facing explanation point: members must see that their fee is paid until X and that setup now should not charge before the current period ends.
- No additional GoCardless dashboard setup is expected, but sandbox verification should inspect the created subscription payload/date before shipping.

---

## Sources & References

- **Origin document:** `docs/brainstorms/2026-04-28-google-workspace-existing-user-linking-requirements.md`
- Related plan: `docs/plans/2026-04-28-002-feat-google-workspace-user-import-plan.md`
- Related plan: `docs/plans/2026-04-29-001-feat-import-user-status-email-plan.md`
- Related code: `src/lib/gocardless/membership-reconciliation.ts`
- Related code: `src/lib/gocardless/membership-flow.ts`
- Related code: `src/app/(authenticated)/(app)/membership/start-payment-action.ts`
- Related code: `src/lib/membership-status.ts`
- External docs: [GoCardless API reference](https://developer.gocardless.com/api-reference)
