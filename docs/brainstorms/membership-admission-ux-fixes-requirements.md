# Membership Admission UX Fixes — Requirements

**Date:** 2026-05-10
**Status:** Ready for implementation

## Problem

Two UX issues in the membership admission flow:

1. **Misleading pre-proposal copy.** Users who have completed onboarding but have not yet been proposed for membership see "Setting up your membership" / "Your membership is being set up by the team." This falsely implies the team is actively working on their case when no admission process has started.

2. **No auto-refresh on document processing.** When legal membership documents are being generated (`processing` status), the UI shows a static spinner. The Inngest job takes ~5 seconds, so users should see the spinner briefly then automatically transition to the final state without a manual page reload.

---

## Fix 1: Replace misleading pre-proposal copy

### Condition

User has completed onboarding steps but no legal membership record exists yet (`legalMembershipStatus === null`, `legalMembershipState === "not_member"`).

### Current behavior

`task-card.tsx` has an early return that renders a card:
- **Title:** "Setting up your membership"
- **Description:** "Your membership is being set up by the team. If you have any questions, feel free to reach out."

### Required behavior

Remove that early return. The user falls through to `MembershipSection`, which shows the existing "You're in the onboarding phase." copy from `billing-copy.ts`:
- **Title:** "You're in the onboarding phase."
- **Description:** "We're glad to have you on board. After the onboarding phase, you'll see your membership details here."

### Behavioral constraint

Making this work requires a fix in `getMembershipBillingCopy` (`src/app/(authenticated)/(app)/membership/billing-copy.ts`). Currently, `userStatus === "onboarding"` users with no payment have `mode === "not_started"`, which hits the "Set up your yearly membership payment" branch before reaching the onboarding fallback. The onboarding fallback at the bottom of that function is currently dead code for all valid input values.

The fix: add an explicit `userStatus === "onboarding"` check before the `not_started` branch in `getMembershipBillingCopy` so onboarding users always get the onboarding copy.

### Files affected

- `src/app/(authenticated)/(app)/membership/task-card.tsx` — remove `null && not_member` early return
- `src/app/(authenticated)/(app)/membership/billing-copy.ts` — add `userStatus === "onboarding"` guard before the `not_started` block

---

## Fix 2: Live status polling during document processing

### Condition

Legal membership status is `processing` (Inngest workflow is generating board resolution, membership application, and admission confirmation PDFs).

### Current behavior

`task-card.tsx` renders a card with a `Loader2Icon` spinner and "Processing your documents..." text. The existing `PaymentProcessingRefresh` component calls `router.refresh()` on a 3-second interval — which triggers a full Next.js page reload every 3 seconds until the status changes.

### Required behavior

Replace the full-page-reload approach with targeted React Query polling:

1. A plain `"use server"` async function (e.g. `getActiveLegalMembershipStatus`) fetches only the current user's legal membership status from the database. No `actionClient` wrapper needed — this is a read-only query.

2. A new client component (`MembershipProcessingCard`) wraps the `processing` card and uses `useQuery` with `refetchInterval` (≈ 2 seconds) to call this server function while the status is `processing`.

3. When the polled status transitions from `processing` to `active`, the component renders the "Welcome to START Berlin" + `PaymentButton` card **inline**, without any `router.refresh()`. The transition is seamless — no page reload at any point.

4. If the polled status transitions to any other state (unexpected), fall back to `router.refresh()` once to pick up whatever state the server has.

### Why no page reload is possible on the happy path

The `processing → active` transition always leads to `active + no payment` (payment hasn't been set up yet at this stage). That card is self-contained — it only needs to know the status is `active`, not any additional server-fetched data. The `MembershipProcessingCard` can render it directly from the polled data.

### Do not touch `PaymentProcessingRefresh`

Leave `PaymentProcessingRefresh` unchanged — it is still used for the payment processing (`checkout_started`) case in `onboarding.tsx`. The legal membership `processing` state gets its own polling component instead.

### Files affected

- `src/app/(authenticated)/(app)/membership/get-legal-membership-status-action.ts` — new plain `"use server"` function returning `LegalMembershipStatus | null`
- `src/app/(authenticated)/(app)/membership/membership-processing-card.tsx` — new `"use client"` component using `useQuery` + `refetchInterval`
- `src/app/(authenticated)/(app)/membership/task-card.tsx` — replace the `processing` branch with `<MembershipProcessingCard />`

---

## Success criteria

- A newly onboarded user with no legal membership record sees "You're in the onboarding phase." on the membership page — not "Setting up your membership."
- A user in the `processing` state sees the spinner, then seamlessly sees "Welcome to START Berlin" + payment button when processing completes — no full page reload at any point.
- No regression on other membership states (`admission_pending`, `application_pending`, `manual_followup`, `active`).
- `PaymentProcessingRefresh` continues to work unchanged for the payment `checkout_started` case.
