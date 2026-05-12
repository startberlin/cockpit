---
title: "Membership Journey and Payment Journey Are Independent"
date: "2026-05-12"
category: architecture-patterns
module: membership
problem_type: architecture_pattern
component: payments
severity: high
related_components:
  - background_job
  - database
  - authentication
applies_when:
  - "Adding logic gated on user.status or user.legalMembershipState"
  - "Modifying GoCardless reconciliation or the activate-legal-membership Inngest step"
  - "Reasoning about when a user transitions from onboarding to member"
  - "Writing UI copy that references onboarding completion or member status"
tags:
  - membership
  - payment
  - user-status
  - onboarding
  - gocardless
  - legal-membership
  - status-transition
---

# Membership Journey and Payment Journey Are Independent

## Context

Until May 2026, `user.status` advanced from `"onboarding"` to `"member"` only when a GoCardless payment mandate was confirmed — inside the payment reconciliation function. This conflated two distinct events:

- A person becomes a **legal member** when the association formally admits them (board vote → application → Inngest `activate-legal-membership`).
- They **set up payment** when they provide bank details via GoCardless.

The conflation meant a legally admitted member remained `"onboarding"` in the system until they completed payment setup — a payment-administrative step that has no bearing on their legal standing.

## Guidance

`user.status` transitions from `"onboarding"` to `"member"` at **legal membership activation**, not at payment setup.

### Where the status transition happens

The promotion happens inside the Inngest `activate-legal-membership` transaction — atomically with `legalMembership.status → "active"` and `user.legalMembershipState → "active_member"`. This applies to both the admission workflow and the reconfirmation workflow:

```typescript
// src/inngest/membership-admission-workflow.ts
// src/inngest/membership-reconfirmation-workflow.ts

await db.transaction(async (tx) => {
  await tx
    .update(legalMembership)
    .set({ status: "active", activatedAt: now })
    .where(eq(legalMembership.id, legalMembershipId));

  await tx
    .update(user)
    .set({ legalMembershipState: "active_member" })
    .where(eq(user.id, subjectUserId));

  // Promote onboarding → member atomically with legal activation.
  // Conditional so it is a no-op for users already at member/supporting_alumni/alumni.
  await tx
    .update(user)
    .set({ status: "member" })
    .where(and(eq(user.id, subjectUserId), eq(user.status, "onboarding")));
});
```

### What payment reconciliation does — and does not do

GoCardless mandate confirmation stores the mandate and customer IDs. It does **not** touch `user.status`:

```typescript
// src/lib/gocardless/membership-reconciliation.ts

await db
  .update(user)
  .set({
    gocardlessMandateId: mandateId,
    gocardlessCustomerId: customerId,
    // No status change — membership and payment are independent
  })
  .where(eq(user.id, member.id));
```

### Which field signals what

| Signal | Field | Use for |
|--------|-------|---------|
| Legal privileges (voting, quorum) | `user.legalMembershipState === "active_member"` | Always — this is the authoritative legal field |
| Operational / display membership | `user.status === "member"` | "Is this person a full member?" — set at legal activation |
| Payment mandate configured | `user.gocardlessMandateId !== null` | Whether GoCardless direct debit is set up |
| Payment cycle tracking | `membershipPayments` table | Outstanding amounts, proposed cycles, payment state |

## Why This Matters

**Conflating membership and payment causes several problems:**

1. A legally admitted member appears as `"onboarding"` in every status-gated UI and query until payment setup completes — even though the association already recognises them as a full member.
2. Features intended for "members" that have nothing to do with payment cannot be safely unlocked at the right moment.
3. Future developers reading `membership-reconciliation.ts` may assume `user.status` is about payment state, leading to incorrect assumptions when adding new payment logic.

**The correct mental model:** membership is what the board decides; payment is a subsequent administrative obligation. They must be tracked and reasoned about independently.

## When to Apply

- When adding a status guard (`user.status === "member"`) — ask whether you mean "legally admitted" or "has payment set up". Use `user.legalMembershipState` for the former, `user.gocardlessMandateId` for the latter.
- When modifying the `activate-legal-membership` step in either Inngest workflow — the `user.status` promotion lives here and must stay atomic with legal activation.
- When modifying `membership-reconciliation.ts` — **do not add a `user.status` change here**. Payment reconciliation must only store mandate data.
- When writing UI copy: if `legalMembership.status === "active"`, the user is a member. Any remaining payment step is separate — do not call it "completing onboarding".

## Examples

### Before: status promoted at payment (removed)

```typescript
// membership-reconciliation.ts — OLD, do not use this pattern
await db.update(user).set({
  gocardlessMandateId: mandateId,
  ...(member.status === "onboarding" && member.legalMembershipState === "active_member"
    ? { status: "member" as const }
    : {}),
}).where(eq(user.id, member.id));
```

### After: status promoted at legal activation (current)

```typescript
// membership-admission-workflow.ts — promote atomically with legal activation
await db.transaction(async (tx) => {
  await tx.update(legalMembership)
    .set({ status: "active", activatedAt: now })
    .where(eq(legalMembership.id, legalMembershipId));
  await tx.update(user)
    .set({ legalMembershipState: "active_member" })
    .where(eq(user.id, subjectUserId));
  await tx.update(user)
    .set({ status: "member" })
    .where(and(eq(user.id, subjectUserId), eq(user.status, "onboarding")));
});
```

## Related

- `docs/solutions/architecture-patterns/member-lifecycle-entry-points-and-application-flow-2026-05-10.md` — full lifecycle reference; see "Legal Membership Status" and "Status State Machines" sections (updated 2026-05-12)
- `src/inngest/membership-admission-workflow.ts` — `activate-legal-membership` step (admission path)
- `src/inngest/membership-reconfirmation-workflow.ts` — `activate-legal-membership` step (reconfirmation path)
- `src/lib/gocardless/membership-reconciliation.ts` — payment reconciliation (mandate storage only, no status change)
- `src/lib/membership-status.ts` — `getStructuredMembershipState` — `paymentSetupAllowed` still requires `legalMembershipState === "active_member"` and `!gocardlessMandateId`
