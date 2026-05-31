# Admin User Actions — Requirements

**Date:** 2026-05-29
**Status:** Ready for planning

## Overview

Add three new contextual actions to the per-member 3-dot dropdown menus in the admin people section (the same menus that currently hold "Remove from START Berlin"). Each action is role-gated, audit-logged, and tracked in PostHog.

## Actions

### 1. Change / Assign Department

**Label:** "Assign Department" when the user has no department set; "Change Department" when one is already assigned.

**Permitted roles:**
- Department head — scoped to users currently in their own department (i.e. `targetDepartment === actor's department`). Cannot assign a department to a supporting alumni who has none (no department = outside their scope).
- Legal officers (president, vice president, head of finance)
- People admins

**Behavior:**
- Opens a modal with a department select (all five departments: partnerships, operations, people, growth, events).
- For `member` and `alumni` statuses, a department is mandatory — the field will always have a value and the action is always "Change".
- For `supporting_alumni`, a department is optional — the action is "Assign" when null, "Change" when set.
- On save, fires the existing `cockpitUserUpdated` Inngest event to keep Google Group memberships in sync.

**Notifications (email):**
- Notify the affected user that their department was changed (include old and new department names).
- Notify the outgoing department head (if any) that the member has left their department.
- Notify the incoming department head (if any) that a member has been assigned to their department.

**Audit log:** `eventType: "user.department_changed"`, actor + subject + metadata `{ oldDepartment, newDepartment }`.

**PostHog:** track `user_department_changed` with `{ actor_id, subject_id, old_department, new_department }`.

---

### 2. Change Personal Email

**Permitted roles:**
- Department head — scoped to users in their own department
- Legal officers
- People admins

**Behavior:**
- Opens a modal with a single email input (format-validated).
- No verification step on the new address — the change is applied immediately.

**Notifications (email):**
- Send a security notice to the **old** personal email informing them their contact address was changed.
- Send a confirmation to the **new** personal email.

**Audit log:** `eventType: "user.personal_email_changed"`, actor + subject + metadata `{ oldEmail, newEmail }`.

**PostHog:** track `user_personal_email_changed` with `{ actor_id, subject_id }` (no email values in analytics).

---

### 3. Reset Password

**Permitted roles:** `admin` and `super_admin` grant holders only. Not available to people admins, department heads, or legal officers.

**Behavior:**
- Opens a confirmation dialog explaining what will happen.
- On confirm: generate a random password (reuse existing `generateRandomPassword()` from `src/inngest/new-user-workflow.ts`), update it in Google Workspace via the Admin SDK with `changePasswordAtNextLogin: true`, send the new password to the user's personal email.
- Email template: reuse or adapt `SignInInstructionsEmail`.

**Notifications (email):**
- Send the new temporary password to the user's `personalEmail`.

**Audit log:** `eventType: "user.password_reset"`, actor + subject (no password in metadata).

**PostHog:** track `user_password_reset` with `{ actor_id, subject_id }`.

---

## UI Placement

All three actions appear in the existing `membership-card-menu.tsx`-style 3-dot dropdown on the member detail page (alongside "Propose for membership" and "Remove from START Berlin"). Each action is conditionally rendered based on the actor's permissions — an action not available to the current user is simply absent from the menu.

Actions open modal dialogs inline (same pattern as the Impersonate confirmation in `member-header-menu.tsx`).

## Permission Model

New actions need corresponding entries in `src/lib/permissions/evaluate.ts`:
- `user.department.change` — user-scoped, available to department heads + legal officers + people admins
- `user.personal_email.change` — user-scoped, same roles
- `user.password.reset` — global action (not user-scoped), available to admin + super_admin only

## Out of Scope

- Changing the company / START Berlin email
- Password reset by department heads or legal officers
- Bulk department reassignment
- Verification flow for new personal email (e.g. confirmation link)
