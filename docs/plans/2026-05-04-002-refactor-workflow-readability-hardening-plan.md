---
title: Workflow Readability Hardening
type: refactor
status: completed
date: 2026-05-04
origin: docs/plans/2026-05-04-001-refactor-flexible-workflow-model-plan.md
superseded_by: docs/plans/2026-05-05-001-refactor-zod-workflow-simplification-plan.md
---

# Workflow Readability Hardening

> Superseded by `docs/plans/2026-05-05-001-refactor-zod-workflow-simplification-plan.md`. This plan fixed the interim generic workflow model; the follow-up simplification removes that model's task/approval/artifact/event side tables entirely.

## Overview

Tighten the Stage 2 workflow refactor before more lifecycle work builds on top of it. The current generic schema direction is right, but the implementation still lets membership-specific vocabulary leak into core workflow files, relies on validator fall-throughs, and concentrates too much record-building logic in one membership service.

This plan keeps the flexible workflow model modest. It does not introduce a workflow engine, table-per-workflow-family design, or generic runtime DSL. It splits generic primitives from membership definitions, makes validators explicit and exhaustive, gives membership workflow builders clearer ownership, fixes artifact lifecycle semantics, adds missing boundary tests, and blocks user deletion so legal history cannot lose user identity.

---

## Problem Frame

The Stage 2 code has solved the first data-model problem but introduced a readability problem: the generic workflow layer is not yet generic in practice. `src/lib/workflows/model.ts` mixes core workflow concepts with membership admission, legal-board approval, payment setup, and application artifact metadata. `src/lib/workflows/validation.ts` assumes the last known kind through fall-through defaults. `src/db/membership-workflows.ts` translates board authority, builds workflow records, builds task metadata, builds artifacts, and manages transactions in one large service.

Those issues matter now because the user wants this workflow foundation to support future association-leaving and reimbursement-like workflows without another disentangling pass. The fix should make extension boring: a future workflow family should add a domain module and validators, not edit a mixed bucket of unrelated concepts.

---

## Requirements Trace

- R1. Keep the generic workflow core free of membership-specific workflow kinds, stages, task kinds, approval kinds, artifact kinds, and metadata shapes.
- R2. Keep membership admission and payment setup behavior unchanged while moving membership-specific definitions into membership-owned modules.
- R3. Replace validator fall-through defaults with explicit kind dispatch and exhaustive checks so new kinds require deliberate validation code.
- R4. Split membership workflow record construction by concept while keeping the public orchestration surface easy to scan.
- R5. Add focused authorization boundary tests for the Stage 1 group API/server-action surfaces and authority-update denial paths.
- R6. Prevent legal approval history from losing user identity by making user deletion impossible.
- R7. Fix workflow artifact lifecycle defaults so draft, submitted, and cancelled artifacts are not silently marked finalized.
- R8. Keep the refactor small enough that Stage 2 remains shippable and does not become a general workflow framework.

---

## Scope Boundaries

- Do not implement resignation, reimbursement, procurement, or other future workflow families.
- Do not create workflow-specific relational tables for membership metadata unless implementation discovers a hard query or constraint need.
- Do not build a workflow designer, transition DSL, or generic state-machine runtime.
- Do not rewrite the Stage 2 membership lifecycle behavior beyond the readability and hardening fixes listed here.
- Do not attempt to support user deletion with historical snapshots. Users should not be deleted at all.

---

## Review Findings Mapping

- Finding 1, missing Stage 1 boundary tests: U1 adds focused tests around group APIs/server-action authorization and authority-update denials.
- Finding 2, mixed workflow registry: U2 separates core workflow primitives from membership workflow definitions.
- Finding 3, validator fall-through defaults: U3 replaces fall-through branches with explicit exhaustive dispatch.
- Finding 4, oversized membership workflow service: U4 extracts admission, payment, and artifact record builders.
- Additional readability review, legal identity on user deletion: U5 blocks user deletion at the database boundary and tightens legal workflow foreign keys.
- Additional readability review, draft artifacts finalized: U6 fixes artifact timestamp defaults and test coverage.

---

## Key Technical Decisions

- Keep `src/lib/workflows/model.ts` as the core vocabulary file: It should expose only cross-workflow statuses, shared primitive types, registry contracts, and generic helper types.
- Add a membership workflow definition module: Membership-specific kinds, stages, legal-board approval metadata, application metadata, and payment setup metadata should live in a membership-owned file, for example `src/lib/workflows/membership.ts`.
- Keep JSON metadata, but validate it close to domain definitions: Membership metadata builders and validators can stay in `src/lib/workflows` as long as they are clearly membership-owned.
- Prefer explicit dispatch over clever registry magic: A `switch` plus `assertNever` is easier to read than a highly dynamic validator framework. Registry maps are fine when they reduce repetition without hiding behavior.
- Keep `src/db/membership-workflows.ts` as the orchestration entry point: Existing callers should not need to learn several low-level builders. The large internal construction logic should move into focused helper modules.
- Block user deletion rather than preserving around deletes: Add a database-level guard against deleting rows from the user table. Legal/audit workflow foreign keys should no longer use `set null` where user identity is part of the historical record.
- Treat `finalizedAt` as a finalization timestamp only: It should default only for finalized artifacts. Submitted application snapshots can remain immutable through metadata and hashes without being marked finalized.

---

## Implementation Units

### U1. Stage 1 Boundary Test Coverage

**Goal:** Ensure the previously fixed authority bypass class has focused regression coverage.

**Requirements:** R5

**Dependencies:** None

**Files:**
- Modify: `src/db/groups.test.ts`
- Modify: `src/lib/authority/update-authorization.test.ts`
- Potentially modify: `src/lib/permissions/permissions.test.ts`

**Approach:**
- Add tests around group-member mutation helpers or route-facing authorization wrappers so unauthenticated or unauthorized callers cannot manage group membership.
- Add tests proving authority updates are denied when the actor lacks the required authority.
- Add tests proving invalid global/department authority combinations are rejected before persistence.
- Keep tests at the smallest layer that exercises the actual authorization boundary; avoid broad app-router integration setup unless the route code cannot be covered through existing helper seams.

**Test scenarios:**
- Unauthorized actor cannot bulk-add users to a group.
- Unauthorized actor cannot remove users from a group.
- Unauthorized actor cannot read or mutate group member data through the server-facing group API surface.
- Actor without people-authority permission cannot update authority grants.
- Department-scoped global-only positions and global department-only positions are rejected.

### U2. Split Core and Membership Workflow Vocabulary

**Goal:** Make generic workflow files truly generic and move membership definitions into a membership-owned module.

**Requirements:** R1, R2, R8

**Dependencies:** None

**Files:**
- Modify: `src/lib/workflows/model.ts`
- Create: `src/lib/workflows/membership.ts`
- Modify: `src/lib/workflows/metadata.ts`
- Modify: `src/lib/workflows/validation.ts`
- Modify tests: `src/lib/workflows/validation.test.ts`
- Modify import sites: `src/db/workflows.ts`, `src/db/membership-workflows.ts`, `src/db/membership-workflows.test.ts`, `src/inngest/membership-lifecycle-workflow.ts`

**Approach:**
- Leave only generic workflow status, task status, approval status, artifact status, subject types, and shared type helpers in `model.ts`.
- Move `membership_admission`, `membership_payment_setup`, admission stages, payment stages, legal-board approval kinds, application artifact kinds, and their metadata types into `membership.ts`.
- Keep exported names intentionally readable, such as `membershipWorkflowKinds`, `membershipAdmissionStages`, and `MembershipAdmissionMetadata`.
- If `metadata.ts` remains, make it clearly domain-oriented by re-exporting membership metadata builders from `membership.ts` or by renaming helpers to membership-specific names.
- Preserve existing runtime behavior and database values.

**Test scenarios:**
- Core workflow model can be imported without pulling in membership kinds.
- Membership module exports the same membership kind/stage values currently persisted by Stage 2.
- Existing membership workflow builder tests still create admission and payment setup records with unchanged persisted values.

### U3. Exhaustive Workflow Metadata Validation

**Goal:** Remove fall-through assumptions from metadata validation.

**Requirements:** R3, R8

**Dependencies:** U2

**Files:**
- Modify: `src/lib/workflows/validation.ts`
- Modify: `src/lib/workflows/validation.test.ts`
- Potentially modify: `src/lib/workflows/membership.ts`

**Approach:**
- Add a small `assertNever(value: never): never` helper in the validation module or a tiny shared utility.
- Validate workflow metadata with explicit branches for each known workflow kind.
- Validate task metadata with explicit branches for each known task kind.
- Validate approval metadata, participant metadata, decision metadata, and artifact metadata with the same explicit pattern where applicable.
- Runtime-unknown strings should produce clear "unsupported kind" errors.
- Compile-time known unions should use exhaustive `switch` handling so adding a new union member creates a type error until validation is added.

**Test scenarios:**
- `membership_admission` metadata validates only through the admission branch.
- `membership_payment_setup` metadata validates only through the payment branch.
- Unknown workflow kind throws an unsupported-kind validation error.
- Unknown task kind throws an unsupported-kind validation error.
- Unknown artifact kind throws an unsupported-kind validation error.
- Invalid metadata for a known kind reports the known kind rather than a different fall-through kind.

### U4. Split Membership Workflow Record Builders

**Goal:** Keep the membership workflow service as orchestration while extracting focused builders.

**Requirements:** R2, R4, R8

**Dependencies:** U2, U3

**Files:**
- Modify: `src/db/membership-workflows.ts`
- Create: `src/db/membership-admission-workflows.ts`
- Create: `src/db/membership-payment-workflows.ts`
- Create: `src/db/membership-workflow-artifacts.ts`
- Modify tests: `src/db/membership-workflows.test.ts`

**Approach:**
- Move admission workflow record construction, legal-board approval record construction, participant snapshots, and vote task records into `membership-admission-workflows.ts`.
- Move payment setup workflow and task record construction into `membership-payment-workflows.ts`.
- Move application snapshot, generated document, and artifact metadata construction into `membership-workflow-artifacts.ts`.
- Keep transaction orchestration and externally called functions in `membership-workflows.ts`.
- Avoid introducing classes or a generic builder framework. Plain functions with typed inputs are enough.
- Keep public exports stable where possible; if names must move, re-export from `membership-workflows.ts` to reduce churn.

**Test scenarios:**
- Admission builder creates one workflow, one legal-board approval, three participant snapshots, and three vote tasks for a valid legal board roster.
- Admission builder rejects an invalid legal board roster through the existing authority validation path.
- Payment builder creates one payment setup workflow and one assigned payment task.
- Artifact builder creates submitted application snapshots without finalization timestamps.
- Orchestration function still writes the same complete admission bundle transactionally.

### U5. Block User Deletion and Preserve Legal Identity

**Goal:** Make it impossible to delete users, so legal approval and artifact history cannot lose voter, participant, subject, or actor identity.

**Requirements:** R6

**Dependencies:** None

**Files:**
- Modify: `src/db/schema/workflow.ts`
- Modify: `src/db/schema/audit-log.ts`
- Modify: `src/db/schema/legal-membership.ts`
- Modify migration: `drizzle/0012_*.sql`
- Modify migration snapshot: `drizzle/meta/0012_snapshot.json`
- Modify: `drizzle/meta/_journal.json` only if the migration is regenerated or renamed.

**Approach:**
- Add a database-level `BEFORE DELETE` trigger on the user table that raises a clear error, for example "Users cannot be deleted; deactivate or change status instead."
- Remove `onDelete: "set null"` from workflow/legal-history references where user identity is part of the record:
  - workflow subject user
  - workflow creator
  - task assignee and target user where applicable
  - approval participant user
  - approval decision voter
  - artifact user
  - audit actor and target user
- Use default `no action`/restrictive foreign-key behavior for these references unless implementation finds an existing auth-table relationship that must keep a different behavior.
- Keep user deactivation/status changes as the supported operational path.

**Test scenarios:**
- Migration SQL contains the trigger/function that blocks deleting from the user table.
- Workflow approval participant and decision schema no longer nulls historical user references on delete.
- Audit records no longer null actor/target references on delete.
- If a database-backed test seam already exists, attempting to delete a user raises the intended error. If not, document this as migration-level verification for now.

### U6. Fix Artifact Finalization Semantics

**Goal:** Ensure artifacts are not marked finalized unless their status is actually finalized.

**Requirements:** R7

**Dependencies:** U2

**Files:**
- Modify: `src/db/workflows.ts`
- Modify: `src/db/workflows.test.ts`
- Modify: `src/db/membership-workflows.test.ts`
- Potentially modify: `src/db/membership-workflow-artifacts.ts`

**Approach:**
- Change artifact value construction so `finalizedAt` defaults to `now` only when `status` is `finalized`.
- Leave `finalizedAt` null for `draft`, `submitted`, and `cancelled` unless an explicit timestamp is intentionally provided and the status allows it.
- Keep submitted membership application snapshots immutable through metadata, snapshot hashes, and artifact status rather than by overloading finalization.
- Add tests that lock the distinction between submitted and finalized.

**Test scenarios:**
- Draft artifact has no `finalizedAt`.
- Submitted membership application snapshot has no `finalizedAt`.
- Finalized generated document defaults `finalizedAt` to `now`.
- Explicit inconsistent finalization data is rejected or normalized according to the chosen helper contract.

---

## Sequencing

1. Start with U1 so Stage 1 authorization regressions are covered before more refactoring.
2. Do U2 and U3 together because the split vocabulary and exhaustive validators share imports and types.
3. Do U4 after validators settle so builders can depend on the final membership module shape.
4. Do U6 while touching artifact builders because the behavior is small but easy to regress.
5. Do U5 before final verification so migration/schema output reflects the deletion-blocking decision.

---

## Verification Plan

- Run focused workflow tests:
  - `npm test -- src/lib/workflows/validation.test.ts`
  - `npm test -- src/db/workflows.test.ts`
  - `npm test -- src/db/membership-workflows.test.ts`
- Run focused Stage 1 boundary tests:
  - `npm test -- src/db/groups.test.ts`
  - `npm test -- src/lib/authority/update-authorization.test.ts`
- Run the full test suite with `npm test`.
- Run TypeScript with `npx tsc --noEmit`.
- Run focused Biome checks on touched files.
- Run `git diff --check`.
- Note whether full `npm run lint` still reports only the pre-existing `src/components/ui/*` import-order/type-only diagnostics.

---

## Risks and Mitigations

- Risk: Splitting files causes import churn that obscures the readability win.
  Mitigation: Keep public re-exports stable from existing entry points and prefer simple flat file names that match current `src/db/*.ts` conventions.

- Risk: Exhaustive validators become noisy.
  Mitigation: Use small helper functions per metadata shape and readable `switch` dispatch rather than a complex registry framework.

- Risk: Database trigger syntax in a generated migration is easy to drift from Drizzle snapshots.
  Mitigation: Keep the trigger as explicit SQL in the migration and schema-level FK changes in Drizzle; verify both migration SQL and generated snapshot.

- Risk: Blocking user deletion surprises future admin features.
  Mitigation: Make status/deactivation the documented lifecycle path and return a clear database error if deletion is attempted.

---

## Ready-To-Execute Checklist

- The user has confirmed user deletion should be blocked completely.
- The plan keeps the existing metadata-first workflow direction.
- No product questions block implementation.
- Implementation can begin with boundary tests, then perform the workflow readability split, then harden schema/migration semantics.
