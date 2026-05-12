---
title: "refactor: Drop membership_payment table, consolidate setup state onto user"
type: refactor
status: active
date: 2026-05-12
---

# refactor: Drop membership_payment table, consolidate setup state onto user

## Summary

The `membership_payment` (singular) table tracks the GoCardless mandate-setup lifecycle per user — billing request IDs, intermediate status, and the final mandate/customer IDs. However the user table already stores `gocardlessMandateId` and `gocardlessCustomerId`. The table is therefore largely redundant. This plan drops it entirely, moves the two transient billing-request tracking columns to the user table, and derives payment-setup view state directly from user fields. `membership_payments` (plural, per-cycle proposals) is untouched.

---

## Problem Frame

Two tables carry overlapping GoCardless IDs for the same user. `membership_payment` was the original tracking row; the user table later gained `gocardlessMandateId` / `gocardlessCustomerId` to let the daily cron query members without a join. The duplication creates a two-source-of-truth risk and requires every payment-status read to do an extra join or lookup.

---

## Requirements

- R1. The `membership_payment` table and `membership_payment_status` enum are removed from the schema and database.
- R2. GoCardless mandate-setup state (active / in-progress / not-started) is fully derivable from user columns without joining another table.
- R3. Webhook (`mandate.ready`) and redirect-return reconciliation can still look up the correct user from a billing-request ID or flow ID.
- R4. Mandate failure events clear in-progress state on the user rather than setting a row status.
- R5. All existing code paths (start-payment action, complete-onboarding action, Inngest workflows, people queries, membership-status library) continue to behave correctly.
- R6. The daily payment-proposals cron (`getMembersNeedingProposal`) is not broken — it already queries `user.gocardlessMandateId` and is unaffected.
- R7. No regression in the `membership_payments` (plural) per-cycle flow.

---

## Scope Boundaries

- `membership_payments` (plural) table and its helpers are not changed.
- GoCardless API integration code in `src/lib/gocardless/membership-flow.ts` is not changed.
- The `failed` payment view-state is dropped — on failure the user returns to `not_started`, which still shows the payment setup button. This is a deliberate simplification.

### Deferred to Follow-Up Work

- Adding finer-grained failure messaging (e.g. "your previous attempt failed") if product decides to revisit.

---

## Context & Research

### Relevant Code and Patterns

- `src/db/schema/membership.ts` — table + enum to drop
- `src/db/schema/auth.ts` — user table; already has `gocardlessMandateId`, `gocardlessCustomerId`
- `src/db/schema/index.ts` — exports and `usersRelations` that include `membershipPayment`
- `src/db/membership.ts` — all helpers that read/write `membership_payment`
- `src/lib/membership-status.ts` — `getStructuredMembershipState(user, payment)` drives view state
- `src/lib/gocardless/membership-reconciliation.ts` — looks up payment by billing-request ID/flow ID
- `src/db/gocardless-events.ts` — webhook handler; marks payment `failed` on failure events
- `src/app/(authenticated)/(app)/membership/start-payment-action.ts` — reads payment row, calls `markMembershipCheckoutStarted`
- `src/app/(authenticated)/(app)/people/complete-onboarding-action.ts` — checks `user.membershipPayment` existence before sending email
- `src/inngest/membership-admission-workflow.ts` — inserts a `pending` payment row on activation
- `src/inngest/membership-reconfirmation-workflow.ts` — same; checks payment existence for email CTA
- `src/db/people.ts` — joins `membershipPayment` in both `getAllUserPublicData` and `getUserById`
- `src/app/(authenticated)/(app)/people/import-google-user-action.test.ts` — tests `importedMembershipPaymentValues` (function to be removed)
- `src/lib/membership-status.test.ts` — tests `getStructuredMembershipState` with a payment object

### Key Call-Site Inventory

| Caller | Current dependency | After |
|---|---|---|
| `start-payment-action.ts` | reads payment row, calls `markMembershipCheckoutStarted` | reads user, writes billing-request fields to user |
| `complete-onboarding-action.ts` | checks `user.membershipPayment` existence | checks `user.gocardlessMandateId` |
| `membership-admission-workflow.ts` | inserts `pending` payment row at activation | no-op (row no longer exists) |
| `membership-reconfirmation-workflow.ts` | same insert; checks payment for email CTA | checks `user.gocardlessMandateId` |
| `people.ts` `getAllUserPublicData` | `with: { membershipPayment: true }` | remove join; derive from user columns |
| `people.ts` `getUserById` | same | same |
| `membership-status.ts` | `getStructuredMembershipState(user, payment)` | `getStructuredMembershipState(user)` — payment state from user fields |
| `membership-reconciliation.ts` | finds payment by billing-request ID/flow ID | finds user by `gocardlessBillingRequestId`/`FlowId` |
| `gocardless-events.ts` | sets payment `status = "failed"` | clears billing-request fields on user |

---

## Key Technical Decisions

- **Drop the table entirely, not rename**: mandate + customer IDs are already on user; two transient billing-request IDs are the only new additions needed. No information worth preserving in a renamed table.
- **Add `gocardlessBillingRequestId` and `gocardlessBillingRequestFlowId` to user**: both are single-valued per user at any time (at most one active setup flow). They let the webhook and redirect handlers find the user without a separate table.
- **Clear billing-request fields on failure** rather than tracking a `failed` status: simplifies state space; user sees `not_started` again and can retry. The `processing` view state (`checkout_started` → spinner) is preserved via presence of `gocardlessBillingRequestFlowId` without a mandate.
- **`getStructuredMembershipState` signature change** — drops the `payment` argument; reads only from the user object. All callers that currently do a join to get the payment row pass only user after this change.
- **`importedMembershipPaymentValues` and `newMembershipPaymentId` removed** — no longer inserts a setup row during import. `requiresMembershipBilling` stays (pure predicate).
- **`complete-onboarding-action` guard simplified** — previously used presence of a payment row to prevent duplicate emails. New guard: if `user.gocardlessMandateId` is set, throw "already active"; otherwise send the email (accepting the edge-case that an admin could resend).

---

## Open Questions

### Resolved During Planning

- *Do we lose anything meaningful by dropping `failed` status?* No. The view state still shows the payment setup button (same as `not_started`). The billing-request fields are cleared so the user gets a clean retry flow.
- *Is `checkout_started` / `processing` still representable?* Yes. `gocardlessBillingRequestFlowId != null && gocardlessMandateId == null` → `processing`.
- *Can the webhook handler still find the user?* Yes, via new `gocardlessBillingRequestId` column on user.

### Deferred to Implementation

- Whether to unique-index `gocardlessBillingRequestId` and `gocardlessBillingRequestFlowId` on user (likely yes for lookup correctness, but migration must handle nulls).

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification.*

**New payment-setup state derivation (replaces `MembershipPaymentStatus`):**

```
user.gocardlessMandateId IS NOT NULL          → "active"
user.gocardlessBillingRequestFlowId IS NOT NULL
  AND gocardlessMandateId IS NULL             → "processing"
alumni AND both null                          → "not_required"
otherwise                                     → "not_started"
```

**Mandate setup lifecycle on user columns:**

```
[not_started]
  admin triggers complete-onboarding → email sent
  user clicks "Set up payment"
    → write gocardlessBillingRequestId + FlowId to user
    → [processing]
  GoCardless fires mandate.ready webhook (billingRequestId)
    → look up user by gocardlessBillingRequestId
    → write gocardlessMandateId + CustomerId to user
    → clear billingRequestId + FlowId
    → [active]
  failure event
    → clear billingRequestId + FlowId
    → [not_started]
```

---

## Implementation Units

### U1. Schema: add billing-request columns to user, delete membership_payment table

**Goal:** Provide the new user columns, remove the old table and enum, generate and apply the migration.

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**
- Modify: `src/db/schema/auth.ts`
- Delete: `src/db/schema/membership.ts`
- Modify: `src/db/schema/index.ts`
- Create: `src/db/migrations/<timestamp>_drop_membership_payment.sql` (generated)

**Approach:**
- Add `gocardlessBillingRequestId` (text, nullable) and `gocardlessBillingRequestFlowId` (text, nullable) to the `user` table in `auth.ts`.
- Consider unique constraints on both columns (nulls do not violate unique in Postgres).
- Remove `membershipPayment`, `membershipPaymentRelations`, `membershipPaymentStatus` from `schema/index.ts` exports and the `schema` object.
- Remove the `membershipPayment: one(...)` relation from `usersRelations` in `schema/index.ts`.
- Delete `src/db/schema/membership.ts`.
- Run `npm run db:generate` → `npm run db:migrate`.

**Patterns to follow:**
- Existing nullable text columns on `user` in `src/db/schema/auth.ts` (e.g., `gocardlessMandateId`).

**Test scenarios:**
- Test expectation: none — pure schema/migration change; correctness verified by type-checking and migration applying cleanly.

**Verification:**
- TypeScript compiles with no errors after the schema file is deleted.
- Migration applies without error against a local database.
- `db.query.user.findFirst(...)` no longer accepts `with: { membershipPayment: ... }`.

---

### U2. Rewrite `src/lib/membership-status.ts`

**Goal:** Derive payment view-state entirely from user fields; drop the `payment` parameter.

**Requirements:** R2, R5

**Dependencies:** U1

**Files:**
- Modify: `src/lib/membership-status.ts`
- Modify: `src/lib/membership-status.test.ts`

**Approach:**
- Remove `MembershipPaymentState` interface and its `status: MembershipPaymentStatus` field.
- Add `gocardlessMandateId`, `gocardlessBillingRequestFlowId` to the `MembershipStatusUser` pick type.
- Change `getStructuredMembershipState(user, payment)` → `getStructuredMembershipState(user)`.
- Rewrite `getPaymentViewState`:
  - `mandate != null` → `"active"`
  - `billingRequestFlowId != null && mandate == null` → `"processing"`
  - `alumni && both null` → `"not_required"`
  - else → `"not_started"`
- `canSetUpPayment`: replace `!!payment` check with `!!user.gocardlessMandateId || user.status === "member" || user.status === "supporting_alumni"`.
- Drop import of `MembershipPaymentStatus`.

**Patterns to follow:**
- Existing shape of `getStructuredMembershipState` — keep the return type `StructuredMembershipState` identical.

**Test scenarios:**
- Happy path — member with mandate set: `getPaymentViewState` returns `"active"`.
- Happy path — member with billing-request flow but no mandate: returns `"processing"`.
- Happy path — member with neither: returns `"not_started"`.
- Happy path — alumni with neither: returns `"not_required"`.
- Edge case — alumni with mandate (old path): returns `"active"` (they set up billing before becoming alumni).
- Happy path — `paymentSetupAllowed` is true for `member` with no mandate.
- Happy path — `paymentSetupAllowed` is false for `alumni`.
- Update existing test suite to pass user objects with the two new fields instead of a separate payment object.

**Verification:**
- All tests in `membership-status.test.ts` pass.
- No callers still pass a second argument to `getStructuredMembershipState`.

---

### U3. Rewrite `src/db/membership.ts`

**Goal:** Replace membership-payment CRUD with user-centric helpers for billing-request tracking.

**Requirements:** R2, R3, R5

**Dependencies:** U1

**Files:**
- Modify: `src/db/membership.ts`

**Approach:**
- **Remove**: `getMembershipPaymentByUserId`, `getMembershipPaymentByBillingRequestFlowId`, `getMembershipPaymentByBillingRequestId`, `createOrReuseMembershipPayment`, `activateMembershipPayment`, `recordMembershipProviderState`, `importedMembershipPaymentValues`, `newMembershipPaymentId`, `markMembershipCheckoutStarted`.
- **Keep**: `getActiveLegalMembership`, `requiresMembershipBilling`, `newMembershipSessionId`.
- **Add**:
  - `getUserByBillingRequestId(billingRequestId)` — finds user where `gocardlessBillingRequestId = $1`
  - `getUserByBillingRequestFlowId(flowId)` — finds user where `gocardlessBillingRequestFlowId = $1`
  - `writeBillingRequestToUser({ userId, customerId, billingRequestId, billingRequestFlowId })` — updates user columns (replaces `markMembershipCheckoutStarted`)
  - `activateUserMandate({ userId, mandateId, customerId })` — writes mandate/customer IDs to user, clears billing-request fields (replaces `activateMembershipPayment`)
  - `clearBillingRequestFromUser(userId)` — nulls out both billing-request columns (called on failure)
- Remove import of `membershipPayment` from schema.

**Patterns to follow:**
- Existing helpers in `src/db/membership.ts` (typed params, simple `db.update`/`db.query` calls).

**Test scenarios:**
- `getUserByBillingRequestId`: returns user when found; returns null when not found.
- `activateUserMandate`: user row has mandate ID set and billing-request fields nulled.
- `clearBillingRequestFromUser`: both billing-request columns become null.

**Verification:**
- TypeScript compiles cleanly with no references to removed functions.
- Grep for `membershipPayment` in `src/db/membership.ts` returns zero results.

---

### U4. Rewrite `src/lib/gocardless/membership-reconciliation.ts`

**Goal:** Reconcile mandate setup using user lookups rather than the dropped payment table.

**Requirements:** R3, R5

**Dependencies:** U1, U3

**Files:**
- Modify: `src/lib/gocardless/membership-reconciliation.ts`

**Approach:**
- `reconcileMembershipPaymentForUser({ userId, billingRequestFlowId })`:
  - Fetch user directly by `userId`.
  - If `user.gocardlessMandateId` is set → `{ status: "already_active" }`.
  - Otherwise proceed to reconcile via billing-request flow (as today, but updating user directly).
- `reconcileMembershipPaymentByBillingRequestId(billingRequestId)`:
  - Replace `getMembershipPaymentByBillingRequestId` with new `getUserByBillingRequestId`.
  - Otherwise same logic.
- Internal `reconcileMembershipPayment(user)` (takes user instead of payment):
  - "already active" check → `user.gocardlessMandateId != null`.
  - Reads `billingRequestId = user.gocardlessBillingRequestId`.
  - If missing, fetch from GC by flow ID, write back with `writeBillingRequestToUser`.
  - On success: call `activateUserMandate({ userId, mandateId, customerId })`.
  - On cancel: call `clearBillingRequestFromUser(userId)`.
- Remove all imports of `membership.ts` functions that no longer exist; import new helpers from U3.

**Patterns to follow:**
- Existing reconciliation logic (fetch billing request from GC API, extract mandate ID).

**Test scenarios:**
- Happy path — `reconcileMembershipPaymentForUser` with active mandate: returns `already_active`.
- Happy path — mandate becomes available: calls `activateUserMandate`, returns `activated`.
- Error path — cancelled billing request: calls `clearBillingRequestFromUser`, returns `failed`.
- Error path — mandate not ready yet: returns `not_ready`.
- Error path — user not found: returns `failed` with message.

**Verification:**
- No references to `getMembershipPaymentBy*` or `recordMembershipProviderState` in this file.
- Reconcile integration works end-to-end (manual or integration test).

---

### U5. Update `src/db/gocardless-events.ts`

**Goal:** Handle mandate failure events by clearing user billing-request fields instead of updating a payment row.

**Requirements:** R4, R5

**Dependencies:** U1, U3

**Files:**
- Modify: `src/db/gocardless-events.ts`

**Approach:**
- `isMembershipFailureEvent` branch: replace `findMembershipPaymentForEvent` + `update(membershipPayment).set({ status: "failed" })` with:
  - Look up user by `hints.billingRequestId` (via `getUserByBillingRequestId`) or `hints.customerId` (via `gocardlessCustomerId` on user).
  - If found: call `clearBillingRequestFromUser(userId)`.
- Remove `findMembershipPaymentForEvent` helper and import of `membershipPayment`.

**Patterns to follow:**
- Existing `handlePaymentEvent` which already queries `membershipPayments` (plural) — keep that untouched.

**Test scenarios:**
- Failure event with billing-request ID hint: finds user, clears billing-request columns.
- Failure event with customer ID hint: finds user by `gocardlessCustomerId`, clears fields.
- Failure event with no matching user: returns `{ status: "ignored" }` without throwing.

**Verification:**
- `findMembershipPaymentForEvent` is deleted.
- `membershipPayment` import is removed.

---

### U6. Update payment-related server actions

**Goal:** Wire `start-payment-action` and `complete-onboarding-action` to the new user-centric helpers.

**Requirements:** R5

**Dependencies:** U1, U2, U3

**Files:**
- Modify: `src/app/(authenticated)/(app)/membership/start-payment-action.ts`
- Modify: `src/app/(authenticated)/(app)/people/complete-onboarding-action.ts`

**Approach:**

`start-payment-action.ts`:
- Remove `getMembershipPaymentByUserId`, `createOrReuseMembershipPayment`, `markMembershipCheckoutStarted` imports.
- Read `ctx.user` directly (no extra DB fetch needed — action context already provides the full user).
- Use `getStructuredMembershipState(ctx.user)` (new signature from U2).
- Check `ctx.user.gocardlessBillingRequestFlowId` or mandate ID to decide whether to reconcile first.
- Pass `ctx.user.gocardlessCustomerId` as `existingCustomerId` to `createMembershipFlow`.
- After creating the flow: call `writeBillingRequestToUser(...)` (new helper from U3).

`complete-onboarding-action.ts`:
- Remove `createOrReuseMembershipPayment` import.
- Fetch user without `with: { membershipPayment: true }`.
- Guard: if `user.gocardlessMandateId` is set → throw "already a full member" (same semantics, different check).
- Remove the `alreadyCompleted` early-return that checked payment row existence — after refactor there is no equivalent row.
- Send email directly after the guard.

**Patterns to follow:**
- Other action-client actions in `src/app/(authenticated)/(app)/membership/`.

**Test scenarios:**
- `start-payment-action`: active mandate → returns `/membership` redirect without creating a new flow.
- `start-payment-action`: billing-request flow in progress → reconciles first; if activated, returns redirect.
- `start-payment-action`: no mandate, no flow → creates new flow, writes billing-request fields to user.
- `complete-onboarding-action`: mandate set → throws "already active" error.
- `complete-onboarding-action`: no mandate → sends email, returns success.

**Verification:**
- No references to `membershipPayment` in either file.
- Manual smoke test: clicking "Set up payment" initiates GoCardless flow.

---

### U7. Update Inngest workflows

**Goal:** Remove the no-longer-needed `membershipPayment` row insertion from the membership activation steps.

**Requirements:** R5

**Dependencies:** U1

**Files:**
- Modify: `src/inngest/membership-admission-workflow.ts`
- Modify: `src/inngest/membership-reconfirmation-workflow.ts`

**Approach:**

`membership-admission-workflow.ts` — `activate-legal-membership` step:
- Remove `insert(membershipPayment).values(...).onConflictDoNothing()` from the transaction.
- Remove import of `membershipPayment` and `newMembershipPaymentId`.
- Step that checks payment existence for email CTA (`const [freshUser, payment, ...]`): replace payment lookup with check of `freshUser.gocardlessMandateId`.

`membership-reconfirmation-workflow.ts` — same two changes:
- Remove payment row insert.
- Replace `!payment` check in the email step with `!subjectData.gocardlessMandateId` (or refetch the user if `subjectData` doesn't carry it).

**Patterns to follow:**
- Other Drizzle transactions in the same files.

**Test scenarios:**
- Admission workflow activation step: transaction completes without referencing `membershipPayment`.
- Reconfirmation workflow email step: `includesPaymentCta` is true when mandate is not set; false when it is.

**Verification:**
- No import of `membershipPayment` in either Inngest file.
- `npm run lint` passes with no unused-import warnings.

---

### U8. Update `src/db/people.ts` and clean up `src/db/schema/index.ts`

**Goal:** Remove the payment-table join from people queries; update `hasMembershipPayment` to use user columns.

**Requirements:** R5

**Dependencies:** U1, U2

**Files:**
- Modify: `src/db/people.ts`
- Modify: `src/db/schema/index.ts`

**Approach:**

`people.ts`:
- Remove `membershipPayment: true` from `with` clauses in both `getAllUserPublicData` and `getUserById`.
- `hasMembershipPayment`: replace `!!user.membershipPayment` with `!!user.gocardlessMandateId`.
- `membershipState`: call `getStructuredMembershipState(user)` (no payment arg).
- Add `gocardlessMandateId`, `gocardlessBillingRequestFlowId` to the `columns` selection where needed for state derivation.

`schema/index.ts`:
- Remove `membershipPayment`, `membershipPaymentRelations`, `membershipPaymentStatus` from the `schema` object and all named exports.
- Remove the `membershipPayment: one(...)` entry from `usersRelations`.
- Remove `import ... from "./membership"` entirely (file is deleted in U1).

**Patterns to follow:**
- Existing column selections in `getAllUserPublicData`.

**Test scenarios:**
- `getAllUserPublicData`: `hasMembershipPayment` is true when `gocardlessMandateId` is set; false otherwise.
- `getUserById`: `membershipState.payment` returns `"active"` when `gocardlessMandateId` is set.
- TypeScript: no type errors after relation removal.

**Verification:**
- No `membershipPayment` property references remain in `people.ts`.
- `with: { membershipPayment: ... }` is a TypeScript error (relation no longer registered).

---

### U9. Update tests

**Goal:** Delete the test for `importedMembershipPaymentValues` (function removed) and update membership-status tests to the new signature.

**Requirements:** R5

**Dependencies:** U2, U3

**Files:**
- Modify: `src/app/(authenticated)/(app)/people/import-google-user-action.test.ts`
- Modify: `src/lib/membership-status.test.ts`

**Approach:**
- `import-google-user-action.test.ts`: remove the `describe("importedMembershipPaymentValues", ...)` block entirely. Verify the `requiresMembershipBilling` describe block still passes.
- `membership-status.test.ts`: update all calls to `getStructuredMembershipState` to drop the second argument. Replace payment-object construction with user-field values (`gocardlessMandateId`, `gocardlessBillingRequestFlowId`).

**Test scenarios:**
- `requiresMembershipBilling` tests remain passing unchanged.
- Updated `getStructuredMembershipState` tests cover all view states (active / processing / not_started / not_required) via user fields.

**Verification:**
- Full test suite passes with no skipped tests.
- No import of `importedMembershipPaymentValues` anywhere in the codebase.

---

## System-Wide Impact

- **Interaction graph:** `membership-reconciliation.ts` is called from both the webhook API route and the redirect return page — both are updated in U4.
- **State lifecycle risks:** Clearing billing-request fields on failure is a one-way write; if the webhook fires multiple times the second clear is a no-op.
- **Partial-write risk:** `activateUserMandate` should write mandate ID and clear billing-request fields in a single `db.update` call (not two separate calls) to avoid a window where mandate is set but flow ID is not yet cleared.
- **API surface parity:** `getStructuredMembershipState` is a library function — all callers updated in U2 + U6 + U8.
- **Unchanged invariants:** `membership_payments` (plural) table, its helpers, and the cron job are not modified. The partial unique index on in-flight proposals is preserved.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Migration drops table with live data | Run against staging first; ensure no prod traffic depends on the row after migration |
| Webhook fires during migration window | The mandate/customer IDs are already on user before the table drop, so the lookup path via user columns is ready before the old table is gone |
| `start-payment-action` receives a stale `ctx.user` without the new columns | Ensure action context is re-fetched from DB (not from session cache) after U1 |
| Billing-request IDs unique-constraint violation if two tabs start setup simultaneously | Add unique index on the new columns; the second write overwrites the first (last-write-wins is acceptable — only one flow can be active) |

---

## Sources & References

- Related code: `src/db/schema/membership.ts`, `src/db/membership.ts`, `src/lib/gocardless/membership-reconciliation.ts`
- Related code: `src/lib/membership-status.ts`, `src/db/gocardless-events.ts`
