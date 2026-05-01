---
title: "refactor: Split membership page billing and tools sections"
type: refactor
status: completed
date: 2026-04-29
---

# refactor: Split Membership Page Billing and Tools Sections

## Overview

Refactor the membership page so billing state and software/tool onboarding are separate concerns. The page should always render a membership section at the top that explains the user's billing or membership state, and then conditionally render a tools section for users who should see Slack/Notion access.

The current `MembershipOnboarding` component mixes these concerns: when the membership state is `payment_pending` or `payment_processing`, it still renders the "First steps" software cards underneath. That is wrong for Supporting Alumni, and it also makes payment state drive tool visibility. The new shape should make payment state only control the billing section, while user status controls the tools section.

---

## Problem Frame

Supporting Alumni need to pay membership fees, but they should not see the same onboarding wording or onboarding-first software setup that is intended for new Members. At the same time, the billing prompt must not disappear just because a user should or should not see tool cards. Payment requested, payment pending, payment processing, and active membership information belong in the membership section at the top of `/membership`.

The requested page model is:

- Section 1: **Membership**. Always present. Shows onboarding welcome only for `status = "onboarding"`. Shows payment requested/pending/processing whenever payment state requires it. Shows active membership information when the user is active and no payment action is needed.
- Section 2: **Tools**. Visible for onboarding Members, Members, and Supporting Alumni. Hidden for Alumni. Wording changes by lifecycle: onboarding users see "First steps" and "Join X"; non-onboarding users see "Your software & tools" and "Open X".

---

## Requirements Trace

- R1. `/membership` must be organized into a top billing/membership section and a separate tools section.
- R2. Billing/payment states must render independently from tool-card visibility.
- R3. Users with payment pending or payment processing must always see the related membership section at the top.
- R4. Users in `status = "onboarding"` must see the generic START Berlin onboarding/welcome membership section.
- R5. Active users with no payment action needed must see membership information rather than `Nothing to see here`.
- R6. Tools must be visible for onboarding users, Members, and Supporting Alumni.
- R7. Tools must be hidden for Alumni.
- R8. Tool section copy must be "First steps" / "Join X" for onboarding users.
- R9. Tool section copy must be "Your software & tools" / "Open X" for non-onboarding Members and Supporting Alumni.
- R10. Supporting Alumni must not see onboarding-specific tool wording.

---

## Scope Boundaries

- Do not change GoCardless subscription creation, delayed `start_date`, or membership payment persistence.
- Do not add new tool integrations beyond the existing Slack and Notion cards.
- Do not implement membership cancellation, renewal editing, or member-data editing; leave active membership copy ready for those future actions.
- Do not change permissioning or admin import behavior.
- Do not add a visual redesign beyond the structural split and wording changes.

---

## Context & Research

### Relevant Code and Patterns

- `src/app/(authenticated)/(app)/membership/page.tsx` currently chooses one `MembershipOnboarding` mode from `getMembershipViewState` and returns `Nothing to see here` for `full_member`.
- `src/app/(authenticated)/(app)/membership/onboarding.tsx` currently renders both the billing card and the Slack/Notion tool cards.
- `src/app/(authenticated)/(app)/membership/billing-copy.ts` already centralizes membership billing copy for profile onboarding, payment pending, and payment processing.
- `src/lib/membership-status.ts` currently returns `profile_onboarding`, `payment_pending`, `payment_processing`, or `full_member`; this state is useful for the billing section but insufficient by itself for tools visibility because tools also depend on `user.status`.
- `src/app/(authenticated)/(app)/membership/billing-copy.test.ts` and `src/lib/membership-status.test.ts` use Node's built-in test runner and are the closest test patterns.
- `src/app/(authenticated)/(app)/membership/slack-dialog.tsx` and `notion-dialog.tsx` are existing tool actions to keep.

### Institutional Learnings

- No `docs/solutions/` directory exists in this repo, so there were no local institutional learnings to apply.

### External References

- External research is not needed. This is a local UI/state refactor using existing app patterns.

---

## Key Technical Decisions

- **Split components by page section:** Replace the overloaded `MembershipOnboarding` shape with separate section components or clearly separated subcomponents: one for membership/billing, one for tools.
- **Keep billing state in `getMembershipViewState`:** Continue using the existing view-state helper for payment/onboarding/active membership decisions; do not add a second payment-state system in the component.
- **Add a tools visibility/copy helper:** Derive whether to show tools and which labels to use from `user.status`, not from payment state. This keeps Supporting Alumni payment prompts from accidentally showing onboarding wording.
- **Treat `status = "onboarding"` as the onboarding wording source:** Onboarding users see "First steps" and "Join X"; all other visible tool users see "Your software & tools" and "Open X".
- **Show active membership info for `full_member`:** Replace `Nothing to see here` with a normal membership card that can display paid-through / renewal context when available and leaves space for future actions.

---

## Open Questions

### Resolved During Planning

- **Should Supporting Alumni see Slack/Notion tools?** Yes. Tools are visible for Members and Supporting Alumni, but not Alumni.
- **Should Supporting Alumni see onboarding wording?** No. Only `status = "onboarding"` users see "First steps" and "Join X".
- **Should payment pending/processing be tied to tools?** No. Billing state and tools visibility are separate.

### Deferred to Implementation

- **Exact active membership renewal wording:** Implementation should use the best available current data. If no reliable renewal date exists yet, show a conservative active-membership message and include paid-through context only when `paidThroughAt` is present.
- **Component names:** Choose names that fit the resulting file shape; the plan cares about section boundaries, not exact naming.

---

## Implementation Units

- U1. **Extract Membership Page View Helpers**

**Goal:** Create small, testable helpers for membership section copy and tools-section visibility/copy.

**Requirements:** R1, R2, R4, R5, R6, R7, R8, R9, R10

**Dependencies:** None

**Files:**
- Modify: `src/app/(authenticated)/(app)/membership/billing-copy.ts`
- Modify: `src/app/(authenticated)/(app)/membership/billing-copy.test.ts`
- Test: `src/app/(authenticated)/(app)/membership/billing-copy.test.ts`

**Approach:**
- Extend the current copy helper to handle `full_member` / active membership copy in addition to the existing onboarding, pending, and processing states.
- Add a pure helper for tools section configuration, taking at least `user.status` and returning whether tools are visible plus the section title and per-tool action verb.
- Keep date formatting UTC/date-only where paid-through dates are displayed.
- Do not import React components into the helper; keep it pure so it remains easy to test with the existing Node runner.

**Patterns to follow:**
- Existing `getMembershipBillingCopy` function and `billing-copy.test.ts`.
- Existing UTC date formatting in `src/app/(authenticated)/(app)/membership/billing-copy.ts`.

**Test scenarios:**
- Happy path: `status = "onboarding"` returns visible tools with title "First steps" and action verb "Join".
- Happy path: `status = "member"` returns visible tools with title "Your software & tools" and action verb "Open".
- Happy path: `status = "supporting_alumni"` returns visible tools with non-onboarding wording.
- Edge case: `status = "alumni"` returns hidden tools.
- Happy path: `full_member` billing copy returns active membership information instead of empty/null copy.
- Edge case: active membership copy includes paid-through context only when a future paid-through date exists.

**Verification:**
- Tools visibility and wording are test-covered independently from payment state.
- Billing copy can represent all membership page states, including active membership.

---

- U2. **Split Membership and Tools UI Sections**

**Goal:** Refactor `/membership` rendering so the membership section always appears independently from the tools section.

**Requirements:** R1, R2, R3, R4, R5, R6, R7, R8, R9, R10

**Dependencies:** U1

**Files:**
- Modify: `src/app/(authenticated)/(app)/membership/page.tsx`
- Modify: `src/app/(authenticated)/(app)/membership/onboarding.tsx`
- Test: `src/app/(authenticated)/(app)/membership/billing-copy.test.ts`

**Approach:**
- Rename or reshape `MembershipOnboarding` so it is no longer conceptually "onboarding-only"; it should render a membership/billing card for the passed `membershipState`.
- Render the tools grid separately and only when the tools helper says it is visible for the current `user.status`.
- Keep payment-pending CTA and payment-processing refresh in the membership section.
- For `full_member`, render the active membership card instead of returning `Nothing to see here`.
- Ensure payment-pending or payment-processing users who are Alumni do not see tool cards, but still see billing status if the payment row requires it.

**Patterns to follow:**
- Existing card layout in `src/app/(authenticated)/(app)/membership/onboarding.tsx`.
- Existing `PaymentButton`, `PaymentProcessingRefresh`, `SlackDialog`, and `NotionDialog` usage.
- Existing server-component data loading in `src/app/(authenticated)/(app)/membership/page.tsx`.

**Test scenarios:**
- Covered via helper tests in U1 for copy/visibility. Component-level tests are not required because this repo currently has no React component test harness.
- Manual/UI verification expectation: onboarding user sees membership welcome plus "First steps" tools.
- Manual/UI verification expectation: Supporting Alumni with `payment_pending` sees billing setup at top plus "Your software & tools" tool wording.
- Manual/UI verification expectation: Alumni with any payment state sees membership/billing section but no tools.
- Manual/UI verification expectation: active Member sees active membership card plus "Your software & tools".

**Verification:**
- The membership page no longer has a `Nothing to see here` branch for active membership.
- Tools cards are not rendered as a side effect of payment pending/processing.
- Supporting Alumni do not see onboarding-specific copy.

---

- U3. **Align Membership State Semantics With the New Page Shape**

**Goal:** Ensure the existing membership state helper still supports the new section model without widening onboarding bypasses incorrectly.

**Requirements:** R2, R3, R4, R5, R6, R7

**Dependencies:** U1, U2

**Files:**
- Modify: `src/lib/membership-status.ts`
- Modify: `src/lib/membership-status.test.ts`
- Test: `src/lib/membership-status.test.ts`

**Approach:**
- Review whether `profile_onboarding` is still the correct membership-section state for imported Supporting Alumni with no payment row, Alumni with no payment row, and active users.
- Keep payment requested/pending/processing states independent from tools visibility; do not encode tools rules into `getMembershipViewState`.
- Add or adjust tests only where current behavior conflicts with the new page contract.
- Preserve the existing imported billing exception for Members and Supporting Alumni who need to set up billing before profile completion.

**Patterns to follow:**
- Current `getMembershipViewState` tests in `src/lib/membership-status.test.ts`.
- Existing `isImportedBillingUser` rule in `src/lib/membership-status.ts`.

**Test scenarios:**
- Regression: imported Supporting Alumni with pending payment remains `payment_pending` before profile completion.
- Regression: imported Alumni without payment remains profile/onboarding-style membership state but tools remain hidden by the tools helper.
- Regression: active GoCardless subscription remains `full_member` even if a historical `paidThroughAt` is in the past.
- Regression: normal onboarding user without payment still shows onboarding membership state.

**Verification:**
- Membership state continues to describe billing/onboarding state only.
- Tools visibility remains outside `getMembershipViewState`.

---

## System-Wide Impact

- **Interaction graph:** `/membership` loads user and payment, derives membership view state, renders membership/billing section, then independently renders tools based on user status.
- **Error propagation:** No new external calls or mutation paths are introduced. Existing Slack, Notion, and payment actions keep their current error handling.
- **State lifecycle risks:** The main risk is conflating payment state with lifecycle status. The plan mitigates this by using separate helpers for billing copy and tools visibility.
- **API surface parity:** No API or server action contract changes are planned.
- **Integration coverage:** Pure helper tests cover the state matrix; manual UI verification should cover the composed page because there is no React component test harness.
- **Unchanged invariants:** Payment setup, GoCardless finalization, delayed subscription start, import behavior, and tool action internals do not change.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Supporting Alumni still see onboarding wording | Add helper tests for `supporting_alumni` tool copy and keep wording keyed to `status = "onboarding"` only. |
| Alumni accidentally see tool cards | Add helper tests that `alumni` hides tools. |
| Active members still get an empty page | Add active membership copy and remove the `Nothing to see here` branch. |
| Payment state disappears when tools are hidden | Render membership/billing section unconditionally before checking tools visibility. |

---

## Documentation / Operational Notes

- No database migration or external provider rollout is required.
- This is a UI/state refactor; after implementation, manually inspect `/membership` for representative statuses: onboarding, member, supporting alumni, alumni, payment pending, payment processing, and active.

---

## Sources & References

- Related code: `src/app/(authenticated)/(app)/membership/page.tsx`
- Related code: `src/app/(authenticated)/(app)/membership/onboarding.tsx`
- Related code: `src/app/(authenticated)/(app)/membership/billing-copy.ts`
- Related code: `src/lib/membership-status.ts`
