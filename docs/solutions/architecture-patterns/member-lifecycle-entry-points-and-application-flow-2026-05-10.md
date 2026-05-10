---
title: "Member Lifecycle: Entry Points, Application Flow, and Legal Membership"
date: "2026-05-10"
category: architecture-patterns
module: membership
problem_type: architecture_pattern
component: service_object
severity: high
related_components:
  - database
  - background_job
  - authentication
  - payments
applies_when:
  - "Adding a new member via any entry point (onboarding, import, alumni, supporting-alumni)"
  - "Determining whether a user must complete a membership application after a board resolution"
  - "Determining whether payment setup is required for a given member type"
  - "Displaying or reasoning about paid-through date and membership validity"
  - "Deciding the legal moment at which a person formally becomes a member"
tags:
  - membership
  - member-lifecycle
  - application-flow
  - board-resolution
  - onboarding
  - alumni
  - payment-setup
  - paid-through-date
---

# Member Lifecycle: Entry Points, Application Flow, and Legal Membership

## Context

The member lifecycle in START Cockpit is non-trivial because users arrive via multiple entry points — each with different preconditions — and legal membership (Vereinsmitgliedschaft) is tracked independently from operational status. Two separate fields govern what a person can do: `user.legalMembershipState` (legal privileges) and `user.status` (display/operational state). Mixing these two is one of the most common sources of bugs in this module.

Additionally, the admission process requires a multi-party board vote before the user can fill out a formal application, and payment is required only for some user types. A further wrinkle is that imported members may already have paid-up coverage, which defers — but does not eliminate — the GoCardless setup obligation.

This document is the single authoritative reference for all entry points, flow conditions, payment rules, and legal membership semantics.

---

## Entry Points

There are six distinct ways a user can enter the system. The correct flow and the resulting starting state differ for each.

### 1. New User in Onboarding (standard path)

The user was previously imported into Google Workspace and is in the app with:
- `user.status = "onboarding"`
- `user.legalMembershipState = "not_member"`
- No `legalMembership` row yet

An admin triggers a membership proposal via `proposeMembershipAction`. This is the canonical full path:

```
propose → board vote → application → Inngest activation → payment setup → status = "member"
```

**Example:** Alex joined the Slack workspace, was created in Google Workspace, and is in `/people` with status "Onboarding". The board proposes their membership.

---

### 2. Importing an Existing Member (documents verified)

Admin imports a Google Workspace user and sets `status = "member"` or `"supporting_alumni"` **and** `documentsVerified = true`. This represents someone who already went through the full paper process outside the system.

Post-import state:
- `user.status = "member"` or `"supporting_alumni"`
- `user.legalMembershipState = "active_member"`
- `legalMembership` row inserted with `status = "active"` and `activatedAt` set
- `membershipPayment` row inserted with `status = "pending"` and `paidThroughAt` set if provided

**Admission workflow: skipped entirely.** No `boardResolution`, no `admissionParticipant`, no Inngest workflow.

**Payment setup:** still required. If `paidThroughAt` is in the future, GoCardless setup is nudged but the subscription start date is deferred (see [Payment Setup Rules](#payment-setup-rules)).

**Example:** The association had 40 members on a spreadsheet before the cockpit existed. They are imported with `documentsVerified = true`. They skip the proposal/vote/application completely and land directly on the payment setup screen.

---

### 3. Importing an Existing Member (documents NOT verified)

Admin imports with `status = "member"` or `"supporting_alumni"` and `documentsVerified = false` (or left unset).

Post-import state:
- `user.status = "member"` or `"supporting_alumni"`
- `user.legalMembershipState = "not_member"` (admission must still happen)
- `legalMembership` row with `status = "admission_pending"`
- Inngest workflow fired

**Full admission workflow required:** board vote → application → Inngest activation → payment setup.

`paidThroughAt` accepted at import time and stored on `membershipPayment` to grant a coverage grace period, but GoCardless setup is still required eventually.

**Example:** Someone who joined a few years ago but never signed digital documents. They are imported with their status set, but must go through the formal digital admission process before `legalMembershipState` flips to `"active_member"`.

---

### 4. Importing a Supporting Alumni

Mechanically identical to entries 2 and 3, but with `status = "supporting_alumni"`.

- `requiresMembershipBilling("supporting_alumni") === true` → payment required
- If `documentsVerified = true`: fast path (entry 2 mechanics)
- If `documentsVerified = false`: full admission workflow (entry 3 mechanics)

---

### 5. Importing an Alumni

`status = "alumni"`, no billing, no admission workflow.

Post-import state:
- `user.status = "alumni"`
- `user.legalMembershipState = "not_member"`
- No `legalMembership` row
- No `membershipPayment` row

**No payment setup is required or possible.** `getPaymentViewState` returns `"not_required"` when `status === "alumni"` and no payment row exists.

**Example:** A former member who left the association. Kept in the cockpit for historical records and Slack access, but no dues and no admission flow.

---

### 6. Importing an Onboarding User

`status = "onboarding"` import — creates the user without triggering any admission workflow or payment rows. Same starting point as entry 1, but the proposal step is deferred to whenever the admin is ready.

---

## Core Application Flow

The canonical full path (entries 1 and 3) from proposal to active member:

```
Admin: proposeMembershipAction(userId)
  │
  ├─ creates legalMembership (status: "admission_pending")
  ├─ creates boardResolution (billingApplies: true)
  ├─ creates 3 admissionParticipant rows (president, VP, head of finance)
  └─ fires Inngest: admissionWorkflowStarted
         │
         ▼
[Board Vote Loop — up to 3 rounds, 90-day timeout per round]
  │
  │ ≥2 "yes" votes, no procedure_objection
  ▼
legalMembership → "application_pending"
Email to applicant: "Complete your membership application"
         │
         ▼
User fills out 5-step application at /membership/application/[step]
  ├─ Step 1: personal-information  (name locked, address, birth date)
  ├─ Step 2: identity              (naturalPerson declaration, legalCapacity)
  ├─ Step 3: bylaws                (reads Satzung PDF, acceptsBylaws + supportsPurpose)
  ├─ Step 4: fees                  (reads Finanzordnung PDF, acknowledgesFee + acceptsPrivacyNotice)
  └─ Step 5: review                (confirms all declarations → submitApplicationAction)
         │
         ▼
submitApplicationAction
  ├─ membershipApplication.status → "submitted"
  ├─ stores SHA-256 hashes of Satzung + Finanzordnung PDFs
  ├─ legalMembership.status → "processing"
  └─ fires Inngest: applicationSubmitted
         │
         ▼
Inngest resumes
  ├─ archives board resolution PDF (with Sitzungsleiter/Protokollführer)
  ├─ renders + archives membership application PDF (merged with Satzung + Finanzordnung)
  │
  └─ activate-legal-membership step (transaction):
       ├─ legalMembership.status → "active", activatedAt = now
       ├─ user.legalMembershipState → "active_member"
       └─ membershipPayment row inserted (status: "pending")  ← onConflictDoNothing
         │
         ▼
archives admission confirmation PDF
Emails: welcome to new member, completion notice to board
         │
         ▼
User sees /membership → payment setup prompt
         │
         ▼
User sets up GoCardless direct debit
  ├─ membershipPayment.status: pending → checkout_started → active
  └─ activateMembershipPayment:
       if legalMembershipState === "active_member" && user.status === "onboarding":
         user.status → "member"
```

### Board vote outcomes other than approved

| Outcome | Condition | Result |
|---|---|---|
| Approved | ≥2 yes votes, no `procedure_objection` | `legalMembership.status → "application_pending"` |
| Manual follow-up | A `procedure_objection` vote cast | `legalMembership.status → "manual_followup"` |
| Manual follow-up | All 3 rounds without ≥2 yes | `legalMembership.status → "manual_followup"` |
| Manual follow-up | 90-day timeout | `legalMembership.status → "manual_followup"` |

---

## Payment Setup Rules

### When payment IS required

Payment setup (GoCardless direct debit) is required when all of the following are true:

1. `user.legalMembershipState === "active_member"` — legal admission must be complete
2. `requiresMembershipBilling(user.status) === true` — only `"member"` and `"supporting_alumni"`; alumni are exempt
3. The current payment state is one of: `not_started`, `pending`, `processing`, `failed`, or `covered_until_date`

The `paymentSetupAllowed` flag in `getStructuredMembershipState` enforces all three simultaneously. An additional bypass exists for imported members: a user with an incomplete cockpit profile can still access payment setup if a `membershipPayment` row already exists (`canContinueBilling` bypass — prevents the profile-completeness gate from blocking imported members).

### When payment is NOT required

| Condition | Why |
|---|---|
| `user.status === "alumni"` | `requiresMembershipBilling("alumni") === false`; payment view = `"not_required"` |
| `legalMembershipState !== "active_member"` | Legal admission must complete first, even if `user.status` is already `"member"` |
| `membershipPayment.status === "active"` with live subscription and `paidThroughAt >= now` | Payment is already active; `paymentSetupAllowed = false` |

### The `paidThroughAt` field

`membershipPayment.paid_through_at` is a nullable timestamp that represents how far into the future a member's fee has already been manually covered (set at import time or via GoCardless reconciliation).

**What it controls:**

| Condition | Payment view state | Behaviour |
|---|---|---|
| `paidThroughAt >= now` AND `payment.status !== "active"` | `covered_until_date` | Setup is shown and nudged; copy says "you won't be charged before [date]" |
| `paidThroughAt >= now` AND `payment.status === "active"` with subscription | `active` | Copy says "current period covered through [date], next payment scheduled" |
| `paidThroughAt < now` AND `payment.status === "active"` but no `gocardlessSubscriptionId` | `pending` | Coverage lapsed; payment setup needed again |
| `null` AND `payment.status === "pending"` | `pending` | Standard new-member setup prompt |

**GoCardless subscription start date:** `membershipSubscriptionStartDate(paidThroughAt)` returns `paidThroughAt + 1 day` when coverage is in the future, so the first charge is deferred and the member is not double-billed.

**Bootstrap / cold-start sentinel:** When seeding an admin or initial member without going through the full flow, insert a `membership_payment` row with `paid_through_at = '2099-12-31'`. This suppresses the payment setup prompt indefinitely without triggering GoCardless.

---

## Legal Membership Status

### The two-field model

**`user.legalMembershipState`** (enum: `not_member` | `active_member` | `former_member`) is the **authoritative signal** for legal privileges — voting rights, election eligibility, counts toward quorum. This field is never `null`.

**`user.status`** (enum: `onboarding` | `member` | `supporting_alumni` | `alumni`) is an **operational/display field**. It advances from `"onboarding"` to `"member"` only after GoCardless payment activates, and only when `legalMembershipState === "active_member"` is already confirmed.

**Invariant: never use `user.status` to check legal privileges.** Use `isLegalMember(user)` or `filterLegalMembers(users)`, which check `legalMembershipState === "active_member"`.

### When does someone become a legal member?

There are exactly **two** code paths that set `legalMembershipState = "active_member"`:

1. **Inngest `activate-legal-membership` step** — runs after both admission PDFs are archived. In a single transaction:
   - `legalMembership.status → "active"`, `activatedAt = now`
   - `user.legalMembershipState → "active_member"`
   - `membershipPayment` row inserted with `status = "pending"` (idempotent: `onConflictDoNothing`)

2. **Import with `documentsVerified = true`** — the import action sets `legalMembershipState = "active_member"` directly and inserts an active `legalMembership` row + `membershipPayment` row in the same transaction.

At this moment the person is a **legal member of the association (Vereinsmitglied)**. The `legalMembership.activatedAt` timestamp is printed in the admission confirmation PDF and is the legally relevant date.

Note: `user.status` does **not** advance to `"member"` at this point. It advances only later, when GoCardless payment is confirmed by `activateMembershipPayment`. A person can be `legalMembershipState = "active_member"` while still showing `user.status = "onboarding"` — this is normal in the window between admission and payment setup.

---

## Status State Machines

### `legalMembership.status` (the admission workflow state)

```
[proposal created]
      │
      ▼
 admission_pending ──────────────────────────────────────────┐
      │                                                      │
      │ ≥2 yes votes, no objection                           │ objection / timeout / unresolved
      ▼                                                      │
application_pending ─────────────────────────────────────────┤
      │                                                      │
      │ user submits application                             │
      ▼                                                      │
  processing ──────────────────────────────────────────────┬─┤
      │                                                    │ │
      │ Inngest archives PDFs + activates                  │ │
      ▼                                                    │ ▼
    active ◄──── import (documentsVerified=true)   manual_followup
      │
      │ (future: cancellation)
      ▼
  cancelled
```

`LIVE_TENURE_STATUSES = [admission_pending, application_pending, processing, active]`
A unique partial index enforces at most one live tenure per user at the DB level.

### `user.legalMembershipState`

```
not_member ──► active_member ──► former_member (future: resignation)
                 ▲
                 └── import (documentsVerified=true) OR Inngest activation
```

### `user.status`

```
onboarding ──► member          (activateMembershipPayment, gated on legalMembershipState=active_member)
  member ──► supporting_alumni (operational demotion — not automated today)
supporting_alumni ──► alumni   (graduation — not automated today)

Import can create a user in any status directly.
```

### `membershipPayment.status`

```
pending ──► checkout_started ──► active
                 │
                 └──► failed (billing request cancelled in GoCardless)
active ──► pending             (paidThroughAt lapses, no live subscription)
```

---

## Edge Cases & Variables

### `billingApplies` on `boardResolution`

The `boardResolution` table has a `billingApplies: boolean` column. Currently always `true`. It is reserved for future honorary memberships that skip payment, but no code path currently sets it `false`.

### Birth date minimum age

`applicationAddressSchema.birthDate` enforces `>= 18 years` at submission time. The DB column is nullable — users imported before this feature was added have no birth date and are not blocked from completing the rest of an application.

### `applicationVersion` / `feeTextVersion` (SHA-256 hashes)

These columns on `membership_application` store hashes of `public/legal/satzung.pdf` and `public/legal/finanzordnung.pdf` computed at submission time. They replaced the earlier static `"v1"` string. If a new PDF is deployed between a user opening the application and submitting it, the hash captures the version present at submit, enabling audit queries without a separate version table.

### Application access guards

The entire `/membership/application/[step]` route requires `legalMembership.status === "application_pending"`. Any other status redirects to `/membership`, preventing re-submission.

The review step (step 5) further redirects to the specific incomplete step if any required declaration is missing, enforcing sequential completion.

### `activateMembershipPayment` guard

When GoCardless activates a payment, the guard checks `user.legalMembershipState` before advancing `user.status`. If legal activation has not yet completed (a race condition edge case), the status advance is skipped with a warning log rather than crashing.

### Legacy URL redirects

`/membership/application/address` and `/membership/application/declarations` redirect to `/membership/application/personal-information`. These routes existed before the application was restructured into 5 named steps.

### Inngest replay safety

`computeVoteOutcome` and `computeResolutionRoles` run inside `step.run()` blocks that re-read from the DB on each replay, making them idempotent and safe against out-of-order event delivery.

### Profile completeness and payment setup

`getOnboardingProgress` returns `"completed"` when `personalEmail` and `phone` are valid, and (when `legalMembershipState` is `active_member` or `former_member`) address fields are also complete. Profile completeness normally gates payment setup for new users. **Exception:** imported members with an existing `membershipPayment` row bypass this gate (`canContinueBilling`).

---

## Why This Matters

**Key invariants that must never be violated:**

1. **`legalMembershipState`, not `user.status`, governs legal privileges.** Using `user.status === "member"` to check voting rights is always wrong. Call `isLegalMember(user)`.

2. **`legalMembershipState` must be declared in `betterAuthUserAdditionalFields`.** Better Auth strips undeclared fields from the session. If a new field is added to the user schema and not declared in `src/db/schema/auth-fields.ts`, it will be `undefined` at runtime. This is how the `legalMembershipState` bug was discovered: the field was missing from auth-fields, causing `getStructuredMembershipState()` to compute `paymentSetupAllowed = false`, silently removing the payment CTA.

3. **`membershipPayment` row must be inserted atomically in the Inngest activation step.** It must not be created as a side effect elsewhere. The `onConflictDoNothing` guard makes the insert idempotent.

4. **A user can be `active_member` while `status = "onboarding"`.** This is normal. `user.status` advances to `"member"` only after GoCardless. Do not assume `active_member` implies `status = "member"`.

5. **Imported members with `documentsVerified = true` skip the entire admission workflow.** Do not propose membership for them — `LIVE_TENURE_STATUSES` blocks duplicate proposals, but the intent is that these users already have a live `active` tenure.

---

## Related

- `docs/brainstorms/2026-05-02-membership-lifecycle-workflows-requirements.md` — primary source for the full journey model, entry-point actors, and R1–R47 requirements
- `docs/plans/2026-05-02-001-feat-membership-lifecycle-workflows-plan.md` — authoritative implementation plan; defines `legalMembership` table, Inngest orchestration
- `docs/brainstorms/2026-05-10-admission-documents-application-flow-requirements.md` — direct origin of the current branch; covers the 5-step application sequence and PDF generation
- `docs/plans/2026-05-10-002-feat-admission-documents-application-flow-plan.md` — implementation plan for the current branch
- `docs/plans/2026-04-28-002-feat-google-workspace-user-import-plan.md` — introduces `paidThroughAt` and the import entry point
- `docs/plans/2026-04-26-001-feat-gocardless-membership-payment-plan.md` — defines payment setup conditions and GoCardless subscription activation
- `docs/brainstorms/membership-admission-ux-fixes-requirements.md` — covers the pre-proposal null state UX condition (`legalMembershipState === null` → no proposal yet)
