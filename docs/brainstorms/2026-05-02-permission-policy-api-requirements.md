---
date: 2026-05-02
topic: permission-policy-api
---

# Permission Policy API Requirements

## Problem Frame

START Cockpit now separates member lifecycle state, organization roles, app permissions, and effective authorization. The current permission policy map is readable, but its buckets make some cases ambiguous or impossible to express safely.

The main issue is that the current rule shape ties semantics to broad buckets such as `globalPositions` and `departmentPositions`. That works for simple cases, but it becomes unclear when a policy wants to say "a department head of the target member's department may do this" versus "any department head may do this globally." It also allows misleading policy entries, such as placing a department-scoped role in a global bucket where no real assignment can match.

The permission API should make authorization intent explicit, readable, and hard to misuse. Server enforcement should continue to use `can()`. Client UI should continue to use `<Can>` or `useCan()` against the server-loaded authority context. A shared evaluator may exist underneath those APIs, but product and UI code should not treat it as a second permission-checking API.

---

## Actors

- A1. Admin or authorized member: Attempts a protected action in START Cockpit.
- A2. Frontend UI: Hides or shows affordances using the current member's authority context.
- A3. Server guard: Enforces permissions in pages, actions, route handlers, and workflows.
- A4. Implementer: Adds or changes permission rules while building future features.

---

## Requirements

**Policy readability**
- R1. Permission rules must read as named authorization predicates, not as implicit bucket combinations.
- R2. Common predicates must describe the actual business rule, such as admin access, legal officer access, head of the target department, or head of any department.
- R3. A permission rule must make it obvious whether a department-scoped role is being matched against a target department or accepted regardless of department.
- R4. The central permission map must remain the readable source of truth for which actors can perform each action.

**Typed context safety**
- R5. Each permission must declare the context shape it accepts or requires.
- R6. Predicates that need target context, such as "head of the target department," must only be usable for permissions whose context includes that target.
- R7. Predicates that do not require target context, such as admin, legal officer, or any department head, must be usable for permissions with or without target context.
- R8. Permission checks must fail closed at runtime when required context is missing or malformed, even if TypeScript should normally catch the mistake.

**Client and server API boundaries**
- R9. Server-side enforcement must use `can()` so checks load the current member and their authority from the server source of truth.
- R10. Client components must use `<Can>` for rendering gates and `useCan()` for behavioral checks such as links, row clicks, disabled states, and cursor affordances.
- R11. Client checks must evaluate only the authority context already provided by the authenticated app layout; they are UI affordances, not security boundaries.
- R12. The shared low-level evaluator must be named as an evaluator, not as an alternate public permission API.

**Invalid policy prevention**
- R13. The policy API must make invalid combinations difficult to write, especially predicates that require target context on permissions that do not provide it.
- R14. The policy API must avoid accepting unmatchable role/scope combinations, such as treating a department-scoped role as a global assignment.
- R15. Tests must cover representative valid and invalid permission policies, including at least one contextless permission and one target-department permission.

---

## Acceptance Examples

- AE1. **Covers R1, R3.** Given a permission allows "head of the target department," when a Community department head checks access for a Community member, access is allowed; when checking access for an Operations member, access is denied.
- AE2. **Covers R1, R3.** Given a permission allows "head of any department," when a Community department head checks access for an Operations member, access is allowed because the rule intentionally does not compare departments.
- AE3. **Covers R5, R6, R13.** Given `groups.view_all` has no target-department context, when an implementer tries to add a "head of the target department" predicate to it, TypeScript should reject or clearly flag the policy.
- AE4. **Covers R8.** Given a target-department permission is checked without target context at runtime, access is denied.
- AE5. **Covers R9-R11.** Given a member cannot view another member's profile, the people table shows no row click or pointer cursor on the client, and the member detail page still denies access on the server if the URL is opened directly.

---

## Success Criteria

- Permission rules are easier to read in business language than the current bucket-based map.
- Implementers can express both "same department" and "any department head" without misleading global-position entries.
- TypeScript catches common policy/context mismatches before runtime.
- Server and client authorization APIs have clear responsibilities: `can()` enforces, `<Can>` and `useCan()` gate UI, and the shared evaluator remains internal plumbing.
- Planning can proceed without deciding whether to keep the current `globalPositions` / `departmentPositions` vocabulary.

---

## Scope Boundaries

- This work improves the permission policy API and evaluator semantics only.
- This work does not add new product permissions by itself.
- This work does not reintroduce `people_admin` unless a later feature requires it.
- This work does not make client-side permission checks a security boundary.
- This work does not require arbitrary resource scopes beyond the contexts needed by current permissions.
- This work does not require a visual permission editor or audit page.

---

## Key Decisions

- Use named policy predicates: They make the authorization rule visible in product language and avoid a growing set of ambiguous buckets.
- Prefer compile-time context safety: Permissions should declare their context shape, and predicates should only compose with compatible permissions.
- Keep server and client APIs separate: `can()` remains the server guard, while `<Can>` and `useCan()` are the client UI affordance layer.
- Rename the low-level function as an evaluator: A name such as `evaluateAuth()` better describes a pure rule evaluator than `canWithAuthority()`.

---

## Dependencies / Assumptions

- Current permission policy lives in `src/lib/permissions/index.ts`.
- Current server enforcement helper lives in `src/lib/permissions/server.ts`.
- Current client permission affordances live in `src/components/can.tsx`.
- The authenticated app layout loads the current member's authority and provides it to client components through context.
- Current authority assignments distinguish global roles, department-scoped roles, and global app permissions.

---

## Outstanding Questions

### Resolve Before Planning

- None.

### Deferred to Planning

- [Affects R1-R8][Technical] Decide the exact TypeScript API for declaring permission contexts and composing predicates.
- [Affects R12][Technical] Decide whether the low-level evaluator should remain exported from `src/lib/permissions/index.ts` or move behind a more explicitly internal module boundary.
- [Affects R15][Technical] Decide the best way to type-test invalid policy examples so regressions are caught without making the test suite brittle.

---

## Next Steps

-> `/ce-plan` for structured implementation planning.
