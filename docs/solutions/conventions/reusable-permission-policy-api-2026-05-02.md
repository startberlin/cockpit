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

START Cockpit separates member lifecycle state, organization roles, app permissions, and effective authorization. Permission rules should read as business policy, not as storage details.

The permission policy lives in `src/lib/permissions/index.ts`. It uses named predicates such as admin, legal officer, any department head, and head of the target department. This avoids ambiguous buckets like "global positions" versus "department positions" and makes it clear whether a rule compares against a target member's department.

## Core Rules

Use `can()` for server-side enforcement. Server components, server actions, route handlers, database guards, and workflows must enforce protected behavior with `src/lib/permissions/server.ts`.

Use `<Can>` for simple client rendering gates. Use `useCan()` when the client needs a boolean for behavior or affordances, such as row click handlers, links, disabled states, or cursor styling.

Do not import the low-level evaluator directly in app UI. Client checks should go through the authority context that the authenticated app layout already provides.

Client checks are only UI affordances. Sensitive reads and mutations still need server-side `can()` checks.

## Predicate Vocabulary

Use target-aware predicates when the rule depends on the resource being acted on. For example, member profile access for department heads should compare the department head's department with the target member's department.

Use context-free predicates when the rule does not depend on the target. For example, "any department head can view the groups page" should use the any-department-head predicate rather than pretending `department_head` is a global role.

Use legal-officer predicates for President, Vice President, and Head of Finance when the permission relates to legal membership decisions. Department heads should not receive legal board access unless a policy explicitly says so.

## Adding Permissions

When adding a permission:

- Add the action and its context shape first.
- Choose predicates that describe the business rule directly.
- Add runtime tests for allowed and denied authorities.
- Add type-level coverage when the permission introduces a new context shape or predicate combination.
- Check both server enforcement and client affordances when a permission affects UI navigation or visibility.

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
