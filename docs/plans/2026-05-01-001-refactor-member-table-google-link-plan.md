---
title: "refactor: Remove member table provider details"
type: refactor
status: completed
date: 2026-05-01
origin: docs/brainstorms/2026-04-28-google-workspace-existing-user-linking-requirements.md
---

# refactor: Remove Member Table Provider Details

## Overview

Revise the Google Workspace import direction so START Cockpit does not persist a Google identity link at all. Every local user is assumed to have a Google Workspace account reachable by their START email, so Google lookup and duplicate prevention should be email-based and transient.

At the same time, simplify the member table: it should show member/person attributes only, not payment-processing state or Google connection details. Payment and provider-specific context can remain in membership flows or focused detail views where it is needed, but the table should not become a billing or integration dashboard.

---

## Problem Frame

The existing import plan in `docs/plans/2026-04-28-002-feat-google-workspace-user-import-plan.md` assumed that imported users need a durable `googleWorkspaceId` and that some Google identity details may be displayed after import. The updated product decision rejects that: START Cockpit already has the stable durable identifier it needs, `user.email`, and can query Google Workspace by email whenever it needs provider state.

The people/member table also currently exposes payment-derived labels such as `Payment pending` and `Payment processing` via `src/components/people-table.tsx`. That makes the table carry operational payment details even though the table should stay focused on member identity, department, batch, status, and actions.

---

## Requirements Trace

- R1. Do not add or persist any Google Workspace identity attribute on local users.
- R2. Google Workspace lookups for existing users must use `user.email` as the durable correlation key.
- R3. Import/search flows may use Google provider IDs transiently during a single server-side verification, but must not store them in the database or expose them as persistent UI state.
- R4. The member table must not display payment status, payment-processing labels, provider IDs, Google connection state, or Google-specific connection details.
- R5. Existing membership payment behavior must remain intact outside the member table.
- R6. The revised plan must supersede the stale durable-link assumptions in the earlier Google Workspace import plan.

**Origin actors:** A1 Import admin, A2 User admin, A3 Existing Workspace user, A4 New START user, A5 START Cockpit, A6 Google Workspace Directory
**Origin flows:** F1 Import an existing Google Workspace user, F2 Create a new user, F3 Imported user reaches membership payment
**Origin acceptance examples:** AE1 import existing Workspace user, AE2 already-linked result disabled, AE3 create flow exact conflict blocks, AE4 imported paid-through member is covered, AE5 new onboarding still starts payment immediately

---

## Scope Boundaries

- No `googleWorkspaceId`, Google subject, Google resource name, or equivalent persistent provider-link column should be added to `user` or a side table.
- No member table indicators for Google linkage, GoCardless state, payment pending, payment processing, paid-through dates, or subscription identifiers.
- No change to the existence of the membership payment model itself.
- No change to the assumption that local users authenticate through Google.
- No broad redesign of the people profile page; only remove or avoid provider details where they were planned for the table.
- No full rewrite of the existing Google Workspace import plan in this unit of work; this plan documents the corrective refactor and superseding decisions.

---

## Context & Research

### Relevant Code and Patterns

- `src/db/schema/auth.ts` defines the `user` table and currently has no stored Google Workspace identity field. This should remain true.
- `src/components/people-table.tsx` currently maps `membershipViewState` to `Payment pending` and `Payment processing` labels in the table status column.
- `src/db/people.ts` currently includes `membershipViewState` and `hasMembershipPayment` in `PublicUser` to support table display and table actions.
- `src/app/(authenticated)/(app)/people/[id]/profile-card.tsx` also displays payment-derived status details; this plan only requires removing them from the member table unless implementation confirms shared read-model cleanup can be done without changing profile behavior.
- `src/db/schema/membership.ts`, `src/db/membership.ts`, and `src/lib/membership-status.ts` remain the correct homes for payment state and membership state decisions.
- `docs/plans/2026-04-28-002-feat-google-workspace-user-import-plan.md` contains stale direction that should be overridden where it calls for a durable Workspace identity link or table display of imported identity.

### Institutional Learnings

- No `docs/solutions/` directory is present in this repository, so there are no local learning docs to carry forward.

### External References

- External research is not needed for this corrective plan. The decision is product and architecture-driven, and the repository already has the relevant local surfaces.

---

## Key Technical Decisions

- **Email is the durable Google correlation key:** Use `user.email` to look up users in Google Workspace. This matches the product assumption that every local user has a Google account and avoids duplicating provider identity state.
- **Provider IDs may be transient only:** Search or import code may accept a selected Google result during a request, then re-fetch and verify server-side, but the database should store only local user fields and membership timing.
- **Duplicate detection becomes email-based:** "Already linked" in older requirements should now mean "a local user already exists with this Google primary email", not "a stored Google ID matches".
- **Member table stays operationally quiet:** The table should show the ordinary user status from `user.status` and not reinterpret it with membership payment state.
- **Keep payment state where it belongs:** Membership flows and actions can still use `membershipPayment`, `getMembershipViewState`, and paid-through semantics; the table simply stops surfacing those details.

---

## Open Questions

### Resolved During Planning

- **Should START Cockpit persist a stable Google Workspace ID?** No. The local email is the durable lookup key; Google IDs are transient request data only.
- **Should the member table show payment or Google connection details?** No. The table should not expose those provider details at all.
- **How should the older import plan's already-linked requirement be interpreted?** As email existence: if a Google search result has a primary email already present in local `user.email`, it is already represented in START Cockpit.

### Deferred to Implementation

- **Should `PublicUser` keep `membershipViewState` for table actions?** Implementation should inspect whether `Complete onboarding` still needs `hasMembershipPayment` or `membershipViewState` in the table row. Remove table-only payment fields when possible, but keep the minimum data needed to preserve existing action gating.
- **Should profile detail payment copy be changed too?** Not in this plan unless the user expands the request beyond the member table.

---

## Implementation Units

- U1. **Remove planned Google persistence**

**Goal:** Prevent the code and plan direction from introducing durable Google identity fields.

**Requirements:** R1, R2, R3, R6

**Dependencies:** None

**Files:**
- Modify: `docs/plans/2026-04-28-002-feat-google-workspace-user-import-plan.md`
- Modify: `src/db/schema/auth.ts` if implementation has already added a Google identity field
- Modify: relevant Drizzle migration files if implementation has already generated Google identity columns

**Approach:**
- Update the older import plan so U2 no longer adds `googleWorkspaceId` or any equivalent persistent provider link.
- Reframe import duplicate prevention around local `user.email`.
- If code changes have already introduced Google identity columns or migrations, remove them with a proper schema/migration change rather than leaving unused provider-link state behind.
- Keep `user.email` unique and treat it as the only durable Google lookup handle.

**Patterns to follow:**
- `src/db/schema/auth.ts` for the existing `user.email` unique constraint.
- Current Better Auth account/session tables, which already handle authentication-provider records separately from domain-level user modeling.

**Test scenarios:**
- Migration expectation: the user table has no Google provider-link column after migration.
- Happy path: importing or creating a local user still relies on a unique email.
- Regression: existing users remain valid without any Google-specific local attribute.

**Verification:**
- No schema, migration, read model, or type exposes a persisted Google Workspace link.

---

- U2. **Use email-only Google import correlation**

**Goal:** Adjust import/search semantics so Google Workspace is queried by email and provider IDs remain request-scoped only.

**Requirements:** R2, R3, R6; supports origin F1, F2, AE1, AE2, AE3

**Dependencies:** U1

**Files:**
- Modify: `src/lib/google-workspace/directory.ts` if created by the import work
- Modify: `src/app/(authenticated)/(app)/people/import-google-user-action.ts` if created by the import work
- Modify: `src/app/(authenticated)/(app)/people/check-workspace-email-action.ts` if created by the import work
- Test: `src/lib/google-workspace/email.test.ts`
- Test: `src/app/(authenticated)/(app)/people/import-google-user-action.test.ts` if action tests exist

**Approach:**
- Keep exact Google Workspace email checks for normal create-user conflict prevention.
- For import search, return Google candidates for admin selection, but mark an item already represented when its primary email exists in local `user.email`.
- On submit, re-fetch or verify the selected Google candidate server-side, then create the local user using the verified primary email.
- Do not insert any Google ID into local persistent state.
- Treat provider IDs as anti-tampering handles inside a single request flow only; they are not domain identifiers.

**Patterns to follow:**
- `src/app/(authenticated)/(app)/people/create-user-action.ts` for authoritative server-side validation.
- `src/db/people.ts` for local user lookup/read-model boundaries.

**Test scenarios:**
- Covers AE2. Search result whose primary email already exists locally is disabled as already represented.
- Covers AE3. Normal create blocks when exact Google primary email exists.
- Happy path: import creates a local user with the verified Google primary email and no stored Google ID.
- Error path: if submit-time verification returns a different email than the selected result, import fails.
- Race path: if another admin creates the same local email after search, import fails on local uniqueness and reports the email is already represented.

**Verification:**
- Google lookup code can answer "does this email exist in Workspace?" without persisting provider identity state.

---

- U3. **Simplify the member table status display**

**Goal:** Remove payment-derived status details from the member table.

**Requirements:** R4, R5

**Dependencies:** None

**Files:**
- Modify: `src/components/people-table.tsx`
- Modify: `src/db/people.ts`
- Test: `src/components/people-table.test.tsx` if a component test harness exists, otherwise use focused manual verification

**Approach:**
- Stop mapping `membershipViewState` to `Payment pending` or `Payment processing` in the table status column.
- Show the ordinary `USER_STATUS_INFO[row.original.status]` label and description only.
- Remove table-specific payment tooltip copy.
- Review whether `PublicUser.membershipViewState` is still needed for the table. If only the table status badge used it, remove it from `PublicUser` and from `getAllUserPublicData`.
- Keep `hasMembershipPayment` only if it is still needed to hide or show the `Complete onboarding` action safely; otherwise remove it from the public table read model too.

**Patterns to follow:**
- Existing `USER_STATUS_INFO` mapping in `src/lib/user-status.ts`.
- Existing action-gating pattern in `src/components/people-table.tsx`, where server actions remain authoritative even when UI hides actions.

**Test scenarios:**
- Happy path: a profile-complete user with pending payment shows their normal user status label in the table, not `Payment pending`.
- Happy path: a user with checkout-started payment shows their normal user status label in the table, not `Payment processing`.
- Regression: row navigation, search by name, department badge, batch display, and copy-email action still work.
- Regression: `Complete onboarding` action visibility remains consistent with existing business rules or is safely enforced by `completeUserOnboardingAction`.

**Verification:**
- The table has no payment-specific labels, tooltip descriptions, or provider details.

---

- U4. **Keep payment behavior intact outside the table**

**Goal:** Ensure hiding table details does not accidentally change membership workflows.

**Requirements:** R5

**Dependencies:** U3

**Files:**
- Modify: `src/lib/membership-status.ts` only if implementation discovers table cleanup coupled to membership-state types
- Modify: `src/lib/membership-status.test.ts` only if membership-state inputs change
- Modify: `src/app/(authenticated)/(app)/membership/page.tsx` only if a read-model type change requires it
- Modify: `src/app/(authenticated)/(app)/people/complete-onboarding-action.ts` only if table action gating is simplified

**Approach:**
- Avoid changing `getMembershipViewState` semantics just to clean up the table.
- Keep payment-pending and payment-processing behavior available to membership pages and server actions.
- If `PublicUser` stops carrying membership fields, make sure the detail page or membership page still fetches membership state through its own read model.
- Rely on server action validation for onboarding completion rather than trusting table row fields.

**Patterns to follow:**
- Existing `src/lib/membership-status.test.ts` coverage for membership view-state behavior.
- `src/app/(authenticated)/(app)/people/complete-onboarding-action.ts` for server-side protection against invalid onboarding completion.

**Test scenarios:**
- Regression: membership page still shows payment setup for payment-pending users.
- Regression: payment-processing users still get the correct membership flow outside the table.
- Regression: completing onboarding still creates or reuses a membership payment row according to current rules.

**Verification:**
- Removing table payment details is presentation-only; membership state behavior remains unchanged.

---

- U5. **Prevent Google connection UI in member-table import work**

**Goal:** Make sure future import UI work does not reintroduce Google connection badges or table columns.

**Requirements:** R3, R4, R6

**Dependencies:** U1, U2, U3

**Files:**
- Modify: `docs/plans/2026-04-28-002-feat-google-workspace-user-import-plan.md`
- Modify: `src/components/people-table.tsx` if import UI work already added columns or badges
- Modify: `src/app/(authenticated)/(app)/people/import-google-user-dialog.tsx` if created by the import work

**Approach:**
- Update the older plan's display unit so it does not instruct implementers to show linked Workspace identity or coverage in `src/components/people-table.tsx`.
- Keep Google search result disambiguation inside the import dialog only, where the admin is actively selecting a Google result.
- After import succeeds, refresh the people table as a normal local-user list with no Google connection indicator.

**Patterns to follow:**
- `src/components/people-table.tsx` as a compact user list.
- `src/app/(authenticated)/(app)/people/create-user-dialog.tsx` as a place where provider-specific creation/import copy can live without leaking into the table.

**Test scenarios:**
- Happy path: after importing an existing Google user, the people table shows the same columns and status style as any other user.
- Regression: no Google ID, Google linked badge, imported-from-Google badge, or paid-through label appears in the table.
- Accessibility: import dialog can still show selected Google result context during import, but that context is not persisted into table chrome.

**Verification:**
- Provider-specific import context is contained to the import flow and absent from the table.

---

## System-Wide Impact

- **Interaction graph:** People table read models may stop loading membership payment state for list display, while membership pages and detail views continue to use membership-specific read models.
- **Error propagation:** Google lookup failures should still block conflict-sensitive create/import operations; removing persistence does not make provider uncertainty ignorable.
- **State lifecycle risks:** Email changes would affect Google correlation. This is acceptable only because the product assumes START email is the durable Google account handle; any future email-change feature must update this assumption explicitly.
- **API surface parity:** Server actions remain authoritative for create/import/payment behavior even if the table carries less state.
- **Integration coverage:** Tests or manual verification should prove this is presentation/data-model cleanup, not a membership behavior change.
- **Unchanged invariants:** Local `user.email` remains unique. Every local user is assumed to have a Google Workspace account. Payment state remains modeled separately in `membership_payment`.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Older plan causes implementation to add `googleWorkspaceId` anyway | Update the older plan or clearly mark the durable-link sections as superseded by this corrective plan |
| Table cleanup removes data still needed for action gating | Keep the minimum needed row fields or move checks fully into server actions before removing them |
| Email-only Google correlation breaks if emails diverge | Treat START email as the explicit invariant; future email-change work must update Google and local records together |
| Payment behavior changes accidentally while hiding labels | Keep `getMembershipViewState` tests green and add regression checks around membership pages/actions |
| Import dialog still needs Google result disambiguation | Allow transient Google details inside the active import flow, but do not persist or table-display them |

---

## Documentation / Operational Notes

- Update the earlier Google Workspace import plan so implementers do not follow stale durable-link instructions.
- Admin-facing docs should describe Google lookup as email-based.
- No database backfill is required if no Google link has shipped yet. If a prior implementation already created Google-link columns, remove them through an explicit migration.

---

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-28-google-workspace-existing-user-linking-requirements.md](docs/brainstorms/2026-04-28-google-workspace-existing-user-linking-requirements.md)
- Related plan: [docs/plans/2026-04-28-002-feat-google-workspace-user-import-plan.md](docs/plans/2026-04-28-002-feat-google-workspace-user-import-plan.md)
- Related code: `src/components/people-table.tsx`
- Related code: `src/db/people.ts`
- Related code: `src/db/schema/auth.ts`
- Related code: `src/db/schema/membership.ts`
- Related code: `src/lib/membership-status.ts`
