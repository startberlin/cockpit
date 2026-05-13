---
title: "Membership Hero Card and Settings Subpage"
type: feat
status: completed
date: 2026-05-12
origin: docs/brainstorms/2026-05-12-membership-hero-card-and-settings-requirements.md
---

# Membership Hero Card and Settings Subpage

## Summary

Replace the current `MembershipTaskCard` → `MembershipSection` delegation chain with a single `MembershipHeroCard` component driven by a well-defined state input, add a priority-ranked `MembershipNoticeBlock` for action items, introduce a read-only `ContactDetailsCard`, and add a `/membership/settings` subpage for editing contact details. The membership journey (legal status, user status) is cleanly separated from the payment journey (mandate state, GoCardless).

---

## Problem Frame

The current membership page conflates two independent journeys: the membership journey (legal status, application flow, reconfirmation) and the payment journey (mandate setup, GoCardless reconciliation). `MembershipTaskCard` and `MembershipSection` share overlapping state evaluation logic; `billing-copy.ts` predates the tone-of-voice guide; and `gocardlessMandateId` directly drives card headline copy — a coupling that grows harder to untangle as both journeys evolve independently.

The fix is not cosmetic: the hero card must become a pure membership-status view, payment information belongs in a notice block below it, and `getStructuredMembershipState` must be extended to distinguish the "mandate cancelled" state from the "never set up" state.

---

## Requirements Traceability

All requirements from the origin document (R1–R22) are addressed. Key coverage:

| Req | Addressed by |
|-----|-------------|
| R1 — hero card: no payment CTAs | U2 hero card never renders payment CTAs |
| R2 — "Hi [firstName]" for active/alumni | U2 hero card state table rows 1–5 |
| R3 — processing spinner in hero card | U2 hero card, polling logic from `MembershipProcessingCard` |
| R4 — badge when notice shown | U2 hero card reads notice presence from derived state |
| R5 — priority-ordered state evaluation | U2 hero card, U1 state model |
| R6 — `admission_pending` opaque | U2 hero card falls through to row 11 (onboarding copy) |
| R7 — three payment sub-states for active | U1 `mandateCancelled` flag; U2 hero card rows 4–5 |
| R8 — full state table (rows 1–11) | U2 hero card |
| R9–R13 — notice block | U3 notice block |
| R14 — no notice for calm states | U3 returns null |
| R15–R16 — contact details card | U4 `ContactDetailsCard` + edit link |
| R17–R19 — settings subpage | U5 |
| R20 — consolidated data fetching | U4 page.tsx restructure |
| R21 — single hero card component | U2 |
| R22 — tools section, polling unchanged | U4 preserves `ToolsSection`; U2 preserves polling |

Acceptance examples AE1–AE7 from origin document serve as the authoritative test scenarios for U2 and U3.

---

## Scope Boundaries

**In scope:**
- Hero card rework (legal + user status only)
- Notice block (membership + payment actions, priority logic)
- Contact details card (read-only, with settings link)
- Settings subpage (`/membership/settings`)
- `getStructuredMembershipState` extension for mandate-cancelled detection
- Page-level data fetching consolidation
- Deletion of superseded components

**Out of scope (origin document):**
- `...` lifecycle menu (update payment details, view payment history, end membership)
- Payment pages, GoCardless flows, mandate management
- Backend / schema / Inngest workflow changes
- Membership application form (unchanged)
- Alumni rejoin flow (placeholder notice only)

**Deferred to follow-up work:**
- Navigation sub-item for Settings in `nav-main.tsx` (current `isActive` predicate already highlights the parent link correctly; a dedicated nav entry is a separate UX decision)

---

## Context and Research

### Relevant patterns

- **Settings form pattern**: `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/step-master-data.tsx` — `useHookFormAction` + `FieldSet` / `FieldGroup` / `Field` + locked fields via `InputGroup` + `InputGroupAddon` + `LockIcon` + `Tooltip`
- **Settings action pattern**: `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/step-master-data-action.ts` — `actionClient.inputSchema(schema).action(async ({ ctx, parsedInput }) => ...)`
- **Address autocomplete**: `src/components/address-fields.tsx` — reusable, used in application form steps
- **Phone input**: `src/components/ui/phone-number-input.tsx` — used in master data step
- **Processing card polling**: `src/app/(authenticated)/(app)/membership/membership-processing-card.tsx` — `useQuery` + `refetchInterval` as function + `useEffect` + `router.refresh()` — this pattern is preserved verbatim in the hero card

### Key fields in `src/db/schema/auth.ts`

- `gocardlessMandateId` — active GoCardless mandate
- `gocardlessCustomerId` — exists in schema but not currently surfaced by `getStructuredMembershipState`
- `personalEmail`, `phone`, `street`, `city`, `state`, `zip`, `country` — settings-editable fields
- `email` — workspace email, read-only (comes from Google Workspace)

### Current evaluation in `task-card.tsx` (to be deleted)

Evaluation order: `manual_followup` → `membership_reconfirmation_pending` → `application_pending` → `processing` → `active + not_started` → `active + hasPayment` → fallback to `MembershipSection`. This delegation chain is replaced by the priority-ordered state evaluation in U1/U2.

### Better Auth field declaration trap

Any field read from the session in a client component must be declared in `src/db/schema/auth-fields.ts` under `betterAuthUserAdditionalFields`. `gocardlessCustomerId` is already in the DB schema; verify it is declared there before U1 ships.

---

## Key Technical Decisions

1. **`gocardlessCustomerId` surfaced via `StructuredMembershipState` extension, not raw user props.** The hero card and notice block receive `StructuredMembershipState` only — no raw user fields. This keeps the coupling surface minimal and makes the signal transformation testable in isolation (U1). *(see origin: R7, Dependencies/Assumptions)*

2. **Processing-state polling embedded in the hero card.** The `MembershipProcessingCard` component exists only to own the polling lifecycle. Once the hero card is a client component, the same `useQuery` + `refetchInterval` + `useEffect` + `router.refresh()` pattern lives inside it. The separate file is deleted. *(see origin: R3, R22)*

3. **Hero card derives render variant from a typed union.** The card accepts `MembershipHeroCardState` (a discriminated union or enum-keyed map) derived from props before render, not scattered if-chains. This makes the state table in R8 directly traceable to code paths. *(see origin: R21)*

4. **`billing-copy.ts` is deleted.** It predates the tone-of-voice guide and its copy is superceded by the directional copy in R8 and R11–R13. No backward-compat re-export is needed. *(see origin: R8, Key Decisions)*

5. **Settings subpage uses standalone `useHookFormAction`, not the multi-step application pattern.** The application form's multi-step structure is irrelevant for a single-screen save. The master-data step pattern (`step-master-data.tsx`) is the right reference. *(see origin: R18, Deferred to Planning)*

6. **Settings workspace email: shown read-only, not omitted.** Showing it as a disabled field with a tooltip ("comes from Google Workspace, contact admin to change") gives members visibility into what their workspace email is. *(see origin: R19, Deferred to Planning — product decision: show)*

7. **After settings save: redirect to `/membership`.** Consistent with the application form's post-submit behaviour. *(see origin: R17)*

8. **No nav changes in this unit.** `isActive` in `nav-main.tsx` already highlights `/membership` for any path starting with `/membership/`. A dedicated settings nav entry is a separate future decision. *(research finding)*

9. **`admission_pending` evaluates to the onboarding copy (row 11).** The hero card state evaluator treats `admission_pending` identically to `null` / no legalMembership — the opaque state requirement (R6) is implemented by the evaluation priority order, not a special branch. *(see origin: R6, Key Decisions)*

10. **`firstName` passed from page.tsx.** The hero card needs `user.firstName` for "Hi [firstName]" copy. The server component already calls `getCurrentUser()` which includes this field; it is added to the props passed down. *(see origin: R2)*

---

## Open Questions

### Resolved During Planning

- **Mandate-cancelled recovery CTA** (originally deferred): For now, the notice block for the "mandate cancelled" state (row 4) links to the same payment setup flow as the "never set up" state. The GoCardless re-mandate flow is the same entry point. If a distinct re-mandate flow is built later, only the notice block's href changes.
- **Settings: show or omit workspace email** → show read-only with tooltip (Decision 6 above).
- **Settings form pattern** → standalone `useHookFormAction`, not multi-step (Decision 5 above).

### Deferred to Implementation

- Confirm `gocardlessCustomerId` is already declared in `betterAuthUserAdditionalFields` in `src/db/schema/auth-fields.ts`; if not, add it during U1.
- Confirm the exact `can()` permission key for member self-edit (likely `membership.settings.edit` or similar); check `src/lib/permissions/` during U5.
- Copy strings in R8 / R11–R13 are directional. Implementer should use the strings as written but flag to Sönke before each state's copy ships.

---

## High-Level Technical Design

### State Evaluation — Hero Card (U2)

Evaluated in priority order from props (`StructuredMembershipState`, `userStatus`, `firstName`):

```
1. userStatus === "alumni"
   → variant: alumni  (row 1)

2. legalMembership.status === "processing"
   → variant: processing  (row 6)

3. legalMembership.status === "manual_followup"
   → variant: manual_followup  (row 7)

4. legalMembership.status === "application_pending"
   → variant: application_pending  (row 8)

5. legalMembership.status === "membership_reconfirmation_pending"
   → variant: membership_reconfirmation_pending  (row 9)

6. legalMembership.status === "cancelled" && userStatus !== "alumni"
   → variant: cancelled  (row 10)

7. legalMembership.status === "active"
   || (legalMembership === null && user.legalMembershipState === "active_member")
   → sub-dispatch on payment sub-state:
     a. mandateId set → variant: active_mandate  (rows 2–3)
     b. customerId set, mandateId null (mandateCancelled) → variant: active_cancelled  (row 4)
     c. no customerId, no mandateId → variant: active_no_payment  (row 5)

8. All other states (null, admission_pending, initial onboarding)
   → variant: onboarding  (row 11)
```

### Notice Block Priority Logic (U3)

```
1. If userStatus === "alumni"
   → alumni informational notice (no CTA)  [R13]

2. Else if legalMembership.status === "application_pending"
   → application notice + CTA  [R11]

3. Else if legalMembership.status === "membership_reconfirmation_pending"
   → reconfirmation notice + CTA  [R11]

4. Else if legalMembership.status === "manual_followup"
   → manual_followup informational notice (contact email, no CTA)  [R11]

5. Else if legalMembership.status === "active" (or backward-compat active_member)
   a. mandateCancelled → payment problem notice + CTA  [R12]
   b. no customerId, no mandateId → payment setup notice + CTA  [R12]
   c. mandate active → null (no notice)

6. All other states → null (no notice)  [R14]
```

---

## Implementation Units

### U1 — Extend Membership State Model

**Goal:** Surface `mandateCancelled` from `StructuredMembershipState` so hero card and notice block never touch raw user fields.

**Files modified:**
- `src/lib/membership-status.ts`
  - Add `gocardlessCustomerId` to `MembershipStatusUser` Pick type
  - Add `mandateCancelled: boolean` to `StructuredMembershipState`
  - Compute `mandateCancelled = !!user.gocardlessCustomerId && !user.gocardlessMandateId` in `getStructuredMembershipState`

**Files extended:**
- `src/lib/membership-status.test.ts` (already exists)

**Test scenarios:**
- mandateId set, customerId set → `mandateCancelled: false`, `payment: "active"`
- mandateId null, customerId set → `mandateCancelled: true`, `payment: "not_started"`
- mandateId null, customerId null → `mandateCancelled: false`, `payment: "not_started"`
- `status === "alumni"` → `payment: "not_required"`, `mandateCancelled: false`
- Existing scenarios unchanged (regression coverage)

**Dependencies:** None

---

### U2 — Membership Hero Card Component

**Goal:** Single client component handling all ~11 membership states. Embeds processing-state polling.

**Files created:**
- `src/app/(authenticated)/(app)/membership/membership-hero-card.tsx`
  - `"use client"` — needs `useQuery`, `useEffect`, `useRouter`
  - Props: `StructuredMembershipState`, `legalMembershipStatus: LegalMembershipStatus | null`, `userStatus: UserStatus`, `firstName: string`, `hasNotice: boolean` (drives badge)
  - Derives variant from props (priority order documented above)
  - Processing variant: `useQuery` polling from `getLegalMembershipStatus`, `refetchInterval` returns 2000 while status is `"processing"`, `useEffect` calls `router.refresh()` on terminal non-processing state — same as current `MembershipProcessingCard`
  - Badge: rendered when `hasNotice === true`
  - Spinner: rendered when `variant === "processing"` (shadcn `Loader2` icon with `animate-spin`)

**Files created (test):**
- `src/app/(authenticated)/(app)/membership/membership-hero-card.test.tsx`

**Test scenarios (map to AE1–AE7):**
- AE1: `legalMembershipStatus = "admission_pending"` → renders "Welcome to START Berlin", no badge
- AE2: `legalMembership.status = "active"`, no customerId, no mandateId → "Hi [firstName]" / "Your membership is active. We still need your payment details." + badge
- AE3: `legalMembership.status = "active"`, customerId set, no mandateId → "Hi [firstName]" / "Your membership is active but there is a problem with your payment." + badge
- AE4: `legalMembership.status = "application_pending"` → "Fill out your membership application and join START Berlin e.V." copy + badge
- AE5: `legalMembership.status = "active"`, mandateId set, `userStatus = "member"` → "Hi [firstName]" / "Thank you for being part of START Berlin." + no badge
- AE6: `userStatus = "alumni"` → "Hi [firstName]" + badge (alumni notice)
- AE7: `legalMembership.status = "processing"` → spinner + "Your membership documents are being prepared" + no badge
- Row 3: `userStatus = "supporting_alumni"`, mandate active → "Thank you for continuing to support START Berlin."
- Row 7: `manual_followup` → "We need a moment" headline
- Row 9: `membership_reconfirmation_pending` → "Confirm your START Berlin membership" headline
- Row 10: `cancelled`, non-alumni → "Your membership has ended" headline

**Dependencies:** U1

---

### U3 — Notice Block Component

**Goal:** Single component returning the one highest-priority action notice, or null.

**Files created:**
- `src/app/(authenticated)/(app)/membership/membership-notice-block.tsx`
  - Props: `StructuredMembershipState`, `legalMembershipStatus: LegalMembershipStatus | null`, `userStatus: UserStatus`
  - Returns `null` for no-notice states (rows 2, 3, 6, 10, 11 per origin)
  - Alumni notice: informational, no CTA (R13)
  - `application_pending` notice: "Fill out your membership application" + "Start application" → `/membership/application/personal-information` (R11)
  - `membership_reconfirmation_pending` notice: "Confirm your membership" + "Confirm membership" → `/membership/application/personal-information` (R11)
  - `manual_followup` notice: informational + `hello@startberlin.com` link, no CTA button (R11)
  - Payment setup notice: "Set up your yearly membership payment — START Berlin membership costs 40 EUR per year. It covers the essentials…" + "Set up payment" button → payment setup flow (R12)
  - Payment problem notice: "There is a problem with your payment" copy + "Update payment details" button → payment setup flow (R12, same entry point as setup for now per open question resolution)
  - Uses shadcn `Alert` / `AlertDescription` or `Card` pattern — match design tokens; no new colors

**Files created (test):**
- `src/app/(authenticated)/(app)/membership/membership-notice-block.test.tsx`

**Test scenarios (map to AE4, AE6 and priority logic):**
- AE4: `application_pending` + no payment → membership notice shown (not payment notice)
- AE6: `userStatus = "alumni"` → alumni informational notice regardless of legalMembership
- `active` + mandate active → null (no notice)
- `active` + mandateCancelled → payment problem notice
- `active` + no customerId, no mandateId → payment setup notice
- `membership_reconfirmation_pending` + no payment → reconfirmation notice (not payment notice)
- `processing` → null (no notice)
- `manual_followup` → informational notice with email link
- `cancelled` → null (no notice)

**Dependencies:** U1

---

### U4 — Page Restructure and Contact Details Card

**Goal:** Consolidate data fetching in server component, wire up hero card + notice block, add read-only contact details card, delete superseded files.

**Files modified:**
- `src/app/(authenticated)/(app)/membership/page.tsx`
  - Add `firstName` from `getCurrentUser()` to props passed to client
  - Pass contact detail fields (`personalEmail`, `phone`, `email`, `street`, `city`, `state`, `zip`, `country`) to `MembershipPageContent` for the contact details card
  - No new fetches — all data from the existing `getCurrentUser()` call
- `src/app/(authenticated)/(app)/membership/onboarding.tsx`
  - `MembershipPageContent`: replace `<MembershipTaskCard>` with `<MembershipHeroCard>` + `<MembershipNoticeBlock>` + `<ContactDetailsCard>`
  - `MembershipSection`: delete (superseded)
  - `ToolsSection`: unchanged

**Files created:**
- `src/app/(authenticated)/(app)/membership/contact-details-card.tsx`
  - Client or server component (no interactivity — server preferred)
  - Props: `personalEmail`, `phone`, `email` (workspace), `street`, `city`, `state`, `zip`, `country`
  - Read-only display using shadcn `Card` + field layout
  - "Edit details" link → `/membership/settings`

**Files deleted:**
- `src/app/(authenticated)/(app)/membership/task-card.tsx`
- `src/app/(authenticated)/(app)/membership/billing-copy.ts`
- `src/app/(authenticated)/(app)/membership/billing-copy.test.ts` (if present)
- `src/app/(authenticated)/(app)/membership/membership-processing-card.tsx` (logic moved to hero card)
- `src/app/(authenticated)/(app)/membership/payment-processing-refresh.tsx`

**Test scenarios (integration — manual verification):**
- Membership page renders without error for each major state (active, processing, application_pending)
- `ToolsSection` remains visible and functional
- Contact details card shows correct fields with edit link
- No duplicate data fetches in network tab

**Dependencies:** U2, U3

---

### U5 — Settings Subpage

**Goal:** `/membership/settings` page for editing personal email, phone, and address. Workspace email shown read-only.

**Files created:**
- `src/app/(authenticated)/(app)/membership/settings/page.tsx`
  - Server component; fetches current user via `getCurrentUser()`; renders `SettingsForm` with current values
- `src/app/(authenticated)/(app)/membership/settings/settings-form.tsx`
  - `"use client"` — `useHookFormAction` (Pattern A from `step-master-data.tsx`)
  - Fields: `personalEmail` (email input), `phone` (`PhoneNumberInput`), address block (`AddressFields` component)
  - Workspace email (`email` field): shown as disabled `InputGroup` with lock icon and tooltip ("Your workspace email is managed by START Berlin and cannot be changed here.")
  - On success: `router.push("/membership")`
  - Form layout matches application step form (same `FieldSet` / `FieldGroup` / `Field` / `FieldLabel` structure)
- `src/app/(authenticated)/(app)/membership/settings/save-settings-action.ts`
  - `actionClient.inputSchema(settingsSchema).action(async ({ ctx, parsedInput }) => ...)`
  - Guard: `can("membership.settings.edit")` (verify exact key during implementation)
  - Updates: `personalEmail`, `phone`, `street`, `city`, `state`, `zip`, `country`
  - Does NOT update `email` (workspace email — read-only)
- `src/app/(authenticated)/(app)/membership/settings/settings-validation.ts`
  - Zod schema: `personalEmail` (email), `phone` (string), `street`, `city`, `state`, `zip`, `country` (strings, lengths per application form)

**Test scenarios:**
- Form submits valid data → user record updated, redirect to `/membership`
- Invalid email → validation error shown inline
- Workspace email field is disabled and not submitted
- Permission guard rejects unauthenticated / non-self action

**Dependencies:** None (independent of U1–U4)

---

## System-Wide Impact

- **`billing-copy.ts` deleted**: `onboarding.tsx` imports both `getMembershipBillingCopy` (used in `MembershipSection`) and `getMembershipToolsCopy` (used in `ToolsSection`). `MembershipSection` is deleted in U4, eliminating `getMembershipBillingCopy`. But `getMembershipToolsCopy` is still used by the preserved `ToolsSection` — inline its two relevant copy strings directly into `ToolsSection` before deleting the file.
- **`MembershipTaskCard` deleted** — only imported in `onboarding.tsx`. No other consumers (confirmed).
- **`MembershipSection` deleted** — only imported in `onboarding.tsx`. No other consumers (confirmed).
- **`gocardlessCustomerId` added to `MembershipStatusUser`** — three call sites must each pass an object with this field:
  1. `src/app/(authenticated)/(app)/membership/page.tsx` — passes full `getCurrentUser()` result; already has the field.
  2. `src/app/(authenticated)/(app)/membership/start-payment-action.ts` — passes `ctx.user` (full user from Better Auth session); already has the field.
  3. `src/db/people.ts` `getUserById` — **currently does NOT select `gocardlessCustomerId`**; add `gocardlessCustomerId: true` to its column selection as part of U1.
- **`gocardlessCustomerId` in `auth-fields.ts`** — already declared as `{ type: "string", input: false }`. No change needed.

---

## Risks and Dependencies

| Risk | Mitigation |
|------|-----------|
| `getMembershipToolsCopy` used by preserved `ToolsSection` in `onboarding.tsx` | Inline its two copy strings into `ToolsSection` as part of U4 before deleting `billing-copy.ts` |
| `getUserById` in `people.ts` does not select `gocardlessCustomerId` | Add `gocardlessCustomerId: true` to its column selection in U1 |
| `gocardlessCustomerId` in `betterAuthUserAdditionalFields` | Already confirmed present in `src/db/schema/auth-fields.ts`; no action needed |
| Copy not yet approved by product owner | All copy strings are directional (origin doc decision); implementer flags each state's copy to Sönke before shipping |
| `mandateCancelled` + `paymentSetupAllowed` interaction | `paymentSetupAllowed` is currently gated on `!hasMandate`; `mandateCancelled` does not affect this gate (customerId set, mandateId null → still no mandate → `paymentSetupAllowed` may be true if profile complete); this is correct behaviour — settings form edits can complete the profile gate |
| Permission key for settings self-edit | Verify exact key in `src/lib/permissions/` during U5; if no key exists yet, follow the pattern in `src/lib/permissions/server.ts` to add one |

---

## Sources and References

- Origin document: `docs/brainstorms/2026-05-12-membership-hero-card-and-settings-requirements.md`
- Architecture solution: `docs/solutions/architecture-patterns/membership-journey-vs-payment-journey-2026-05-12.md`
- Lifecycle entry points: `docs/solutions/architecture-patterns/member-lifecycle-entry-points-and-application-flow-2026-05-10.md`
- Tone of voice guide: `docs/solutions/conventions/reusable-tone-of-voice-and-wording-decisions-2026-05-02.md`
- Permission convention: `docs/solutions/conventions/reusable-permission-policy-api-2026-05-02.md`
- Settings form pattern: `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/step-master-data.tsx`
- Settings action pattern: `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/step-master-data-action.ts`
- Processing card polling pattern: `src/app/(authenticated)/(app)/membership/membership-processing-card.tsx`
- Address fields component: `src/components/address-fields.tsx`
- Phone input component: `src/components/ui/phone-number-input.tsx`
- Auth schema: `src/db/schema/auth.ts`
- Legal membership schema: `src/db/schema/legal-membership.ts`
- Membership state logic: `src/lib/membership-status.ts`
- Membership state tests: `src/lib/membership-status.test.ts`
