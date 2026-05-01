---
date: 2026-04-28
topic: user-authority-organization-model
---

# User Authority and Organization Model Requirements

## Problem Frame

START Cockpit currently uses `roles` for a mix of authorization and organizational meaning. That was useful as a first iteration, but upcoming features need to answer richer questions: whether a user is board-level, whether they hold a specific organizational position, and whether they have a scoped permission such as editing members in their own department.

The model should separate lifecycle state, organization facts, explicit access grants, and computed permissions. This should support the org chart view while also creating a durable permission foundation for future admin and department workflows.

---

## Actors

- A1. Admin: Maintains member details, organizational positions, and explicit access grants.
- A2. Board-level member: Holds a global or department leadership position that may be relevant to org charts and selected permissions.
- A3. Department head: Leads one department and may receive permissions scoped to that department.
- A4. Access-granted user: Needs app permissions for an operational task without holding the corresponding organizational position.
- A5. START Cockpit: Computes effective permissions from user status, positions, access grants, and request context.

---

## Key Flows

- F1. Admin maintains a member's authority data
  - **Trigger:** An admin opens a member detail page.
  - **Actors:** A1
  - **Steps:** The admin reviews the member's lifecycle status, department, organizational positions, and access grants; updates positions or grants as needed; saves the changes.
  - **Outcome:** The member's organization facts and app access are represented without overloading auth roles.
  - **Covered by:** R1, R2, R5, R8

- F2. START Cockpit checks a scoped permission
  - **Trigger:** A user attempts an action such as editing another member.
  - **Actors:** A3, A4, A5
  - **Steps:** The app evaluates the requested permission against the user's positions and access grants; scope is compared against the target member's department when required; global admin grants bypass scope only where the policy explicitly allows.
  - **Outcome:** The action is allowed only when the policy grants it for the user's position or access grant in the relevant scope.
  - **Covered by:** R3, R4, R6, R7

- F3. People page renders the org chart
  - **Trigger:** A user switches the people list into org chart view.
  - **Actors:** A2, A3, A5
  - **Steps:** The app derives top-level board and leadership nodes from organizational positions; department members are grouped under their department head when one exists; users without departments only appear when they hold a global board-level position.
  - **Outcome:** The org chart reflects real organizational structure without relying on authorization roles.
  - **Covered by:** R2, R9, R10

---

## Requirements

**Domain separation**
- R1. User lifecycle status must remain separate from organization structure and permissions. It represents membership/onboarding/alumni/payment lifecycle state, not organizational authority.
- R2. Organizational positions must represent real START positions, including global positions such as president, vice president, head of finance, and board member, and department-scoped positions such as department head.
- R3. Access grants must represent explicit app access that is not itself an organizational position, such as admin or people admin.
- R4. Effective permissions must be computed from explicit policy rules over positions, access grants, status when relevant, and request context.

**Positions and departments**
- R5. A user may hold multiple organizational positions.
- R6. Department membership remains optional and max one per user.
- R7. Department-scoped positions and grants must support at least global and department scopes from the first version.
- R8. Department heads must not require a duplicate generic board-member assignment. Board-level membership is derived from specific positions.

**Permission policy**
- R9. The central permission map must continue to be the readable source of truth for which positions and access grants satisfy each permission.
- R10. Being board-level must not grant permissions by itself. Each permission must explicitly list the positions or grants that satisfy it.
- R11. `admin` remains a global superuser access grant.
- R12. Narrower grants such as people admin must be able to be department-scoped.
- R13. Permission checks for scoped actions must receive enough target context to compare scope, such as the target user's department.

**Admin maintenance**
- R14. Admins must be able to edit a member's organizational positions and access grants from the member detail page.
- R15. Position and access-grant editing UI must be visible only to admins.
- R16. Non-admin users must not be able to infer or modify privileged access configuration through the member detail UI.

**Org chart consumption**
- R17. The people org chart must use organizational positions, not authorization roles, to identify board-level and department-head placement.
- R18. Global board positions may appear in the top layer even when the user has no department.
- R19. Users without departments must not appear as department members.

**Migration**
- R20. Existing overloaded role data must be migrated into the new model rather than kept as the long-term source of truth.
- R21. Existing `admin` roles should become global admin access grants.
- R22. Existing `department_lead` roles should become department-head positions scoped to the user's department when the user has a department.
- R23. Existing `board` roles should become board-member positions by default, then named officer positions can be corrected manually.
- R24. Existing `member` roles should not become access grants or positions.

---

## Acceptance Examples

- AE1. **Covers R2, R8, R10.** Given a user has a `department_head` position scoped to Events, when the org chart is rendered, the user appears as the Events head and board-level without also needing a `board_member` assignment.
- AE2. **Covers R3, R7, R12, R13.** Given a user has a `people_admin` grant scoped to Growth, when they edit a Growth member, the action is allowed; when they edit an Events member, the action is denied.
- AE3. **Covers R11.** Given a user has a global `admin` access grant, when they perform an admin-managed action, the action is allowed where the permission policy includes admin.
- AE4. **Covers R14, R15, R16.** Given a non-admin opens a member detail page, when the page renders, position and access-grant editing controls are not visible.
- AE5. **Covers R18, R19.** Given the president has no department and an alumnus has no department, when the org chart renders, the president appears in the top layer and the alumnus does not appear.
- AE6. **Covers R20-R24.** Given legacy users with `admin`, `board`, `department_lead`, and `member` roles, when migration is complete, each has the corresponding new grant or position and permissions no longer depend on the old overloaded role semantics.

---

## Success Criteria

- START Cockpit can answer "is this user board-level?" without using authorization roles.
- START Cockpit can answer scoped permission questions such as "can this user edit this department's members?"
- Admins can maintain positions and explicit grants from member detail pages.
- The org chart and permission system share the same organizational source of truth.
- Planning can proceed without inventing the conceptual split between status, department, positions, grants, and permissions.

---

## Scope Boundaries

- The first version supports global and department scopes only.
- Department membership remains optional and max one per user.
- The first admin UI lives on the member detail page only.
- No dedicated access audit page is required in the first version.
- No bulk editor is required in the first version.
- No group-scoped or arbitrary resource-scoped permissions are required in the first version.
- Board-level status is a derived organizational category, not a permission tier.

---

## Key Decisions

- Separate positions from access grants: positions describe real organization structure; access grants describe app-specific permission exceptions.
- Keep the central permission map: permissions remain easy to read, but policies can name both positions and grants.
- Support scope from day one: department-head and people-admin cases require department-aware checks immediately.
- Keep admin as a global superuser: this preserves a simple operational escape hatch while narrower grants serve least-privilege cases.
- Migrate legacy roles immediately: the target model should not carry `board` and `department_lead` as long-term auth-role semantics.

---

## Dependencies / Assumptions

- Current code stores lifecycle status, department, and roles on users in `src/db/schema/auth.ts`.
- Current permission policy is centralized in `src/lib/permissions/index.ts`.
- Current member detail UI exists under `src/app/(authenticated)/(app)/people/[id]/`.
- Current roles are overloaded and should be treated as migration input, not future product vocabulary.

---

## Outstanding Questions

### Resolve Before Planning

- None.

### Deferred to Planning

- [Affects R7, R13][Technical] Decide the exact shape of permission context objects for scoped checks.
- [Affects R14-R16][Technical] Decide the minimal UI controls for editing multiple positions and scoped grants on member detail pages.
- [Affects R20-R24][Technical] Decide whether migration should be one generated database migration, a seed/backfill script, or both.

---

## Next Steps

-> `/ce-plan` for structured implementation planning.
