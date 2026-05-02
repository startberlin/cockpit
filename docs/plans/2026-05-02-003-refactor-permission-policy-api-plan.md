---
title: Refactor Permission Policy API
type: refactor
status: active
date: 2026-05-02
origin: docs/brainstorms/2026-05-02-permission-policy-api-requirements.md
---

# Refactor Permission Policy API

## Overview

Replace the current bucket-based permission map with a named predicate policy API. The goal is to make authorization rules read in business language, distinguish "same target department" from "any department head," and let TypeScript catch common context mistakes before they ship.

This is a security-sensitive refactor. It should preserve the intended product permission boundaries while making the implementation harder to misuse. Server enforcement remains `can()`. Client affordances remain `<Can>` and `useCan()`. The shared evaluator remains pure plumbing underneath those APIs.

---

## Problem Frame

The current permission policy in `src/lib/permissions/index.ts` uses buckets such as `globalGrants`, `globalPositions`, and `departmentPositions`. That hides important intent. For example, `departmentPositions: ["department_head"]` means "same target department" only when a target department is provided, while `groups.view_all` has no target department but currently also lists `department_head`. The rule looks permissive but cannot match through the current evaluator.

The origin requirements ask for named predicates, typed permission contexts, runtime fail-closed behavior, and clear client/server API boundaries (see origin: `docs/brainstorms/2026-05-02-permission-policy-api-requirements.md`).

---

## Requirements Trace

- R1. Permission rules must read as named authorization predicates.
- R2. Common predicates must describe real business rules such as admin, legal officer, head of target department, or any department head.
- R3. Rules must make same-department versus any-department semantics obvious.
- R4. The central permission map remains the readable source of truth.
- R5. Each permission declares its accepted or required context shape.
- R6. Target-context predicates are only usable with permissions that provide that context.
- R7. Context-free predicates are usable across permission contexts.
- R8. Runtime checks fail closed when required context is missing or malformed.
- R9. Server enforcement uses `can()`.
- R10. Client UI uses `<Can>` and `useCan()`.
- R11. Client checks use only server-provided authority context and remain UI affordances.
- R12. The shared evaluator is named and treated as evaluator plumbing.
- R13. Invalid policy/context combinations are difficult to write.
- R14. Unmatchable role/scope combinations are avoided.
- R15. Tests cover valid and invalid policy examples.

**Origin actors:** A1 Admin or authorized member, A2 Frontend UI, A3 Server guard, A4 Implementer

**Origin acceptance examples:** AE1 same-department department-head access, AE2 any-department-head access, AE3 context mismatch rejected by TypeScript, AE4 missing context fails closed, AE5 client affordance plus server denial

---

## Scope Boundaries

- No new product permissions are introduced by this plan.
- No new persisted authority data, migrations, or admin UI changes are included.
- `people_admin` remains out of scope.
- Client-side checks remain presentation affordances only; server guards remain authoritative.
- Arbitrary resource scopes beyond the current permission contexts are out of scope.
- A visual permission editor or audit page is out of scope.

---

## Context & Research

### Relevant Code and Patterns

- `src/lib/permissions/index.ts` currently defines `UserAuthority`, `PermissionContext`, the `PERMISSIONS` map, `evaluateAuth()`, and board-roster helpers.
- `src/lib/permissions/server.ts` wraps the evaluator with current-user lookup and server-only enforcement.
- `src/components/can.tsx` wraps the evaluator with client context for `<Can>` and `useCan()`.
- `src/lib/permissions/permissions.test.ts` uses Node's built-in test runner and already covers permission behavior and board roster helpers.
- `src/db/schema/authority.ts` constrains `department_head` to department scope and legal officer positions to global scope; the policy API should respect those model constraints instead of making impossible global department-head rules look valid.
- Current callers use `can("users.view_details", { targetDepartment })`, `useCan()`, and `<Can>` in `src/app/(authenticated)/(app)/people/[id]/page.tsx`, `src/components/people-table.tsx`, and `src/app/(authenticated)/(app)/groups/[id]/page-client.tsx`.

### Institutional Learnings

- `docs/solutions/conventions/reusable-tone-of-voice-and-wording-decisions-2026-05-02.md` is relevant only insofar as UI copy should stay member-centered. This plan does not introduce new user-facing copy.

### External References

- External research is not needed. The work is an internal TypeScript API refactor over existing authorization state and local patterns.

---

## Key Technical Decisions

- Use named predicates over bucket arrays: predicates make permission intent readable and avoid impossible combinations like global `department_head`.
- Type permission contexts by action: each action should know whether it accepts no context, target-department context, or another future context.
- Keep `evaluateAuth()` pure and shared: it remains usable by server and client wrappers, but product code should go through `can()`, `<Can>`, or `useCan()`.
- Preserve intended semantics while fixing misleading rules: `users.view_details` should use target-department semantics; contextless permissions that intentionally include department heads should use an explicit "any department head" predicate.
- Add type-level tests or compile-time assertions: runtime tests alone cannot prove invalid policy composition is rejected.

---

## Open Questions

### Resolved During Planning

- Should the API use named predicates or clearer buckets? Use named predicates, based on the origin decision.
- Should context safety be compile-time or runtime-only? Prefer compile-time where possible, plus runtime fail-closed behavior.
- Should client components import the low-level evaluator directly? No. They should use `<Can>` or `useCan()`.

### Deferred to Implementation

- Exact helper names and generic type shape: implementation can choose the simplest readable TypeScript shape that satisfies the plan.
- Exact type-test format: implementation can use local `tsc --noEmit` coverage, `@ts-expect-error` assertions, or a dedicated type assertion file if it integrates cleanly with the repo.

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

The final policy should read closer to this:

```text
permission contexts:
  users.view_details -> targetDepartment context
  groups.view_all -> no target context

predicates:
  isAdmin() -> no target context required
  isLegalOfficer() -> no target context required
  isAnyDepartmentHead() -> no target context required
  isHeadOfTargetDepartment() -> requires targetDepartment context

policy:
  users.view_details = allow(
    isAdmin(),
    isHeadOfTargetDepartment(),
  )

  groups.view_all = allow(
    isAdmin(),
    isLegalOfficer(),
    isAnyDepartmentHead(),
  )
```

The important design property is not the exact syntax. It is that context-requiring predicates cannot be composed into contextless permissions without TypeScript objecting, and runtime evaluation still denies access if required context is absent.

---

## Implementation Units

- U1. **Introduce Typed Predicate Policy Core**

**Goal:** Replace bucket rule types with a typed predicate model that can express context-free and target-department-dependent authorization checks.

**Requirements:** R1, R2, R3, R5, R6, R7, R8, R13, R14

**Dependencies:** None

**Files:**
- Modify: `src/lib/permissions/index.ts`
- Test: `src/lib/permissions/permissions.test.ts`

**Approach:**
- Define permission contexts per action, starting with no-context permissions and target-department permissions.
- Define named predicates for the current business rules: admin, legal officer, any department head, and head of target department.
- Keep predicates small and composable; each predicate should evaluate a `UserAuthority` plus the context it is typed to accept.
- Make missing target context fail closed at runtime for target-dependent predicates.
- Avoid modeling invalid assignment combinations in policy. For example, do not represent `department_head` as a global position predicate.

**Execution note:** Implement the predicate behavior test-first for the same-department, any-department-head, and missing-context cases before migrating all policies.

**Patterns to follow:**
- Existing `evaluateAuth()` tests in `src/lib/permissions/permissions.test.ts`.
- Existing assignment shape and constraints in `src/db/schema/authority.ts`.

**Test scenarios:**
- Happy path: global admin authority evaluates true for an admin-listed permission.
- Happy path: president, vice president, or head of finance evaluates true for a legal-officer-listed permission.
- Covers AE1. Happy path: Events department head evaluates true for `users.view_details` with `targetDepartment: "events"`.
- Covers AE1. Edge case: Events department head evaluates false for `users.view_details` with `targetDepartment: "growth"`.
- Covers AE2. Happy path: Events department head evaluates true for a contextless permission that explicitly allows any department head.
- Covers AE4. Error path: department-head-of-target predicate evaluates false when target department is missing or null.
- Edge case: departmentless authority does not accidentally satisfy department-head predicates.

**Verification:**
- The permission evaluator no longer relies on `globalGrants`, `globalPositions`, or `departmentPositions` buckets.
- Existing runtime permission tests pass with the predicate model.

---

- U2. **Rewrite Current Permission Map**

**Goal:** Express all current permissions with named predicates while preserving intended access boundaries and removing misleading bucket entries.

**Requirements:** R1, R2, R3, R4, R8, R14

**Dependencies:** U1

**Files:**
- Modify: `src/lib/permissions/index.ts`
- Test: `src/lib/permissions/permissions.test.ts`

**Approach:**
- Rewrite `PERMISSIONS` so each action uses named predicates.
- Preserve admin-only actions as admin predicates.
- Preserve legal board resolution permissions as legal-officer predicates where already intended.
- Use a target-department predicate for member-detail and member-edit style permissions that should compare against a target member department.
- Use an any-department-head predicate for contextless permissions where department heads are meant to qualify without a target department, such as `groups.view_all`.
- Do not add product access that has not been decided; when current bucket semantics are ambiguous, preserve the documented or already discussed intent rather than broadening silently.

**Patterns to follow:**
- Origin acceptance examples in `docs/brainstorms/2026-05-02-permission-policy-api-requirements.md`.
- Current permission callers found by searching for `can(`, `<Can`, and `useCan(`.

**Test scenarios:**
- Happy path: `users.create`, `users.import`, `groups.create`, and `groups.manage_members` allow admin and deny legal officers without admin.
- Covers AE1. Happy path and edge case: `users.view_details` allows only the target member's department head plus admin.
- Happy path: `groups.view_all` allows admin, legal officers, and any department head without requiring target context.
- Edge case: `groups.view_all` does not require or inspect `targetDepartment`.
- Happy path: `membership.vote_resolution` allows only legal officers, not department heads or admin grant by itself unless the policy explicitly lists admin.
- Edge case: unknown or unconfigured actions remain impossible through the typed action union.

**Verification:**
- The new permission map reads as a list of business predicates per action.
- No policy entry can imply a department-scoped role is a global assignment.

---

- U3. **Type Server and Client Permission APIs**

**Goal:** Carry the typed permission context through `can()`, `<Can>`, and `useCan()` so callers get guidance when a permission requires context.

**Requirements:** R5, R6, R9, R10, R11, R12, R13

**Dependencies:** U1, U2

**Files:**
- Modify: `src/lib/permissions/server.ts`
- Modify: `src/components/can.tsx`
- Modify: `src/app/(authenticated)/(app)/people/[id]/page.tsx`
- Modify: `src/components/people-table.tsx`
- Modify: `src/app/(authenticated)/(app)/groups/[id]/page-client.tsx`
- Modify: `src/app/(authenticated)/(app)/people/complete-onboarding-action.ts`
- Test: `src/lib/permissions/permissions.test.ts`

**Approach:**
- Update `can()` so the context argument is typed based on the action.
- Update `useCan()` so both forms remain supported: direct boolean checks and a reusable checker function for row-by-row logic.
- Update `<Can>` props so context is required or optional according to the permission action where TypeScript can express it ergonomically.
- Keep client components using `<Can>` or `useCan()` only; they should not import the evaluator directly.
- Keep runtime behavior fail-closed even when a caller bypasses TypeScript or passes malformed context.

**Patterns to follow:**
- Current `can()` wrapper in `src/lib/permissions/server.ts`.
- Current `<Can>` and `useCan()` wrappers in `src/components/can.tsx`.
- Existing member-detail server guard in `src/app/(authenticated)/(app)/people/[id]/page.tsx`.
- Existing row-level affordance checks in `src/components/people-table.tsx`.

**Test scenarios:**
- Covers AE5. Integration: server member detail check calls `can("users.view_details", { targetDepartment })` and still denies unauthorized access.
- Covers AE5. Integration: people table and group detail client can check row-level profile affordances through `useCan()` without importing the evaluator.
- Happy path: contextless checks such as `can("groups.view_all")` compile and evaluate without a context object.
- Edge case: target-department checks without context are either compile-time-invalid or runtime-denied.
- Error path: null or missing authority in client context returns false from `<Can>` and `useCan()`.

**Verification:**
- All existing permission callers compile with the typed API.
- Client UI imports no low-level evaluator from `src/lib/permissions/index.ts`.

---

- U4. **Add Type-Level Policy Safety Coverage**

**Goal:** Make policy misuse visible in tests so future implementers cannot accidentally compose incompatible predicates or contexts.

**Requirements:** R5, R6, R13, R15

**Dependencies:** U1, U2, U3

**Files:**
- Modify: `src/lib/permissions/permissions.test.ts`
- Create or modify: `src/lib/permissions/permissions.typecheck.ts` if a separate type assertion file fits the repo better

**Approach:**
- Add compile-time assertions for invalid predicate composition, especially using a target-department predicate on a contextless permission.
- Add positive type examples for contextless predicates on both contextless and target-department permissions.
- Keep type-level tests minimal and readable; they should protect the API shape without becoming a second implementation.
- Ensure normal `tsc --noEmit` catches the invalid examples.

**Patterns to follow:**
- Existing TypeScript compile step as the source of type-level validation.
- Existing Node test style for runtime permission assertions.

**Test scenarios:**
- Covers AE3. Type safety: a target-department-only predicate cannot be added to `groups.view_all`.
- Happy path: admin and any-department-head predicates are valid for contextless permissions.
- Happy path: admin and head-of-target-department predicates are valid for target-department permissions.
- Edge case: a permission requiring target context cannot be checked from TypeScript without that context unless the API intentionally exposes a fail-closed escape hatch.

**Verification:**
- `tsc --noEmit` fails if invalid policy examples are made active without the expected type error.
- Runtime permission tests still cover the corresponding behavior.

---

- U5. **Document the Permission API Boundary**

**Goal:** Leave a short local explanation of how future implementers should add permissions without reintroducing bucket semantics or client-side enforcement confusion.

**Requirements:** R4, R9, R10, R11, R12

**Dependencies:** U1, U2, U3

**Files:**
- Modify: `docs/brainstorms/2026-05-02-permission-policy-api-requirements.md`
- Create or modify: `docs/solutions/conventions/reusable-permission-policy-api-2026-05-02.md`

**Approach:**
- Capture the final vocabulary: `can()` for server enforcement, `<Can>` and `useCan()` for client affordances, and `evaluateAuth()` or equivalent as low-level evaluator plumbing.
- Include one concise example each for target-department permissions and contextless permissions.
- State that client checks never replace server guards.
- Keep this as a convention/learning document, not a long tutorial.

**Patterns to follow:**
- Existing concise convention format in `docs/solutions/conventions/reusable-tone-of-voice-and-wording-decisions-2026-05-02.md`.

**Test scenarios:**
- Test expectation: none -- this unit documents the finalized API and does not change runtime behavior.

**Verification:**
- A future implementer can understand which API to use from the local convention doc without reading the full implementation plan.

---

## System-Wide Impact

- **Interaction graph:** Permission behavior flows through `src/lib/permissions/index.ts`, `src/lib/permissions/server.ts`, `src/components/can.tsx`, server pages/actions, and client UI affordances.
- **Error propagation:** Permission denials should remain boolean false, not thrown errors, at evaluator level. Server actions/pages decide whether to return not found, show empty state, or throw.
- **State lifecycle risks:** No persisted data changes are planned, so there is no migration or backfill risk.
- **API surface parity:** Server `can()`, client `<Can>`, and client `useCan()` must all expose the same permission vocabulary and context expectations.
- **Integration coverage:** Row click/link affordances and server page guards should continue to agree for member profile access.
- **Unchanged invariants:** Client-side permission checks are not security boundaries; all protected mutations and sensitive reads still require server-side `can()` checks.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Type API becomes too clever and hard to maintain | Keep predicate helpers small, named after business rules, and backed by readable tests |
| Refactor accidentally broadens access | Preserve current intended permissions, add before/after behavior tests, and treat ambiguous bucket rules explicitly |
| Type-level tests become brittle | Keep compile-time assertions focused on a few representative invalid and valid examples |
| Client and server APIs drift | Route both through the same shared evaluator and test representative server/client callers |
| Future implementers bypass `<Can>` or `useCan()` | Add a local convention doc and verify no client components import the low-level evaluator directly |

---

## Documentation / Operational Notes

- No rollout flag is required because no persisted data changes are included.
- This should be reviewed as an authorization-sensitive refactor, even though it is primarily API cleanup.
- The final PR should call out whether any permissions intentionally changed behavior, especially around department heads and `groups.view_all`.

---

## Sources & References

- **Origin document:** `docs/brainstorms/2026-05-02-permission-policy-api-requirements.md`
- Related code: `src/lib/permissions/index.ts`
- Related code: `src/lib/permissions/server.ts`
- Related code: `src/components/can.tsx`
- Related tests: `src/lib/permissions/permissions.test.ts`
