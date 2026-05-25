---
title: "feat: Add comprehensive PostHog event tracking"
type: feat
status: completed
date: 2026-05-25
origin: docs/brainstorms/2026-05-24-posthog-event-tracking-requirements.md
---

# feat: Add comprehensive PostHog event tracking

## Summary

Instrument ~37 custom PostHog events across the full application: extend user identification with org-relevant properties, add server-side mutation confirmations via `posthog-node` in server actions and Inngest steps, and add client-side structured-metadata events in the people directory. Autocapture handles page views, button clicks, and clipboard — custom events cover only what autocapture cannot: confirmed mutations, structured filter metadata, and background workflow signals.

---

## Problem Frame

PostHog autocapture provides click, pageview, and form interaction data, but cannot answer the product questions that matter most: which step of the membership application do users abandon? Does a member's department predict payment declines? How long does the reconfirmation flow take? Background workflow events (email sends, group reconciliation) are entirely invisible.

User identification today sends only email and name, so no insight can be segmented by status, department, batch, or membership state without a manual export. (see origin: `docs/brainstorms/2026-05-24-posthog-event-tracking-requirements.md`)

---

## Requirements

Carried forward from origin (full list in requirements doc):

- R1. Extend PostHog identify with: `status`, `department`, `batch_number`, `legal_membership_state`, `event_email_preference`, `member_since`
- R2. All custom events use `snake_case` past-tense naming
- R3. Events acting on a specific member include subject metadata: `subject_id`, `subject_status`, `subject_department`, `subject_batch_number`, `subject_legal_membership_state`, `subject_member_since_date`; payment events also include `subject_last_payment_date`
- R4. Server-side mutations use `posthog-server.ts`; client UI interactions use `posthog-js`
- R6–R8. Onboarding events: `onboarding_master_data_submitted`, `onboarding_email_preference_selected`, `onboarding_completed`
- R10–R12. Application events: `membership_application_step_completed` (per step), `membership_application_submitted`
- R13–R15. Payment events: `payment_setup_started`, `payment_mandate_returned`, `payment_mandate_confirmed`
- R16. `profile_updated` with `changed_fields` array
- R17–R19. People directory: `people_filter_applied`, `people_filter_cleared`, `people_search_performed`
- R21–R25. Group events: `group_created`, `group_member_added`, `group_bulk_members_added`, `group_member_removed`, `group_member_pinned`
- R28–R29. Transition events: `membership_transition_requested`, `membership_transition_retracted`
- R30. External links: `data-ph-capture-attribute-service` on hub link elements (replaces custom event — autocapture handles the click)
- R31–R40. Admin events: user created/removed/imported, membership proposed, permissions updated, payment charged/declined, batch created/updated
- R41–R45. Inngest events: `workflow_email_sent`, `workflow_group_member_added`, `workflow_group_member_removed`, `workflow_step_failed`, `workflow_step_timeout`

**Events satisfied by autocapture (no custom instrumentation):**
- R5 `onboarding_started` → page view autocaptured
- R9 `membership_application_started` → page view autocaptured
- R10 `membership_application_step_entered` → page view autocaptured; funnels build from page views
- R20 `people_view_mode_changed` → button click autocaptured; button text distinguishes modes
- R26 `group_email_copied` → clipboard autocaptured
- R27 `group_members_exported` → button click autocaptured

**Origin actors:** A1 (Member), A2 (Admin), A3 (System/Inngest)
**Origin flows:** F1 (Onboarding), F2 (Membership Application), F3 (Reconfirmation/Payment Setup), F4 (Membership Transition)

---

## Scope Boundaries

- Custom PostHog dashboards and insights — instrumentation only; dashboards configured after data flows
- Autocapture configuration — not changed or disabled
- Org chart interaction tracking — low analytical value
- Audit log page access tracking — the audit log already records all actions
- Raw search query text and cancellation reason text — excluded from event properties (PII)
- PostHog feature flags, A/B testing, experiments

---

## Context & Research

### Relevant Code and Patterns

- `instrumentation-client.ts` (repo root) — already initializes `posthog-js` via `posthog.init()` with `api_host: "/ingest"` (the proxy in `next.config.ts`), `ui_host`, `defaults: "2026-01-30"`, `capture_exceptions: true`, and debug mode in development. PostHog is fully initialized; importing from `"posthog-js"` in any client component works immediately.
- `src/lib/posthog-server.ts` — server-side PostHog singleton, `flushAt: 1` / `flushInterval: 0` (each capture flushes immediately); returns `null` when env var absent; zero existing call sites — ready to extend
- `src/components/posthog-identify.tsx` — currently "use client" component calling `authClient.useSession()` and `posthog.identify(id, { email, name })`; Better Auth client session does not expose extended DB fields (status, department, etc.)
- `src/lib/action-client.ts` — `actionClient` provides `ctx.user` as the full `User` type (all DB fields) at zero extra query cost; all server actions have the acting user's complete profile available
- `src/db/user.ts` — `getCurrentUser()` returns the full `User` row including all extended fields
- `src/db/membership-payments.ts` — `getLastActivationDate(userId)` returns most recent `activationDate` string; single indexed query safe to call in action context
- `src/app/(authenticated)/(app)/(default)/payments/charge-action.ts` and `decline-action.ts` — already fetch the payment row including `userId` and `activationDate`; `row.activationDate` is the relevant payment date for the subject
- `src/app/(authenticated)/(app)/(default)/people/page-client.tsx` — has discrete `handleDepartmentChange`, `handleBatchChange`, `handleStatusChange` callbacks — natural injection points for filter events
- `src/app/(authenticated)/(app)/(default)/groups/[id]/actions.ts` — group member add/remove/pin actions
- `src/app/(authenticated)/(app)/(default)/groups/[id]/bulk-actions.ts` — bulk member add
- Audit log pattern: `writeAuditLog(...)` is called after mutations, just before the return — PostHog capture follows the same placement

### Institutional Learnings

- **Server/client import boundary is strictly enforced** — `posthog-node` (via `posthog-server.ts`) must never be imported from any file that is or could be transitively imported by a `"use client"` component. A prior incident with a server module leaking into the client bundle caused hard build failures with misleading error messages (severity: high).
- **PostHog capture in Inngest must be inside `step.run()`** — placing it outside a step means it re-runs on function retry but the step result is not replayed, risking double-fires or missed captures on failure.
- **Capture after permission check** — server actions call `can()` before proceeding; place PostHog capture after the permission guard passes and after the primary mutation succeeds, not before.

### External References

- PostHog `data-ph-capture-attribute-*`: attributes on HTML elements inject properties into autocaptured events; `data-ph-capture-attribute-service="slack"` on a link enriches the autocaptured click without a custom event

---

## Key Technical Decisions

- **Split `posthog-identify.tsx` into server + client components.** The Better Auth client session exposes only base fields. Converting `PostHogIdentify` to a server component lets it call `getCurrentUser()` directly, then pass all extended fields as props to a client child that calls `posthog.identify()`. This eliminates a round-trip server action call from the client and keeps the identify call accurate on every server-rendered page load.
- **`buildSubjectMetadata(user)` helper in `posthog-server.ts`.** All server-side events that need subject metadata call this helper rather than assembling the six-field object inline. This ensures consistent property names and makes future field additions a one-line change.
- **Subject metadata for admin actions requires fetching the target user.** `ctx.user` is the acting admin, not the target. Server actions operating on a specific member (remove, propose, permissions, etc.) must fetch the target user's record to build subject metadata. This is an extra DB query per action — acceptable since analytics tracking is non-blocking and runs after the primary mutation.
- **`subject_last_payment_date` in payment events uses `row.activationDate`.** The payment row is already in scope in `chargeAction` and `declineAction`; no additional query is needed.
- **Inngest PostHog captures go in dedicated `step.run("capture-analytics")` blocks.** This ensures retried steps do not silently drop or double-fire captures, and the capture is visible in Inngest's step trace for debugging.
- **Admin events use the target member's ID as `distinctId`, not the acting admin's.** This places the event on the member's PostHog timeline where GDPR right-to-erasure applies — deleting a member's data erases these events. The acting admin is identified via an `actor_id` property. This also means admin payment events appear in the member's history alongside their own actions, enabling the intended cohort analysis (e.g., "are declines clustered by department?").
- **`data-ph-capture-attribute-service` on external links** replaces the `external_link_clicked` custom event (R30). Autocapture handles the click; the attribute enriches it with the service name. No JavaScript needed.
- **`onboarding_completed` fires in `step-event-email-action.ts`** (the final onboarding step). If the event-invites step is conditional and some users skip it, implementer should verify whether a separate completion signal is needed from the master-data step path.
- **`people_search_performed` requires the result count as a prop.** The people directory is server-rendered; the client component must receive a `resultCount` (or `hasResults`) prop from the server component to populate the `has_results` property. Implementer to confirm the current prop shape in `page-client.tsx`.

---

## Open Questions

### Resolved During Planning

- **Which page-view events are redundant with autocapture?** Resolved: `onboarding_started`, `membership_application_started`, `membership_application_step_entered`, `people_view_mode_changed`, `group_email_copied`, `group_members_exported`, `external_link_clicked` are all handled by autocapture (click, page view, or clipboard events). Custom events dropped; `data-ph-capture-attribute` used for external links.
- **How to get extended fields for user identification?** Resolved: split `PostHogIdentify` into server + client components; server component calls `getCurrentUser()`.
- **Is `subject_last_payment_date` an extra query?** Resolved: `row.activationDate` is already in scope in charge/decline actions — no extra query needed.

### Deferred to Implementation

- **Is `step-event-email-action.ts` always the final onboarding step?** The event-invites step is conditional. Implementer should trace the onboarding completion redirect to confirm where `onboarding_completed` fires most accurately.
- **Does `people/page-client.tsx` receive a result count or has-results prop from its server parent?** If not, the server component (`page.tsx`) needs to pass one. Implementer to check the current prop interface.
- **Are there batch delete actions?** No `delete-batch-action.ts` was found. If batch deletion exists, add `admin_batch_deleted` there; if not, omit R40 from this implementation.
- **Does `groups/[id]/actions.ts` contain separate named exports for add/remove/pin, or are they dispatched through a single action?** Implementer to read the file and determine the correct injection point per action type.

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification.*

```
Three injection patterns:

1. CLIENT-SIDE (posthog-js) — UI interactions needing structured metadata
   ┌─────────────────────────────────────────────────────┐
   │  page-client.tsx callback                           │
   │  handleDepartmentChange(val) {                      │
   │    setDepartment(val)  // nuqs state                │
   │    posthog.capture("people_filter_applied", { ... })│
   │  }                                                  │
   └─────────────────────────────────────────────────────┘

2. SERVER-SIDE (posthog-node) — mutations confirmed on the server
   ┌─────────────────────────────────────────────────────────────┐
   │  actionClient.action(async ({ ctx, parsedInput }) {         │
   │    can("permission")  // guard                              │
   │    await db.mutation(...)  // primary work                  │
   │                                                             │
   │    // Self-events: distinctId = ctx.user.id                 │
   │    getPostHogClient()?.capture({                            │
   │      distinctId: ctx.user.id,                               │
   │      event: "profile_updated",                              │
   │      properties: { changed_fields: [...] }                  │
   │    })                                                       │
   │                                                             │
   │    // Admin events acting on a member:                      │
   │    // distinctId = target member's ID (GDPR erasure target) │
   │    // actor_id = acting admin (for attribution)             │
   │    getPostHogClient()?.capture({                            │
   │      distinctId: targetUser.id,                             │
   │      event: "admin_payment_declined",                       │
   │      properties: {                                          │
   │        actor_id: ctx.user.id,                               │
   │        ...buildSubjectMetadata(targetUser, lastPaymentDate) │
   │      }                                                      │
   │    })                                                       │
   │    return result                                            │
   │  })                                                         │
   └─────────────────────────────────────────────────────────────┘

3. INNGEST (posthog-node inside step.run) — background workflow signals
   ┌─────────────────────────────────────────────────────┐
   │  await step.run("primary-work", async () => { ... })│
   │  await step.run("capture-analytics", async () => {  │
   │    getPostHogClient()?.capture({                    │
   │      distinctId: affectedUserId,                    │
   │      event: "workflow_email_sent",                  │
   │      properties: { email_type, subject_id }         │
   │    })                                               │
   │  })                                                 │
   └─────────────────────────────────────────────────────┘
```

---

## Implementation Units

### U1. Analytics helper extension

**Goal:** Add a `buildSubjectMetadata()` helper and type to `posthog-server.ts` so all server-side events that act on a member share consistent property names.

**Requirements:** R3

**Dependencies:** None

**Files:**
- Modify: `src/lib/posthog-server.ts`

**Approach:**
- Add a `SubjectUser` interface (or type alias) capturing the fields needed for subject metadata: `id`, `status`, `department`, `batchNumber`, `legalMembershipState`, `memberSinceDate`
- Add `buildSubjectMetadata(user: SubjectUser, lastPaymentDate?: string | null)` that returns a plain object with the six standard properties plus the optional `subject_last_payment_date`
- Keep the helper synchronous and pure — callers are responsible for fetching the target user before calling it
- The existing `getPostHogClient()` export is unchanged

**Patterns to follow:**
- `src/lib/posthog-server.ts` existing module structure

**Test scenarios:**
- Happy path: `buildSubjectMetadata(user)` returns object with all six properties mapped to snake_case keys
- `buildSubjectMetadata(user, "2025-08-01")` includes `subject_last_payment_date`
- `buildSubjectMetadata(user, null)` omits `subject_last_payment_date` from the returned object
- Fields with null/undefined values (e.g., nullable `department`) are passed through without throwing

**Verification:**
- TypeScript compilation passes with no new errors
- Helper is importable from server-only files

---

### U2. Extended user identification

**Goal:** Identify users in PostHog with status, department, batch_number, legal_membership_state, event_email_preference, and member_since, so every event can be sliced by these dimensions.

**Requirements:** R1

**Dependencies:** None (independent of U1)

**Files:**
- Modify: `src/components/posthog-identify.tsx`
- Create: `src/components/posthog-identify-client.tsx`

**Approach:**
- Convert `posthog-identify.tsx` from a `"use client"` component to an `async` server component
- Server component calls `getCurrentUser()` (from `src/db/user.ts`); returns `null` render if user is not authenticated (unauthenticated routes)
- Passes the following fields as props to the new client child: `id`, `email`, `name`, `status`, `department`, `batchNumber`, `legalMembershipState`, `eventEmailPreference`, `memberSinceDate`
- Create `posthog-identify-client.tsx` as a `"use client"` component that receives these props and calls `posthog.identify(id, { email, name, status, department, batch_number, legal_membership_state, event_email_preference, member_since })`
- The identify call fires in a `useEffect` keyed to `id` (fires once per distinct user, not on every render)
- `src/app/layout.tsx` usage of `<PostHogIdentify />` does not change — the component is now async but that is transparent to the caller in Next.js App Router

**Patterns to follow:**
- Current `src/components/posthog-identify.tsx` for the identify call shape
- Server component → client component prop-passing pattern used elsewhere in the app

**Test scenarios:**
- Authenticated user: server component renders the client child with all extended props populated
- Unauthenticated user (`getCurrentUser()` returns null): server component renders nothing, no identify call fires
- User with null `department` or `batchNumber`: client component calls identify without error; null values passed through as-is
- `posthog-identify-client.tsx` is never imported from any server action or Inngest file (import boundary check)

**Verification:**
- Signing in as a user: PostHog person record shows `status`, `department`, `batch_number`, `legal_membership_state`, `event_email_preference`, `member_since` properties
- Build succeeds with no `Cannot resolve 'net'` or similar bundler errors

---

### U3. Onboarding flow events

**Goal:** Track `onboarding_master_data_submitted`, `onboarding_email_preference_selected`, and `onboarding_completed` server-side so the onboarding funnel is measurable end-to-end.

**Requirements:** R6, R7, R8

**Dependencies:** U1

**Files:**
- Modify: `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/step-master-data-action.ts`
- Modify: `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/step-event-email-action.ts`

**Approach:**
- In `step-master-data-action.ts`: after the DB update succeeds, call `getPostHogClient()?.capture()` with event `onboarding_master_data_submitted` and properties `had_personal_email` (bool), `had_phone` (bool), `had_birth_date` (bool) — derived from the parsed input, not queried from DB
- In `step-event-email-action.ts`: after the DB update succeeds, call capture with `onboarding_email_preference_selected` and property `preference` (the selected enum value). Also call capture with `onboarding_completed` immediately after, since this is the final onboarding step for users who reach it
- For users who skip the event-invites step: implementer should verify whether the master-data step performs the completion redirect for those users; if so, `onboarding_completed` should also fire there (conditionally, checking if the event-invites step is not applicable)
- `distinctId` is `ctx.user.id` in both actions

**Patterns to follow:**
- Existing `writeAuditLog` call placement in these same files (after mutation, before return)

**Test scenarios:**
- Happy path master data: action succeeds → PostHog receives `onboarding_master_data_submitted` with correct boolean properties
- Happy path email preference: action succeeds → PostHog receives `onboarding_email_preference_selected` with the selected `preference` value, and `onboarding_completed`
- PostHog client absent (env var not set, `getPostHogClient()` returns null): action still returns success; no error thrown
- `had_personal_email: true` only when a non-empty personal email was provided in the input

**Verification:**
- Completing the onboarding flow: PostHog activity view for the user shows all three events in chronological order

---

### U4. Membership application events

**Goal:** Track `membership_application_step_completed` for each application step and `membership_application_submitted` on final submission, enabling per-step funnel and drop-off analysis.

**Requirements:** R11, R12

**Dependencies:** U1

**Files:**
- Modify: `src/app/(authenticated)/(app)/(default)/membership/application/[step]/(steps)/step-address-action.ts`
- Modify: `src/app/(authenticated)/(app)/(default)/membership/application/[step]/(steps)/step-identity-action.ts`
- Modify: `src/app/(authenticated)/(app)/(default)/membership/application/[step]/(steps)/step-fees-action.ts`
- Modify: `src/app/(authenticated)/(app)/(default)/membership/application/[step]/(steps)/step-bylaws-action.ts`
- Modify: `src/app/(authenticated)/(app)/(default)/membership/application/[step]/submit-application-action.ts`

**Approach:**
- Each step action: after successful DB mutation, capture `membership_application_step_completed` with `step` property set to the step's slug string (`personal-information`, `identity`, `fees`, `bylaws`)
- The `step` value is a string constant per file — no dynamic derivation needed
- `submit-application-action.ts`: capture `membership_application_submitted` after the Inngest event is sent (i.e., after the full submission is processed)
- `distinctId` is `ctx.user.id` in all cases
- Do not capture on validation errors or early returns — only on the successful path

**Patterns to follow:**
- Audit log placement in existing step actions

**Test scenarios:**
- Each step action: success path → PostHog receives `membership_application_step_completed` with the correct `step` value for that file
- Submit action: success → PostHog receives `membership_application_submitted`
- Validation failure in any step action: no PostHog event fired
- PostHog client absent: all actions still succeed

**Verification:**
- Completing the full application flow: PostHog funnel built from `membership_application_step_completed` events shows all steps with the correct `step` property values

---

### U5. Payment and reconfirmation events

**Goal:** Track `payment_setup_started`, `payment_mandate_returned`, and `payment_mandate_confirmed` to measure the GoCardless payment funnel and session completion rate.

**Requirements:** R13, R14, R15 (F3)

**Dependencies:** U1

**Files:**
- Modify: `src/app/(authenticated)/(app)/(default)/membership/start-payment-action.ts`
- Modify: `src/app/(authenticated)/(redirect)/membership/payment-return/check-mandate-action.ts`

**Approach:**
- `start-payment-action.ts`: after the GoCardless session is initiated successfully, capture `payment_setup_started`. No additional properties needed.
- `check-mandate-action.ts`: this action handles the user's return from GoCardless. Capture `payment_mandate_returned` with `success` (bool reflecting whether the mandate was found and valid). If the mandate is confirmed active, also capture `payment_mandate_confirmed`.
- Both events use `ctx.user.id` as `distinctId`
- If the check action handles both success and failure paths in one flow, emit `payment_mandate_returned` on both paths (with the appropriate `success` value), and `payment_mandate_confirmed` only on the success path

**Patterns to follow:**
- Existing action structure in `start-payment-action.ts` and `check-mandate-action.ts`

**Test scenarios:**
- GoCardless session initiated: `payment_setup_started` captured
- User returns with valid mandate: `payment_mandate_returned` with `success: true` and `payment_mandate_confirmed` both captured
- User returns without valid mandate (abandoned GoCardless flow): `payment_mandate_returned` with `success: false`; `payment_mandate_confirmed` not captured
- PostHog client absent: both actions still complete their primary work

**Verification:**
- Walking through payment setup end-to-end: PostHog shows the three events in order with timestamps that allow duration calculation

---

### U6. People directory events

**Goal:** Track `people_filter_applied`, `people_filter_cleared`, and `people_search_performed` so filter preference patterns are visible in PostHog.

**Requirements:** R17, R18, R19

**Dependencies:** None (client-side only; no U1 dependency)

**Files:**
- Modify: `src/app/(authenticated)/(app)/(default)/people/page-client.tsx`

**Approach:**
- Import `posthog` from `"posthog-js"` at the top of the client file
- In each filter change handler (`handleDepartmentChange`, `handleStatusChange`, `handleBatchChange`): call `posthog.capture("people_filter_applied", { filter: "department" | "status" | "batch", value: selectedValue })` when a value is selected; call `posthog.capture("people_filter_cleared", { filter: "..." })` when the value is cleared/reset
- For search: fire `people_search_performed` in the debounce callback with `has_results` (bool). This requires knowing whether results were returned. If the server component passes a result count prop down, use `resultCount > 0`. If not, add a `resultCount` (or `hasResults`) prop to `page-client.tsx` from `page.tsx` — implementer to check the current prop interface.
- Do not capture on every keystroke — only when the debounced value is committed (the same moment the URL state updates via nuqs)

**Patterns to follow:**
- Existing `handleDepartmentChange` etc. callbacks in `page-client.tsx`
- Nuqs update pattern already in place

**Test scenarios:**
- Department filter selected: `people_filter_applied` emitted with `filter: "department"` and the selected department value
- Department filter cleared: `people_filter_cleared` emitted with `filter: "department"`
- Search debounce fires with results: `people_search_performed` with `has_results: true`
- Search debounce fires with empty results: `people_search_performed` with `has_results: false`
- Empty search (clearing the query): no `people_search_performed` event (event only fires for non-empty queries, per R19)

**Verification:**
- Applying and clearing filters on the people page: PostHog activity shows filter events with correct `filter` and `value` properties

---

### U7. Profile, membership transitions, and external link metadata

**Goal:** Track `profile_updated` with changed fields, `membership_transition_requested` and `membership_transition_retracted` with transition type, and add `data-ph-capture-attribute-service` to external service links so autocapture enriches those clicks with the service name.

**Requirements:** R16, R28, R29, R30

**Dependencies:** U1 (for server-side events)

**Files:**
- Modify: `src/app/(authenticated)/(app)/(default)/membership/settings/save-settings-action.ts`
- Modify: `src/app/(authenticated)/(app)/(default)/membership/request-transition-action.ts`
- Modify: `src/app/(authenticated)/(app)/(default)/membership/retract-transition-action.ts`
- Modify: `src/app/(authenticated)/(app)/(default)/membership/retract-cancellation-action.ts`
- Modify: membership hub page or component that renders the external service links (Slack, Canva, Notion, Tally, Bubbles)

**Approach:**
- `save-settings-action.ts`: before the update, fetch the existing user record; compare each field in `parsedInput` against the current value; build a `changed_fields` string array of field names that differ. After the update, capture `profile_updated` with `changed_fields`. If no fields changed, still capture (it indicates the form was submitted without changes, which is useful signal).
- `request-transition-action.ts`: after the transition request is persisted, capture `membership_transition_requested` with `transition_type` (the requested type) and `had_reason` (bool: whether the input included a non-empty reason string).
- `retract-transition-action.ts` and `retract-cancellation-action.ts`: after retraction, capture `membership_transition_retracted` with `transition_type`
- External links: add `data-ph-capture-attribute-service="slack"` (etc.) to each `<a>` element in the hub. No JavaScript required — PostHog autocapture picks up the attribute and adds it to the click event properties.

**Patterns to follow:**
- Audit log placement in transition action files

**Test scenarios:**
- Profile updated with changed phone and email: `profile_updated` captures `changed_fields: ["phone", "personal_email"]`
- Profile submitted with no changes: `profile_updated` with `changed_fields: []`
- Transition requested (alumni): `membership_transition_requested` with `transition_type: "alumni"`, `had_reason: false`
- Cancellation requested with reason: `membership_transition_requested` with `transition_type: "cancel"`, `had_reason: true`
- Transition retracted: `membership_transition_retracted` with the appropriate `transition_type`
- Slack link clicked: autocaptured click event includes `service: "slack"` property (manual browser verification)

**Verification:**
- Updating contact details: PostHog event shows only the fields that actually changed
- Requesting and retracting a transition: PostHog shows both events with matching `transition_type`

---

### U8. Group management events

**Goal:** Track `group_created`, `group_member_added`, `group_bulk_members_added`, `group_member_removed`, and `group_member_pinned` with subject metadata for member-targeting events.

**Requirements:** R21, R22, R23, R24, R25

**Dependencies:** U1

**Files:**
- Modify: `src/app/(authenticated)/(app)/(default)/groups/create-group-action.ts`
- Modify: `src/app/(authenticated)/(app)/(default)/groups/[id]/actions.ts`
- Modify: `src/app/(authenticated)/(app)/(default)/groups/[id]/bulk-actions.ts`

**Approach:**
- `create-group-action.ts`: capture `group_created` with `has_email_integration` (bool) after creation succeeds; `distinctId` is the acting user's ID (`currentUser.id`)
- `actions.ts` (member add): capture `group_member_added` after the member is added; fetch the target member's record to build `buildSubjectMetadata(targetUser)`; `distinctId` = **target member's ID** (the event goes on the member's PostHog timeline); add `actor_id: currentUser.id` as a property (this file is plain async server functions, not `actionClient`-wrapped — `currentUser` from `getCurrentUser()`)
- `actions.ts` (member remove): capture `group_member_removed` with subject metadata; `distinctId` = target member's ID; `actor_id: currentUser.id`
- `actions.ts` (member pin/unpin): capture `group_member_pinned` with subject metadata and `pinned` (bool reflecting new pin state); `distinctId` = target member's ID; `actor_id: currentUser.id`
- `bulk-actions.ts`: capture `group_bulk_members_added` with `criteria_type` and `member_count` (number of members successfully added). No per-member subject metadata — batch operation. `distinctId` is the acting user's ID.
- Implementer to read `actions.ts` to confirm the export shape (separate named exports vs. dispatched union action)

**Patterns to follow:**
- `buildSubjectMetadata()` from U1
- Audit log pattern in existing group actions

**Test scenarios:**
- Group created with email integration: `group_created` with `has_email_integration: true`
- Group created without email integration: `group_created` with `has_email_integration: false`
- Member added: `group_member_added` includes `subject_department` matching the added member's department
- Member removed: `group_member_removed` includes subject metadata
- Member pinned: `group_member_pinned` with `pinned: true`; unpinned: `pinned: false`
- Bulk add (10 members by department): `group_bulk_members_added` with `criteria_type: "department"`, `member_count: 10`
- Target user fetch fails before PostHog capture: primary mutation already succeeded; log error but do not re-throw (analytics failure must not break the action)

**Verification:**
- Adding and removing a group member: PostHog shows both events with the member's department in subject metadata

---

### U9. Admin operations events

**Goal:** Track all admin mutation events with subject metadata, enabling pattern analysis on which member profiles are most often acted upon.

**Requirements:** R31–R40

**Dependencies:** U1

**Files:**
- Modify: `src/app/(authenticated)/(app)/(default)/admin/people/create-user-action.ts`
- Modify: `src/app/(authenticated)/(app)/(default)/admin/people/[id]/board-kick-action.ts`
- Modify: `src/app/(authenticated)/(app)/(default)/people/propose-membership-action.ts`
- Modify: `src/app/(authenticated)/(app)/(default)/admin/people/import-google-user-action.ts`
- Modify: `src/app/(authenticated)/(app)/(default)/admin/people/[id]/update-grants-action.ts`
- Modify: `src/app/(authenticated)/(app)/(default)/payments/charge-action.ts`
- Modify: `src/app/(authenticated)/(app)/(default)/payments/decline-action.ts`
- Modify: `src/app/(authenticated)/(app)/(default)/people/batches/create-batch-action.ts`
- Modify: `src/app/(authenticated)/(app)/(default)/people/batches/update-batch-action.ts`

**Approach:**
**distinctId rule for admin events:** Events that act on a specific member use the **target member's user ID** as `distinctId` — not the acting admin's. This places the event on the member's PostHog timeline where GDPR right-to-erasure applies. The acting admin is identified via an `actor_id` property on every such event. Events without a subject (batch operations, `admin_user_created`) use the acting admin's ID as `distinctId`.

- `create-user-action.ts`: capture `admin_user_created` with `distinctId: ctx.user.id` (acting admin). No subject metadata — the user is new and has no meaningful profile yet.
- `board-kick-action.ts`: capture `admin_user_removed` with subject metadata of the removed user. Fetch the target user before the removal (so the fields are available); capture after removal succeeds. `distinctId` = target user's ID; `actor_id: ctx.user.id`.
- `propose-membership-action.ts`: capture `admin_membership_proposed` with subject metadata of the proposed user. `distinctId` = target user's ID; `actor_id: ctx.user.id`.
- `import-google-user-action.ts`: capture `admin_user_imported` with subject metadata of the imported user after DB insertion. `distinctId` = imported user's ID; `actor_id: ctx.user.id`.
- `update-grants-action.ts`: capture `admin_permissions_updated` with subject metadata and `permissions_added` / `permissions_removed` arrays. This file already computes `added` and `removed` arrays for its audit log — reuse those existing variables directly rather than re-deriving the diff. `distinctId` = target user's ID; `actor_id: ctx.user.id`.
- `charge-action.ts`: capture `admin_payment_charged` with subject metadata + `payment_amount_cents`. Use `row.userId` to fetch the target user; use `row.activationDate` as `subject_last_payment_date` (already in scope — no extra query). `distinctId` = target user's ID; `actor_id: ctx.user.id`.
- `decline-action.ts`: same pattern as charge, with event `admin_payment_declined`. `distinctId` = target user's ID; `actor_id: ctx.user.id`.
- `create-batch-action.ts`: capture `admin_batch_created` with `batch_number`. `distinctId: ctx.user.id` (no specific member subject).
- `update-batch-action.ts`: capture `admin_batch_updated` with `fields_changed` array derived from the diff between parsed input and current values. `distinctId: ctx.user.id`.

**Patterns to follow:**
- `buildSubjectMetadata()` from U1
- `board-kick-action.ts` existing audit log pattern as the canonical reference for remove-user events

**Test scenarios:**
- User created: `admin_user_created` captured with acting admin's `distinctId`
- User removed: `admin_user_removed` includes `subject_department` and `subject_status` of the removed user
- Payment charged: `admin_payment_charged` includes `subject_last_payment_date` matching `row.activationDate`, and `payment_amount_cents`
- Payment declined: `admin_payment_declined` includes the same subject metadata fields — verify `subject_last_payment_date` is present (core requirement for pattern analysis)
- Batch created: `admin_batch_created` with correct `batch_number`
- Batch updated with only name changed: `admin_batch_updated` with `fields_changed: ["name"]`
- Subject user fetch fails: primary mutation already succeeded; analytics failure does not throw or roll back
- PostHog client absent: all admin actions complete normally

**Verification:**
- Charging and declining payments for a test member: PostHog shows both events with the member's `subject_department`, `subject_status`, and `subject_last_payment_date`

---

### U10. Inngest workflow events

**Goal:** Track `workflow_email_sent`, `workflow_group_member_added`, `workflow_group_member_removed`, `workflow_step_failed`, and `workflow_step_timeout` from background Inngest jobs so the full member lifecycle is visible in PostHog alongside user-initiated events.

**Requirements:** R41, R42, R43, R44, R45

**Dependencies:** U1

**Files:**
- Modify: `src/inngest/new-user-workflow.ts`
- Modify: `src/inngest/membership-admission-workflow.ts`
- Modify: `src/inngest/membership-transition-workflow.ts`
- Modify: `src/inngest/membership-cancellation-workflow.ts`
- Modify: `src/inngest/reconfirmation-reminder-workflow.ts`
- Modify: `src/inngest/mandate-setup-reminder-workflow.ts`
- Modify: `src/inngest/reconcile-user-group-membership.ts`

**Approach:**
- Pattern for all workflow events: add a dedicated `step.run("capture-analytics", async () => { ... })` immediately after the step that performed the primary work. This ensures the capture is retried if it fails, and the step boundary prevents double-firing the primary work on retry.
- **`getCurrentUser()` is incompatible with Inngest step context.** It uses `next/headers` + React `cache()` which are not available in Inngest's execution environment. All user fetches inside Inngest steps must use `db.query.user.findFirst(...)` or equivalent direct Drizzle queries — never `getCurrentUser()`.
- `workflow_email_sent`: add after each email dispatch step in all workflows that send emails. Properties: `email_type` (a string constant per site, e.g., `"welcome"`, `"reconfirmation_reminder"`, `"mandate_setup_reminder"`), `subject_id` (the user's ID). Use the affected user's ID as `distinctId`.
- `workflow_group_member_added` and `workflow_group_member_removed`: add in `reconcile-user-group-membership.ts` after each member is added or removed. Include full subject metadata from `buildSubjectMetadata(user)`. Properties: `group_id`, `reason` (`"criteria_match"` or `"criteria_no_longer_matches"`). Use affected user's ID as `distinctId`.
- `workflow_step_failed` and `workflow_step_timeout`: add to Inngest's `onFailure` handlers where they exist, or wrap relevant `step.run` calls in try/catch. Properties: `workflow_name` (string constant), `step_name` (string constant), `error_category` (coarse classification derived from the error constructor name, e.g., `"TimeoutError"`, `"ValidationError"`, `"Unknown"`). Use affected user's ID as `distinctId` where available; fall back to a system sentinel if the user is not in context.
- Implementer should survey each workflow file for existing `onFailure` handlers before adding try/catch wrappers — prefer extending existing handlers over scattering try/catch across steps.

**Patterns to follow:**
- Existing `step.run("write-audit-log-*")` sibling steps in `membership-admission-workflow.ts` as the canonical pattern for analytics capture steps
- `buildSubjectMetadata()` from U1 for group reconciliation events

**Test scenarios:**
- Welcome email step completes: `workflow_email_sent` captured with `email_type: "welcome"` and `subject_id` matching the new user's ID
- Reconfirmation reminder dispatched: `workflow_email_sent` with `email_type: "reconfirmation_reminder"`
- Reconciliation adds a member to a group: `workflow_group_member_added` with `group_id`, `reason: "criteria_match"`, and subject metadata
- Reconciliation removes a member from a group: `workflow_group_member_removed` with `reason: "criteria_no_longer_matches"`
- Workflow step fails: `workflow_step_failed` captured with `workflow_name`, `step_name`, and coarse `error_category`; no PII or raw error message in properties
- PostHog capture step itself fails: Inngest retries the capture step; the primary work step is not re-executed

**Verification:**
- Triggering a workflow in development: PostHog activity for the affected user shows the workflow event alongside their user-initiated events

---

## System-Wide Impact

- **Import boundary:** `src/lib/posthog-server.ts` and `src/components/posthog-identify-client.tsx` are the only new files crossing the server/client boundary. All other new imports are server-only. No client component should import `posthog-server.ts`.
- **Error propagation:** PostHog capture failures must never propagate to callers. The `getPostHogClient()` null check handles the absent-env-var case; network errors from the PostHog client should be caught internally by `posthog-node`. No try/catch wrappers are needed around individual captures unless a specific action requires explicit error logging.
- **Unchanged invariants:** All existing server action return values and Inngest step outcomes are unchanged. Analytics tracking is append-only — no existing behavior is modified.
- **Integration coverage:** The full payment funnel (U5) and reconfirmation flow (U5 + U10 email reminder) cross layers and should be verified end-to-end in a development environment, not just unit-tested per action.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `posthog-server.ts` accidentally imported by a client component causes build failure | Verify build succeeds after each unit; check for bundler errors in CI |
| Subject user fetch (for admin events) adds latency to admin actions | Query runs after primary mutation, non-blocking; PostHog flushes asynchronously; acceptable for low-frequency admin operations |
| Inngest capture step retried, causing duplicate PostHog events | Acceptable — retry duplicates are rare and preferable to missing events; PostHog deduplication can be applied at query time if needed |
| `onboarding_completed` fires on the wrong step for users who skip event-invites | Implementer must trace the completion redirect path before committing the placement |
| `has_results` for `people_search_performed` unavailable client-side | Pass result count as prop from `page.tsx` to `page-client.tsx`; if result count is not currently a prop, add it |
| ~~`posthog-js` never initialized~~ | ~~Resolved~~ — `instrumentation-client.ts` already initializes PostHog with the `/ingest` proxy. No additional setup required. |

---

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-24-posthog-event-tracking-requirements.md](docs/brainstorms/2026-05-24-posthog-event-tracking-requirements.md)
- PostHog `data-ph-capture-attribute-*` docs: enriching autocapture events with custom properties
- `src/lib/posthog-server.ts` — existing scaffold
- `src/components/posthog-identify.tsx` — current identify component
- `src/db/membership-payments.ts` — `getLastActivationDate(userId)` for payment date lookup
- `src/app/(authenticated)/(app)/(default)/payments/charge-action.ts` / `decline-action.ts` — payment action patterns with `row.activationDate`
- `docs/solutions/conventions/pagination-server-pagecount-pattern-2026-05-18.md` — server/client boundary incident reference
