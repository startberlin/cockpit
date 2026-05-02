---
title: "refactor: Rework app copy and tone"
type: refactor
status: completed
date: 2026-05-01
origin: docs/brainstorms/2026-05-01-app-wide-copy-and-tone-rework-requirements.md
---

# refactor: Rework app copy and tone

## Overview

Rework START Cockpit's user-facing copy across membership, onboarding, tools, sign-in, admin people management, group automation, feedback states, and metadata. The plan follows the staged brainstorm but locks in final wording decisions from the follow-up interview so implementation can focus on applying the copy consistently.

The default member-facing tone is **warm and direct**: plain, concrete, human, and low on internal terminology. Admin-facing copy should stay precise and operational, with only targeted changes where current labels obscure the outcome.

---

## Problem Frame

The current app often describes internal mechanics ("GoCardless confirms", "billing setup", "software accounts", "Auto-Add Criteria") rather than the user's current situation. New members need to understand what happens next, how much membership costs, how often payment happens, and what the payment funds. Supporting alumni need a clear thank-you. Admins need labels that describe operational outcomes without losing precision.

This plan implements the copy direction from `docs/brainstorms/2026-05-01-app-wide-copy-and-tone-rework-requirements.md`.

---

## Requirements Trace

- R1-R3. Establish a warm/direct member voice and keep implementation terms out of member-facing copy unless useful.
- R4-R8. Rewrite membership payment, active member, supporting alumni, alumni, and processing-state copy.
- R9-R11. Improve onboarding welcome, contact details, personal email guidance, and address/privacy copy.
- R12-R14. Rewrite tools, sign-in, and selected email copy so app and email tone are aligned.
- R15-R16. Improve admin people-management labels and confirmation copy.
- R17. Keep current status descriptions unchanged per planning decision.
- R18. Keep the group `Slug` label unchanged per planning decision.
- R19-R20. Rename group automation language around "Matching rules".
- R21-R24. Improve table empty states, failure copy pattern, typo fixes, and metadata descriptions.

**Origin actors:** A1 new onboarding member, A2 active member, A3 supporting alumni, A4 alumni, A5 admin/operator, A6 future copy implementer

**Origin flows:** F1 new member completes onboarding and reaches payment setup, F2 supporting alumni checks membership page, F3 admin creates/imports/updates people, F4 admin manages groups and automatic membership, F5 user hits empty/loading/success/error states

**Origin acceptance examples:** AE1 membership payment clarity, AE2 supporting alumni recognition, AE3 onboarding data clarity, AE4 tools and email alignment, AE5 admin people-management clarity, AE6 group automation clarity, AE7 contextual feedback and metadata

---

## Scope Boundaries

- Do not change membership status logic, payment behavior, permissions, integrations, or database schema.
- Do not redesign layouts except for minor text fit adjustments if implementation reveals a copy string does not fit.
- Do not rewrite current admin status tooltip descriptions in `src/lib/user-status.ts`.
- Do not rename the group creation `Slug` field.
- Do not add localization or multilingual copy.
- Do not introduce a large content system; keep the copy directly in the existing surfaces unless implementation naturally benefits from small helpers.

---

## Context & Research

### Relevant Code and Patterns

- Membership page copy is centralized in `src/app/(authenticated)/(app)/membership/billing-copy.ts`, with coverage in `src/app/(authenticated)/(app)/membership/billing-copy.test.ts`.
- Membership rendering and tools card copy live in `src/app/(authenticated)/(app)/membership/onboarding.tsx`, `src/app/(authenticated)/(app)/membership/slack-dialog.tsx`, `src/app/(authenticated)/(app)/membership/notion-dialog.tsx`, and `src/app/(authenticated)/(app)/membership/payment-button.tsx`.
- Onboarding step copy is split between `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/index.tsx`, `step-master-data.tsx`, and `step-address.tsx`.
- Sign-in copy lives in `src/app/auth/page.tsx` and `src/app/auth/google.tsx`.
- People-management copy lives in `src/components/people-table.tsx`, `src/app/(authenticated)/(app)/people/create-user-dialog.tsx`, and `src/app/(authenticated)/(app)/people/import-google-user-dialog.tsx`.
- Group management copy lives in `src/app/(authenticated)/(app)/groups/create-group-dialog.tsx`, `src/app/(authenticated)/(app)/groups/[id]/page-client.tsx`, `src/components/group-criteria-manager.tsx`, `src/components/bulk-add-users-dialog.tsx`, and `src/components/groups-table.tsx`.
- Email copy lives in `src/emails/membership-payment-ready.tsx`, `src/emails/start-cockpit-enabled.tsx`, and `src/emails/signin-instructions.tsx`. Existing email test coverage includes `src/emails/start-cockpit-enabled.test.tsx`.

### Institutional Learnings

- No `docs/solutions/` directory exists in this repo, so there are no local learning docs to incorporate.

### External References

- None. This is a local copy/tone refactor using existing product requirements and user-selected wording.

---

## Key Copy Decisions

- **Default member tone:** Warm and direct.
- **Payment setup title:** "Set up your yearly membership payment"
- **Payment setup description:** "Your START Berlin membership costs 40 EUR per year. It covers the essentials that keep the association running and helps fund internal and external events and member benefits throughout the year."
- **Payment setup button:** "Set up payment"
- **Active member copy:** Title "Your membership is active"; description "Your yearly membership payment is set up. Thanks for being part of START Berlin."
- **Supporting alumni copy:** Title "Thanks for supporting START Berlin"; description "Your yearly payment is set up. Thank you for continuing to support the community as alumni."
- **Alumni copy:** Title "You're listed as alumni"; description "No membership payment is needed. START Cockpit will show anything relevant to your alumni status here."
- **Processing copy:** Title "Finishing your membership setup"; description "We're updating your membership status. This usually only takes a moment."
- **Onboarding welcome:** Title "Welcome to START Berlin"; description "Let's finish the details START needs for your membership. This only takes a few minutes."
- **Contact details step:** Title "Your contact details"; description "Add the email address and phone number START Berlin can use to reach you."
- **Personal email helper:** "Use a personal email address you'll keep long-term. Avoid school or work addresses that you might lose access to later."
- **Locked field tooltip:** Keep "You cannot change this."
- **Address step:** Title "Your address"; description "Add your current address so START Berlin can keep its membership records up to date."; helper "We only show this to people who need it for administration."
- **Tools section split:**
  - Onboarding title "Get connected"; description "Join the START Berlin workspaces where members coordinate, share resources, and work on projects."
  - Active title "Your START Berlin tools"; description "Open the workspaces you use for communication, projects, and resources."
- **Slack split:**
  - Onboarding description "Join Slack for START Berlin communication, updates, and day-to-day coordination."
  - Active description "Open Slack for START Berlin communication, updates, and day-to-day coordination."
- **Notion split:**
  - Onboarding description "Join Notion to access START Berlin resources, project docs, and internal information."
  - Active description "Open Notion to access START Berlin resources, project docs, and internal information."
- **Access-disabled sign-in error:** Title "Your account is not ready yet"; description "A START Berlin admin needs to enable your account before you can sign in."; support text "If you think this is a mistake, email operations@start-berlin.com."
- **Supporting alumni access email:** Keep "You have been added to START Cockpit as Supporting Alumni."
- **Admin onboarding action:** "Invite to finalize membership"
- **Admin onboarding confirmation:** Title "Invite {name} to finalize membership?"; description "This marks their onboarding as complete and asks them to set up their yearly membership payment."
- **People dialog labels:** Use "Add member" for the normal create flow and "Import from Google Workspace" for existing accounts.
- **Status descriptions:** Keep current admin tooltip descriptions unchanged.
- **Group `Slug`:** Leave as-is.
- **Group automation:** Rename "Auto-Add Criteria" to "Matching rules".
- **Matching rules empty state:** Title "No matching rules"; description "Automatically add future members to this group when they match the rule."
- **Table search empty states:** "No members match this search."; "No groups match this search."
- **Failure pattern:** Prefer "Could not [action]. Please try again. If this keeps happening, email operations@start-berlin.com." where a user may be blocked.
- **Metadata direction:** Simple page-specific descriptions:
  - Membership: "View your START Berlin membership status and tools."
  - People: "Manage START Berlin members."
  - Groups: "View and manage START Berlin groups."
  - Auth: "Sign in to START Cockpit with your START Berlin Google account."

---

## Open Questions

### Resolved During Planning

- Supporting alumni amount visibility: do not name the amount in supporting alumni status copy in this pass.
- Address privacy wording: use "We only show this to people who need it for administration."
- Support path: use `operations@start-berlin.com` for blocked/retry-failed user-facing errors.
- Slug terminology: keep `Slug` unchanged.
- Status descriptions: keep current admin tooltip descriptions unchanged.

### Deferred to Implementation

- Exact text wrapping/layout fit: if a selected string is too long in a compact UI surface, preserve meaning while making the smallest wording adjustment needed for fit.
- Whether to add component-level tests for static UI copy: prefer updating existing focused tests first; add new tests only where the repo already has a practical pattern or where copy is generated by logic.

---

## Implementation Units

- U1. **Membership and payment copy**

**Goal:** Apply the selected member-facing membership, payment, alumni, supporting alumni, and processing copy.

**Requirements:** R4-R8, AE1, AE2, F1, F2

**Dependencies:** None

**Files:**
- Modify: `src/app/(authenticated)/(app)/membership/billing-copy.ts`
- Modify: `src/app/(authenticated)/(app)/membership/onboarding.tsx`
- Modify: `src/app/(authenticated)/(app)/membership/payment-button.tsx`
- Modify: `src/app/(authenticated)/(redirect)/membership/payment-return/payment-return-redirect.tsx`
- Test: `src/app/(authenticated)/(app)/membership/billing-copy.test.ts`

**Approach:**
- Update `getMembershipBillingCopy` to use the selected final strings for payment-pending, processing, full member, supporting alumni, and alumni states.
- Keep the covered-through variant but rewrite it in the same warm/direct style, preserving the reassurance that members will not be charged before the covered-through date.
- Use "Set up payment" as the idle button label. Keep loading text short; "Opening payment..." is acceptable unless the final implementation needs a smaller label.
- Update payment-return failure copy to follow the retry/support pattern if setup cannot be finished.

**Patterns to follow:**
- Keep copy branching centralized in `billing-copy.ts`.
- Keep date interpolation style from the existing `formatDate` helper.
- Update existing billing copy tests instead of adding unrelated UI tests.

**Test scenarios:**
- Covers AE1. Happy path: payment-pending member with no `paidThroughAt` receives title "Set up your yearly membership payment" and the selected 40 EUR yearly description.
- Happy path: payment-pending member with future `paidThroughAt` receives covered-through reassurance while still using yearly membership payment language.
- Covers AE2. Happy path: supporting alumni receives title "Thanks for supporting START Berlin" and the selected thank-you description.
- Happy path: alumni receives "You're listed as alumni" and no-payment-needed description.
- Happy path: full member receives active membership title and thank-you description.
- Happy path: processing state receives "Finishing your membership setup" and the selected updating-status description.

**Verification:**
- Membership page copy no longer leads with GoCardless, billing setup, or vague "membership actions" language for member-facing states.
- Existing membership copy tests pass after expected string updates.

---

- U2. **Onboarding profile and address copy**

**Goal:** Apply the selected onboarding welcome, contact details, personal email, and address copy.

**Requirements:** R9-R11, AE3

**Dependencies:** None

**Files:**
- Modify: `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/index.tsx`
- Modify: `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/step-master-data.tsx`
- Modify: `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/step-address.tsx`

**Approach:**
- Replace welcome copy with "Welcome to START Berlin" and the selected short onboarding description.
- Replace the contact step title/description with "Your contact details" and the selected reachability description.
- Replace personal email helper with the selected two-sentence guidance.
- Keep locked field tooltip copy as "You cannot change this."
- Replace address description/helper with the selected membership-records and need-to-know administration copy.
- Fix "An error occured" typo in this area if touched here; otherwise U6 handles it.

**Patterns to follow:**
- Keep step titles centralized in the existing `STEP_DEFINITIONS` map.
- Keep field-level helper text next to the relevant form fields.

**Test scenarios:**
- Test expectation: none -- these are static UI copy changes in client components with no existing component test pattern in the repo.

**Verification:**
- Onboarding screens explain why the user is entering details without adding new interactions or changing validation behavior.
- Locked-field tooltip remains unchanged.

---

- U3. **Tools, sign-in, and email copy**

**Goal:** Apply the selected status-aware tools copy, sign-in access copy, and email alignment decisions.

**Requirements:** R12-R14, AE4

**Dependencies:** U1 for membership status wording consistency

**Files:**
- Modify: `src/app/(authenticated)/(app)/membership/billing-copy.ts`
- Modify: `src/app/(authenticated)/(app)/membership/onboarding.tsx`
- Modify: `src/app/(authenticated)/(app)/membership/slack-dialog.tsx`
- Modify: `src/app/(authenticated)/(app)/membership/notion-dialog.tsx`
- Modify: `src/app/auth/page.tsx`
- Modify: `src/app/auth/google.tsx`
- Modify: `src/emails/membership-payment-ready.tsx`
- Modify: `src/emails/start-cockpit-enabled.tsx`
- Test: `src/app/(authenticated)/(app)/membership/billing-copy.test.ts`
- Test: `src/emails/start-cockpit-enabled.test.tsx`

**Approach:**
- Update `getMembershipToolsCopy` so onboarding users see "Get connected" with the selected join-workspaces description, and active users see "Your START Berlin tools" with the selected open-workspaces description.
- Update Slack card/dialog copy with onboarding/active split:
  - Onboarding: "Join Slack for START Berlin communication, updates, and day-to-day coordination."
  - Active: "Open Slack for START Berlin communication, updates, and day-to-day coordination."
- Update Notion card/dialog copy with onboarding/active split:
  - Onboarding: "Join Notion to access START Berlin resources, project docs, and internal information."
  - Active: "Open Notion to access START Berlin resources, project docs, and internal information."
- Replace disabled-access sign-in error with the selected "Your account is not ready yet" copy.
- Keep the supporting alumni access email sentence as "You have been added to START Cockpit as Supporting Alumni."
- Align membership-payment email with the selected payment description:
  - "Your START Berlin membership costs 40 EUR per year. It covers the essentials that keep the association running and helps fund internal and external events and member benefits throughout the year."
  - Replace provider-led setup phrasing with a direct instruction to open START Cockpit and set up the yearly membership payment.

**Patterns to follow:**
- Preserve existing desktop/mobile dialog structure for Slack and Notion.
- Reuse existing status-aware tool copy helper rather than duplicating status branching in rendering components.
- Update existing email test expectations instead of adding a separate snapshot system.

**Test scenarios:**
- Happy path: onboarding tools copy returns "Get connected" and the selected join-workspaces description.
- Happy path: active member tools copy returns "Your START Berlin tools" and the selected open-workspaces description.
- Happy path: alumni tools remain hidden as before.
- Happy path: start cockpit enabled email for `supporting_alumni` still renders "You have been added to START Cockpit as Supporting Alumni."

**Verification:**
- Slack and Notion no longer share generic "latest news and announcements" language.
- Sign-in access-disabled error explains account readiness and gives the support email only as the recovery path.

---

- U4. **Admin people-management copy**

**Goal:** Apply the selected admin labels and confirmation copy while preserving current status descriptions.

**Requirements:** R15-R17, AE5

**Dependencies:** U1 for payment terminology consistency

**Files:**
- Modify: `src/components/people-table.tsx`
- Modify: `src/app/(authenticated)/(app)/people/page-client.tsx`
- Modify: `src/app/(authenticated)/(app)/people/create-user-dialog.tsx`
- Modify: `src/app/(authenticated)/(app)/people/import-google-user-dialog.tsx`
- Do not modify for copy: `src/lib/user-status.ts`

**Approach:**
- Rename the admin action from "Complete onboarding" to "Invite to finalize membership."
- Update confirmation dialog:
  - Title: "Invite {name} to finalize membership?"
  - Description: "This marks their onboarding as complete and asks them to set up their yearly membership payment."
- Adjust success toast copy so it reflects the member being invited to finalize membership rather than simply "Onboarding completed."
- Rename create/import entry points:
  - Normal create flow: "Add member"
  - Existing Google account flow: "Import from Google Workspace"
- Keep current status tooltip descriptions unchanged.
- Keep operational clarity in helper descriptions, but avoid over-broad rewrites where the user chose stability.

**Patterns to follow:**
- Continue using existing `Can` permission wrappers and dialog structure.
- Keep create/import behavior unchanged; copy must not imply a different backend flow.

**Test scenarios:**
- Test expectation: none -- these are mostly static dialog/table labels in components without current component tests; behavior and action logic remain unchanged.

**Verification:**
- Admin action copy describes the outcome: the member is moved to final membership setup.
- Create/import buttons distinguish adding a member from importing from Google Workspace.
- `src/lib/user-status.ts` remains unchanged unless a typo-only follow-up is explicitly requested later.

---

- U5. **Group matching-rules copy**

**Goal:** Rename the group automation surface around "Matching rules" while leaving `Slug` unchanged.

**Requirements:** R18-R20, AE6

**Dependencies:** None

**Files:**
- Modify: `src/components/group-criteria-manager.tsx`
- Modify: `src/components/bulk-add-users-dialog.tsx`
- Modify: `src/app/(authenticated)/(app)/groups/[id]/page-client.tsx`
- Do not rename: `src/app/(authenticated)/(app)/groups/create-group-dialog.tsx` `Slug` label

**Approach:**
- Replace "Auto-Add Criteria" and obvious variants with "Matching rules."
- Empty state:
  - Title: "No matching rules"
  - Description: "Automatically add future members to this group when they match the rule."
- Keep the `Slug` field label and helper unchanged unless implementation finds incidental copy that refers to the same concept elsewhere.
- Prefer sentence case where touching related button labels, but do not do a broad capitalization refactor across the group detail page.

**Patterns to follow:**
- Preserve existing group criteria behavior and API calls.
- Keep terminology changes local to visible UI strings.

**Test scenarios:**
- Test expectation: none -- this unit renames static UI copy and does not alter the matching rules behavior or API contract.

**Verification:**
- Group automation no longer says "Auto-Add Criteria" in the visible UI.
- Group creation still labels the field as `Slug`.

---

- U6. **Feedback states, empty states, metadata, and typo fixes**

**Goal:** Apply selected empty-state, failure, metadata, and typo improvements across the app.

**Requirements:** R21-R24, AE7, F5

**Dependencies:** U1-U5 for terminology consistency

**Files:**
- Modify: `src/components/people-table.tsx`
- Modify: `src/components/groups-table.tsx`
- Modify: `src/app/(authenticated)/(redirect)/membership/payment-return/payment-return-redirect.tsx`
- Modify: `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/step-master-data.tsx`
- Modify: `src/app/(authenticated)/(app)/people/create-user-dialog.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/(authenticated)/(app)/membership/page.tsx`
- Modify: `src/app/(authenticated)/(app)/people/page.tsx`
- Modify: `src/app/(authenticated)/(app)/groups/page.tsx`
- Modify: `src/app/auth/page.tsx`

**Approach:**
- Replace people table search empty state with "No members match this search."
- Replace groups table search empty state with "No groups match this search."
- Apply the selected failure pattern where recovery matters: "Could not [action]. Please try again. If this keeps happening, email operations@start-berlin.com."
- Use shorter retry-only copy only where the error is purely admin utility feedback and the support sentence would be noisy.
- Fix "An error occured" to "An error occurred" where it remains.
- Update metadata descriptions:
  - Membership: "View your START Berlin membership status and tools."
  - People: "Manage START Berlin members."
  - Groups: "View and manage START Berlin groups."
  - Auth: "Sign in to START Cockpit with your START Berlin Google account."
- Keep metadata titles unless there is an obvious duplicate that makes previews misleading.

**Patterns to follow:**
- Use existing `createMetadata` helper.
- Keep toast style consistent with current `sonner` usage.

**Test scenarios:**
- Test expectation: none -- this unit is static feedback/metadata copy with no existing metadata or component test pattern in the repo.

**Verification:**
- Search-empty copy is entity-specific.
- Recoverable blocked states give retry/support guidance.
- Metadata descriptions are page-specific rather than repeated generic app copy.
- Typo "occured" no longer appears in app source.

---

## System-Wide Impact

- **Interaction graph:** No routes, actions, API handlers, or data flows should change. The work touches rendering components, copy helpers, emails, toasts, and metadata only.
- **Error propagation:** Error handling behavior remains unchanged; only recoverable messages become clearer.
- **State lifecycle risks:** Membership state logic must remain unchanged while copy changes by state.
- **API surface parity:** No external API or database contract changes.
- **Integration coverage:** Existing billing copy tests provide the best state-based safety net. UI-only static copy should be reviewed manually in affected pages after implementation.
- **Unchanged invariants:** Payment setup still uses the existing GoCardless flow; user statuses and group criteria behavior remain unchanged.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Copy accidentally implies changed payment behavior | Keep implementation limited to strings and preserve existing branching/state logic. |
| Supporting alumni copy overstates payment details | Do not mention amount in supporting alumni page copy in this pass. |
| Admin copy becomes less precise | Preserve chosen stable terms: keep status descriptions and `Slug` unchanged. |
| Static copy breaks compact layouts | Verify affected pages manually after implementation; shorten only if needed while preserving selected meaning. |
| Tests become brittle from over-testing static UI strings | Test state-based copy helpers and email variants; avoid adding broad component tests solely for static labels unless a local pattern already exists. |

---

## Documentation / Operational Notes

- No README or external documentation update is required.
- The selected copy decisions in this plan should serve as the source of truth for implementation.
- If future product owners want a more complete content style guide, extract the "warm and direct" rules from this plan into a separate design/content document later.

---

## Sources & References

- **Origin document:** `docs/brainstorms/2026-05-01-app-wide-copy-and-tone-rework-requirements.md`
- Related plan context: `docs/plans/2026-04-26-001-feat-gocardless-membership-payment-plan.md`
- Related plan context: `docs/plans/2026-04-29-003-refactor-membership-page-sections-plan.md`
