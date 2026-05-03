---
title: "START Cockpit permission policy API convention"
date: "2026-05-02"
category: conventions
module: "authorization"
problem_type: convention
component: documentation
severity: medium
related_components:
  - permissions
  - server_actions
  - client_ui
tags:
  - authorization
  - permissions
  - typescript
  - policy-api
applies_when:
  - Adding or changing permission rules
  - Gating client UI by permission
  - Enforcing permissions in server components, actions, routes, or workflows
---

# START Cockpit permission policy API convention

## Context

START Cockpit separates member lifecycle state, organization positions, app access grants, and effective authorization. Permission rules should read as business policy, not as storage details.

The permission policy lives in the explicit evaluator in `src/lib/permissions/evaluate.ts`. It uses `GlobalAction` for actions with no target department argument and `DepartmentScopedAction` for actions that require a target department scope. `GlobalAction` does not mean only global authorities can perform the action; it means the action itself is not scoped to one target department.

`src/lib/permissions/index.ts` is only the public export surface. Do not add new domain helpers there. Authority vocabulary belongs in `src/lib/authority/model.ts`; assignment validation belongs in `src/lib/authority/assignments.ts`; board roster logic belongs in `src/lib/authority/board-roster.ts`. Legacy `user.roles` values are not part of the permission surface.

## Core Rules

Use `can()` for server-side enforcement. Server components, server actions, route handlers, database guards, and workflows must enforce protected behavior with `src/lib/permissions/server.ts`.

Use `<Can>` for simple client rendering gates. Use `useCan()` when the client needs a boolean for behavior or affordances, such as row click handlers, links, disabled states, or cursor styling.

Do not import the low-level evaluator directly in app UI. Client checks should go through the authority context that the authenticated app layout already provides.

Client checks are only UI affordances. Sensitive reads and mutations still need server-side `can()` checks.

## Evaluator Vocabulary

Use plain switch cases in `evaluateAuth()` for permission behavior. A case should read like the business rule, using small local helpers only for obvious domain checks.

For department-scoped permissions, keep the target comparison visible. Prefer `isDepartmentHead(authority, scope.targetDepartment)` over hiding the comparison behind a broader predicate name.

Use local legal-officer checks for President, Vice President, and Head of Finance when the permission relates to legal membership decisions. Department heads should not receive legal board access unless an evaluator case explicitly says so.

## Adding Permissions

When adding a permission:

- Add the action to either `GlobalAction` or `DepartmentScopedAction`.
- Add an explicit `evaluateAuth()` switch case with plain boolean logic.
- Add runtime tests for allowed and denied authorities.
- Add type-level coverage when the permission changes action scope or call-site requirements.
- Check both server enforcement and client affordances when a permission affects UI navigation or visibility.

When adding an authority assignment kind:

- Add the position or grant to `src/lib/authority/model.ts`.
- Update assignment validation in `src/lib/authority/assignments.ts`.
- Update persistence constraints in `src/db/schema/authority.ts` if the scope or uniqueness rules change.
- Add tests that prove the domain model, validation, and evaluator vocabulary still agree.

## Examples

Target-department permission:

```text
users.view_details:
  allow admin
  allow head of the target department
```

Contextless permission:

```text
groups.view_all:
  allow admin
  allow legal officer
  allow any department head
```

Those two rules are intentionally different. The first compares against a target member department. The second does not.
