---
date: 2026-05-03
topic: simple-permission-evaluator
---

# Simple Permission Evaluator Requirements

## Problem Frame

START Cockpit's current authorization rules work, but the implementation is too abstract for the size and stability of the domain. The predicate factory, permission-definition helper, context compatibility types, and policy registry create hidden complexity around a permission model that is unlikely to grow much beyond the current positions and app grants.

The desired change is to keep the current authority model mostly intact while replacing the permission DSL with explicit, readable TypeScript. A maintainer should be able to open the evaluator and understand every permission rule without following predicate objects, generic helpers, or type-level plumbing across several files.

---

## Actors

- A1. Admin or authorized member: Attempts protected reads or mutations in START Cockpit.
- A2. Frontend UI: Shows or hides affordances based on the current member's authority.
- A3. Server guard: Enforces authorization in pages, actions, database helpers, route handlers, and workflows.
- A4. Implementer: Adds or changes authorization rules while maintaining the app.

---

## Requirements

**Authority model**
- R1. Organization positions remain separate from app access grants.
- R2. Organization positions continue to represent offices: `president`, `vice_president`, `head_of_finance`, and `department_head`.
- R3. App access grants remain explicit app permissions; this pass keeps `admin` as the only required grant.
- R4. `people_admin` must not be introduced in this pass, but the design should not make a later explicit grant impossible.
- R5. Department authority remains fixed to `department_head`; the design must not preserve generic "department positions" extensibility.

**Permission API**
- R6. Server enforcement continues to use `can()`.
- R7. Client affordances continue to use `<Can>` and `useCan()` against the authenticated layout's server-loaded authority.
- R8. The public permission API must distinguish `GlobalAction` from `DepartmentScopedAction`.
- R9. `GlobalAction` means the action has no target department argument; it does not mean only global authorities may perform it.
- R10. `DepartmentScopedAction` checks must require a department scope argument at compile time.
- R11. Calling `can("users.view_details")` without department scope must be a TypeScript error.
- R12. Passing department scope to a global action, such as `can("groups.view_all", { targetDepartment })`, must be a TypeScript error.
- R13. Runtime checks must still fail closed when malformed JavaScript calls bypass TypeScript.

**Evaluator readability**
- R14. Permission evaluation should use one explicit switch-style evaluator rather than a predicate registry or `definePermission()` helper.
- R15. Each switch case should contain plain boolean logic that reads like the business rule.
- R16. Small helper functions may exist inside the evaluator file when they encode obvious domain checks, such as admin grant, legal officer, department head, or active member.
- R17. Helpers should not hide the target comparison. Prefer calls like `isDepartmentHead(authority, scope.targetDepartment)` over predicate names like `isTargetDepartmentHead(authority, scope)`.
- R18. `predicates.ts`, `policy.ts`, predicate factories, and permission-definition helpers should disappear unless planning finds a smaller name-preserving transition is safer.

**Current behavior**
- R19. Existing authorization outcomes should remain unchanged unless explicitly called out in a later implementation plan.
- R20. Active-member status gating remains centralized: inactive, onboarding, supporting alumni, and alumni users do not gain ordinary app permissions from assignments unless a future action explicitly allows it.
- R21. Legal officer access remains tied to president, vice president, or head of finance positions.
- R22. Department-head access to member-specific actions remains scoped to the target member department.
- R23. Department heads can still perform existing context-free department-head actions, such as viewing all groups, where the action intentionally has no target department.

---

## Acceptance Examples

- AE1. **Covers R8-R12.** Given the typed server API, when an implementer calls `can("users.view_details")` without scope, TypeScript rejects the call.
- AE2. **Covers R8-R12.** Given the typed server API, when an implementer calls `can("groups.view_all", { targetDepartment: "events" })`, TypeScript rejects the call.
- AE3. **Covers R14-R17, R22.** Given a department-scoped action like `users.view_details`, when a maintainer reads its evaluator case, they see a direct rule such as admin grant or department head of the target department.
- AE4. **Covers R13, R22.** Given a malformed runtime call checks `users.view_details` without a target department, evaluation denies access.
- AE5. **Covers R19-R23.** Given the same authority assignments as today, existing admin, legal officer, and department-head permissions continue to allow and deny the same actions.

---

## Success Criteria

- A maintainer can understand the whole permission policy from one evaluator file without learning a local DSL.
- Current server and client authorization call sites keep their ergonomic `can()`, `<Can>`, and `useCan()` surfaces.
- TypeScript still catches missing department scope and extra department scope at call sites.
- Planning does not need to invent product authorization behavior; it only needs to choose the safest refactor sequence.
- Tests protect the simple model from drifting back toward hidden predicate or policy-framework complexity.

---

## Scope Boundaries

- This does not redesign START Cockpit's product permissions.
- This does not add `people_admin`.
- This does not add arbitrary resource scopes.
- This does not add a visual permission editor or audit page.
- This does not remove the distinction between organization positions and app access grants.
- This does not make client-side checks a security boundary.
- This does not need to remove persisted legacy `user.roles`; any database cleanup remains separate.
- This does not require preserving `predicates.ts` or `policy.ts` as public concepts.

---

## Key Decisions

- Keep positions and grants separate: Positions carry organization meaning; grants carry app access.
- Use `GlobalAction` and `DepartmentScopedAction`: This preserves useful compile-time call-site safety without a generic permission DSL.
- Replace predicate/policy machinery with an explicit evaluator: The current domain is small and stable enough that verbosity is a readability win.
- Keep helper functions local and boring: Helpers are allowed for repeated domain checks, but not as an authorization framework.
- Do not prebuild `people_admin`: Mention it only as a later explicit grant if the HR use case becomes real.

---

## Dependencies / Assumptions

- Existing server enforcement goes through `src/lib/permissions/server.ts`.
- Existing client affordances go through `src/components/can.tsx` and `src/lib/permissions/authority-context.tsx`.
- Current persisted authority tables distinguish organization positions from access grants in `src/db/schema/authority.ts`.
- The current actions can be classified as either global or department-scoped without adding another context kind.

---

## Outstanding Questions

### Resolve Before Planning

- None.

### Deferred to Planning

- [Affects R18][Technical] Decide whether to delete `predicates.ts` and `policy.ts` immediately or keep temporary compatibility barrels during the refactor.
- [Affects R8-R13][Technical] Decide the exact overload/type shape for `evaluateAuth()`, `can()`, `<Can>`, and `useCan()` so call-site safety remains consistent.
- [Affects R19-R23][Technical] Confirm the full current action list and classify each action as `GlobalAction` or `DepartmentScopedAction`.

---

## Next Steps

-> `/ce-plan` for structured implementation planning.
