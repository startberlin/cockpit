---
date: 2026-05-24
topic: posthog-event-tracking
---

# PostHog Event Tracking

## Summary

Add comprehensive custom event tracking and extended user identification to the existing PostHog integration. Every named event includes structured metadata; events acting on a member include that member's key profile properties as subject metadata so any event can be sliced by department, status, batch, or membership state in PostHog.

---

## Problem Frame

PostHog is already installed and tracking page views and autocaptured clicks, but there is no custom event instrumentation. This makes it impossible to answer product questions that autocapture cannot answer: which step of the membership application do users abandon? Which filters do people use on the directory? Does a user's department predict whether their payment gets declined? How long does the reconfirmation flow take end-to-end, and do users complete it in one sitting or return later?

The user identification in place today passes only email and name. None of the richer attributes the app holds — status, department, batch number, legal membership state — are linked to PostHog, so no insight can be segmented by cohort or role without a manual data join.

Background workflows (Inngest jobs) are entirely invisible to the current setup. Automatic group reconciliation, email sends, and workflow failures leave no analytics trace, making it impossible to correlate system-initiated changes with user behavior.

---

## Actors

- A1. **Member** — any user in onboarding, active, alumni, or transitioning status interacting with member-facing pages (membership hub, people directory, groups, profile settings, application flow)
- A2. **Admin** — staff user performing operational actions on members (charging payments, proposing membership, managing batches, updating permissions)
- A3. **System** — Inngest background workflows running server-side without a human actor (group reconciliation, email delivery, reconfirmation reminders)

---

## Key Flows

- F1. **Onboarding**
  - **Trigger:** New user signs in for the first time and is routed to `/onboarding`
  - **Actors:** A1
  - **Steps:** Welcome → Master Data (email, phone, birthdate) → Event Email Preference (if applicable) → redirected to app
  - **Outcome:** User has set core profile fields and email preference; PostHog funnel shows step completion and email preference distribution
  - **Covered by:** R5, R6, R7, R8

- F2. **Membership Application**
  - **Trigger:** Member begins `/membership/application/[step]`
  - **Actors:** A1
  - **Steps:** Welcome → Personal Info → Identity → Fees → Bylaws → Review → Submit
  - **Outcome:** Application submitted or abandoned at a known step; funnel view in PostHog shows per-step drop-off and step duration from PostHog timestamps
  - **Covered by:** R9, R10, R11, R12

- F3. **Reconfirmation / Payment Setup**
  - **Trigger:** Member initiates payment from the membership hub (prompted by reconfirmation reminder or own initiative)
  - **Actors:** A1, A3 (reminder email)
  - **Steps:** Hub → Start payment → GoCardless redirect → Return to app → Mandate confirmed or failed
  - **Outcome:** Mandate established or abandoned; PostHog funnel shows how many users complete in one session vs. return later, and where they drop off
  - **Covered by:** R13, R14, R15, R41

- F4. **Membership Transition (Alumni / Cancel)**
  - **Trigger:** Member initiates transition from the membership hub
  - **Actors:** A1
  - **Steps:** Hub → Choose transition type → Confirm → (optionally retract)
  - **Outcome:** Transition requested or retracted; distribution of transition types visible in PostHog
  - **Covered by:** R28, R29

---

## Requirements

**User identification**

- R1. The PostHog identify call (currently in `src/components/posthog-identify.tsx`) must be extended to include the following person properties: `status`, `department`, `batch_number`, `legal_membership_state`, `event_email_preference`, `member_since` (ISO date string). These update on every session so PostHog always reflects current values.

**General event rules**

- R2. All custom events use `snake_case` past-tense naming in the form `<context>_<action>` or `<context>_<entity>_<action>` (e.g., `people_filter_applied`, `admin_payment_declined`).
- R3. Any event that acts on a specific member (admin operations, group membership changes, workflow-initiated changes) includes **subject metadata** as event properties: `subject_id`, `subject_status`, `subject_department`, `subject_batch_number`, `subject_legal_membership_state`, `subject_member_since_date`. Payment events additionally include `subject_last_payment_date`.
- R4. Server-side mutations (form submissions, server actions, Inngest steps) emit events via the existing `src/lib/posthog-server.ts` client. Pure UI interactions (filter changes, view toggles, link clicks) emit via `posthog-js` on the client.

**Onboarding flow**

- R5. `onboarding_started` — emitted when the welcome step is rendered. No additional properties beyond the identified user.
- R6. `onboarding_master_data_submitted` — emitted on successful master-data step submission. Properties: `had_personal_email` (bool), `had_phone` (bool), `had_birth_date` (bool).
- R7. `onboarding_email_preference_selected` — emitted on successful event-invites step submission. Properties: `preference` (`personal_email` | `start_email` | `custom`).
- R8. `onboarding_completed` — emitted after the final onboarding step is processed and the user is redirected to the app.

**Membership application flow**

- R9. `membership_application_started` — emitted when the user lands on the first application step.
- R10. `membership_application_step_entered` — emitted each time a step page is rendered. Properties: `step` (step name string, e.g., `personal-information`, `identity`, `fees`, `bylaws`, `review`).
- R11. `membership_application_step_completed` — emitted on successful step form submission. Properties: `step` (same values as R10).
- R12. `membership_application_submitted` — emitted on final application submission.

**Reconfirmation and payment setup**

- R13. `payment_setup_started` — emitted when the member initiates the GoCardless payment flow from the membership hub.
- R14. `payment_mandate_returned` — emitted when the user returns from GoCardless. Properties: `success` (bool).
- R15. `payment_mandate_confirmed` — emitted when the mandate is verified as active on the server side.

**Member profile**

- R16. `profile_updated` — emitted on successful contact-details form submission. Properties: `changed_fields` (string array of field names that differed from prior values, e.g., `["phone", "personal_email"]`).

**People directory**

- R17. `people_filter_applied` — emitted each time a filter value is selected. Properties: `filter` (`department` | `status` | `batch`), `value` (the selected value).
- R18. `people_filter_cleared` — emitted each time a filter is removed. Properties: `filter` (`department` | `status` | `batch`).
- R19. `people_search_performed` — emitted when the search input is submitted or debounce fires with a non-empty query. Properties: `has_results` (bool). Raw query text is not captured.
- R20. `people_view_mode_changed` — emitted when the user switches between grid and list view. Properties: `to` (`grid` | `list`).

**Group management**

- R21. `group_created` — emitted on successful group creation. Properties: `has_email_integration` (bool).
- R22. `group_member_added` — emitted when a single member is added to a group. Includes subject metadata for the added member.
- R23. `group_bulk_members_added` — emitted when members are added via criteria. Properties: `criteria_type` (`department` | `status` | `batch`), `member_count` (number of members added).
- R24. `group_member_removed` — emitted when a member is removed from a group. Includes subject metadata for the removed member.
- R25. `group_member_pinned` — emitted when a member's pin state changes. Includes subject metadata. Properties: `pinned` (bool).
- R26. `group_email_copied` — emitted when the group email address is copied to clipboard.
- R27. `group_members_exported` — emitted when the member list CSV is downloaded.

**Membership transitions**

- R28. `membership_transition_requested` — emitted on successful transition request. Properties: `transition_type` (`supporting_alumni` | `alumni` | `cancel`). For cancellations, also capture `had_reason` (bool, not the reason text).
- R29. `membership_transition_retracted` — emitted when a pending transition is retracted. Properties: `transition_type`.
- R30. `external_link_clicked` — emitted when the user clicks an external service link from the membership hub. Properties: `service` (`slack` | `canva` | `notion` | `tally` | `bubbles`).

**Admin: user management**

- R31. `admin_user_created` — emitted on successful admin user creation. No subject metadata (user is new).
- R32. `admin_user_removed` — emitted on successful user removal. Includes subject metadata.
- R33. `admin_membership_proposed` — emitted when admin proposes membership for a user. Includes subject metadata.
- R34. `admin_user_imported` — emitted when a user is imported from Google Workspace. Includes subject metadata.
- R35. `admin_permissions_updated` — emitted on successful permission change. Includes subject metadata. Properties: `permissions_added` (string array), `permissions_removed` (string array).

**Admin: payment operations**

- R36. `admin_payment_charged` — emitted when admin charges a payment. Includes subject metadata. Properties: `payment_amount_cents` (integer).
- R37. `admin_payment_declined` — emitted when admin declines a payment. Includes subject metadata (including `subject_last_payment_date`). Properties: `payment_amount_cents` (integer).

**Admin: batch management**

- R38. `admin_batch_created` — emitted on batch creation. Properties: `batch_number` (integer).
- R39. `admin_batch_updated` — emitted on batch update. Properties: `fields_changed` (string array).
- R40. `admin_batch_deleted` — emitted on batch deletion. Properties: `batch_number` (integer).

**Inngest workflow events**

- R41. `workflow_email_sent` — emitted after a transactional email is successfully dispatched. Properties: `email_type` (e.g., `welcome`, `reconfirmation_reminder`), `subject_id` (recipient user ID, not the full subject metadata set).
- R42. `workflow_group_member_added` — emitted when a reconciliation workflow adds a member to a group. Includes full subject metadata. Properties: `group_id`, `reason` (e.g., `criteria_match`).
- R43. `workflow_group_member_removed` — emitted when a reconciliation workflow removes a member. Includes full subject metadata. Properties: `group_id`, `reason` (e.g., `criteria_no_longer_matches`).
- R44. `workflow_step_failed` — emitted on Inngest step failure. Properties: `workflow_name`, `step_name`, `error_category` (a coarse classification; no PII or raw error messages).
- R45. `workflow_step_timeout` — emitted when an Inngest step times out. Properties: `workflow_name`, `step_name`.

---

## Success Criteria

- PostHog funnel views for onboarding, membership application, and reconfirmation flows show per-step completion rates and can be filtered by department, status, and batch number.
- The question "which email preference do users most often select in onboarding?" is answerable directly from a PostHog insight with no data export.
- The question "which filters do users apply most often on the people directory?" is answerable from a PostHog trends query on `people_filter_applied` broken down by `filter` and `value`.
- Admin payment decline events show `subject_last_payment_date` and `subject_department`, enabling pattern detection (e.g., "are declines clustered in a particular batch or date cohort?").
- Background workflow events appear in user timelines in PostHog alongside user-initiated events, so a member's full account lifecycle is visible in one place.

---

## Scope Boundaries

- Custom PostHog dashboards and insights are not part of this work — instrumentation only; dashboards are set up after data flows.
- Autocapture is not modified or disabled; custom events layer on top.
- Org chart interactions (pan, zoom, center) are not tracked — low analytical value.
- Audit log page access is not tracked — the audit log itself already records all actions.
- Raw search query text and cancellation reason text are not captured in events to limit exposure of free-text PII.
- PostHog feature flags, A/B testing, and experiments are out of scope.

---

## Key Decisions

- **Subject metadata is a snapshot, not a live join.** Properties are captured at the time of the event, so a payment decline event reflects the member's state on the day of the decline even if their status changes later. This is intentional.
- **Step timing uses PostHog timestamps, not client-side elapsed time.** Firing `step_entered` and `step_completed` events at each boundary lets PostHog compute duration natively in funnel views. No client-side timer logic is needed.
- **Raw query and reason text are excluded from event properties.** Filter values (department names, status names, batch IDs) are included since they are enumerated, but free-text search queries and cancellation reasons are omitted to avoid PII in analytics.
- **Workflow events identify actor as system, not a user ID.** Inngest events are emitted with the affected member's subject metadata but without an acting-user identity (there is none); PostHog `distinct_id` for these events uses the affected member's user ID so they appear on that member's timeline.

---

## Dependencies / Assumptions

- PostHog project token and host are already configured (`NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST`); both `posthog-js` and `posthog-node` are already installed.
- `src/lib/posthog-server.ts` already provides a server-side PostHog client; all server-side event emission extends it without new infrastructure.
- `subject_last_payment_date` requires a query to payment records at event-emission time; planning should confirm the most efficient way to fetch this without adding latency to admin actions.
