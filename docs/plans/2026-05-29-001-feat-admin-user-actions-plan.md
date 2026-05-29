---
title: "feat: Add Admin User Actions — Change Department, Change Personal Email, Reset Password"
type: feat
status: active
date: 2026-05-29
origin: docs/brainstorms/admin-user-actions-requirements.md
---

# feat: Add Admin User Actions — Change Department, Change Personal Email, Reset Password

## Summary

Adds three new actions to the per-member 3-dot menu in the admin people section: Change/Assign Department, Change Personal Email, and Reset Password. Department heads, legal officers, and people admins can change a member's department. Only admins and super admins can change a personal email address or reset a password. All three actions are audit-logged and PostHog-tracked. Every notification email is sent to both the user's personal email and their company (START Berlin) email address.

---

## Problem Frame

Admins and department leads currently have no self-service way to change a member's department from the Cockpit, and no admin can change a personal email address or reset a member's Google Workspace password without going outside the system. These actions require manual access to external tooling.

---

## Requirements

- R1. A department head can change the department of any user currently in their department.
- R2. A legal officer or people admin can change the department of any user, including assigning a department to a supporting alumni with none set.
- R3. An admin or super_admin can change the personal email of any user.
- R4. An admin or super_admin can reset a user's password: generate a random credential, update it in Google Workspace with `changePasswordAtNextLogin: true`, and deliver it to the user's personal email and company email.
- R5. Changing a department notifies the affected user (personal + company email), the outgoing department head (if assigned), and the incoming department head (if assigned).
- R6. Changing a personal email notifies both the old and new personal addresses, plus the user's company email.
- R7. All three actions write an audit log entry and fire a PostHog event.
- R8. The department action label is "Assign Department" when no department is currently set, "Change Department" when one is.
- R9. Changing a department fires the existing Inngest group-sync events to keep Google Group memberships in sync.

---

## Scope Boundaries

- Changing the company/START Berlin email address is not in scope.
- Password reset and personal email change are restricted to admin/super_admin — not available to department heads, legal officers, or people admins.
- No email verification step for a newly set personal email address.
- No bulk operations across multiple users.
- No rate limiting on password reset (admin-only action; accepted risk documented in Risks table).

---

## Context & Research

### Relevant Code and Patterns

- **Permission model**: `src/lib/permissions/evaluate.ts` — `UserScopedAction`, `GlobalAction`, `evaluateUserScopedAction`, `isDepartmentHead`, `isLegalOfficer`, `hasPeopleAdminGrant`
- **`can()` wrapper**: `src/lib/permissions/server.ts` — `can(action, { department })` for user-scoped actions; `can(action)` for global actions
- **Server action shape**: `src/app/(authenticated)/(app)/(default)/admin/people/[id]/board-kick-action.ts` — `actionClient.inputSchema(z).action(async ({ parsedInput, ctx }) => { ... await can() ... await writeAuditLog(...) ... after(() => track(...)) })`
- **Inline modal pattern**: `src/app/(authenticated)/(app)/(default)/admin/people/[id]/member-header-menu.tsx` — `useState` for open state, `useAction` from `next-safe-action/hooks`, confirm dialog as sibling to `DropdownMenu`, `onSelect` (not `onClick`) on menu items
- **Email sending**: `src/lib/email.ts` — `sendEmail({ from, to, subject, react })` — `to` accepts `string | string[]`; the function automatically writes an `email.sent` audit log entry per recipient
- **Audit log**: `src/lib/audit-log.ts` — `writeAuditLog({ category, eventType, actor, subject, metadata, description })`
- **PostHog tracking**: `src/lib/posthog-server.ts` — `track({...})` inside `after(() => ...)` in server actions; new events must be added to the `TrackingEvent` discriminated union
- **Password generation**: `generateRandomPassword()` in `src/inngest/new-user-workflow.ts` — to be extracted to `src/lib/crypto.ts`
- **Google Workspace password update**: `admin.users.update({ userKey, requestBody: { password, changePasswordAtNextLogin: true } })` — pattern from `new-user-workflow.ts` → `send-signin-instructions-email` step; uses `createGoogleAuth("https://www.googleapis.com/auth/admin.directory.user")`
- **Department head lookup**: `getPositionAssignments()` from `src/db/authority.ts` — returns `positions.departmentHeads[department]` as `PositionHolder | null`; `PositionHolder.email` is `string | null`
- **Inngest group-sync events**: `events.cockpitUserUpdated` (for Google Group reconciliation) and `events.userSystemGroupsSync` (for system groups) from `src/lib/inngest.ts`; `userSystemGroupsSync` requires `{ userId, before: { status, department, batchNumber }, after: { ... } }`
- **Department constants**: `DEPARTMENT_IDS`, `DEPARTMENT_NAMES` from `src/lib/departments.ts`
- **Existing menu to extend**: `src/app/(authenticated)/(app)/(default)/admin/people/[id]/membership-card-menu.tsx`

### Institutional Learnings

- Every new action must be added to `GlobalAction` or `UserScopedAction` in `evaluate.ts` with an explicit switch case. Never guard server actions with ad-hoc role checks outside `evaluateAuth()`. (see `docs/solutions/conventions/reusable-permission-policy-api-2026-05-02.md`)
- `<Can>` / `useCan()` are UI affordance gates only — every mutation still requires a server-side `can()` check.
- Do not touch `user.status` or `user.legalMembershipState` in these actions — those fields have strict write paths through Inngest. (see `docs/solutions/architecture-patterns/member-lifecycle-entry-points-and-application-flow-2026-05-10.md`)

---

## Key Technical Decisions

- **`user.department.change` as `UserScopedAction`, `user.personal_email.change` and `user.password.reset` as `GlobalAction`**: Department change requires the target user's department as scope for the department head check. Personal email change and password reset are admin/super_admin only — no department scope needed, both become `GlobalAction` entries matching `users.impersonate`.
- **All three as direct server actions, no new Inngest functions**: The actions are synchronous and don't require the Inngest retry/sleep model. For password reset, generating and consuming the password within the same function scope avoids the Inngest step-history risk (passwords must never appear in step return values).
- **`generateRandomPassword()` extracted to `src/lib/crypto.ts`**: Both `new-user-workflow.ts` and the reset action need it — a single shared function is easier to audit and test.
- **All notifications CC the company email**: Every email sent for these actions goes to both the user's `personalEmail` and their `email` (company/START Berlin address). This ensures the user has two channels to detect or react to any admin change. Use `to: [personalEmail, companyEmail]` (array form accepted by `sendEmail`). If `personalEmail` is null, send to `companyEmail` only; never skip the company email.
- **Audit log written before external API calls in U6**: For the password reset action, `writeAuditLog` is called immediately after the permission check passes and before the Google Workspace API call. This ensures every authorized reset attempt is logged even if the API call subsequently fails.
- **U4 fetch-then-check pattern with optimistic concurrency**: Fetch the target user first to get their current department, then run the scoped `can()` check. Use optimistic concurrency on the update (`WHERE id = userId AND department = oldDept`) to detect concurrent modification. If 0 rows updated, throw a conflict error. Always throw a uniform `"Not authorized"` error when the user is not found, to prevent user ID enumeration.
- **Dept head notifications conditional on assignment and non-null email**: `getPositionAssignments()` is called before update. Skip notification when the dept head slot is unfilled OR when `PositionHolder.email` is null. Log a warning in either case.
- **Workspace API timeout**: Wrap the Google Admin SDK call in a 20-second `AbortSignal` timeout. If it exceeds the limit, the action throws a user-facing error ("Password reset timed out — please try again") before the email is sent, so the admin knows to retry.
- **Email notifications inline via `sendEmail`**: Notifications are sent after the DB write inside the server action. If a notification email fails after the main change succeeds, it is logged but does not roll back the operation.

---

## Open Questions

### Resolved During Planning

- **Should password reset use Inngest?** No — a single function scope is simpler and avoids the step-history security risk.
- **Which Inngest events fire on department change?** Both `cockpitUserUpdated` and `userSystemGroupsSync`, mirroring the import action pattern. The action reads current user state before updating to build the `before` payload for `userSystemGroupsSync`.
- **Can dept head notifications be skipped silently?** Yes — if the position is unfilled or email is null, skip and log a warning without throwing.
- **Should personal email change be restricted to admin/super_admin?** Yes — restricting it to the same privilege level as password reset eliminates the credential hijack chain where a lower-privileged actor sets an attacker-controlled personal email and then triggers a password reset.
- **Should notifications CC the company email?** Yes — all three action notifications go to both personal email and company email.

### Deferred to Implementation

- Exact React Email component copy and layout (follow `EmailShell` + `EmailDetailBlock` conventions; specific wording is an implementer decision).
- Exact `DISABLE_GOOGLE_WORKSPACE` branching in U6 (follow the existing pattern in `new-user-workflow.ts`).

---

## Implementation Units

### U1. Extract `generateRandomPassword()` to shared utility

**Goal:** Move the password generation function into a shared `src/lib/crypto.ts` module so both the onboarding workflow and the password reset action can use it without duplication.

**Requirements:** R4

**Dependencies:** None

**Files:**
- Create: `src/lib/crypto.ts`
- Modify: `src/inngest/new-user-workflow.ts` (remove local definition, import from `src/lib/crypto`)

**Approach:**
- Move `generateRandomPassword(length = 15)` verbatim to `src/lib/crypto.ts`. Export it.
- Update `new-user-workflow.ts` to import from the new location — no behavioral change.
- Keep the module server-only (no `"use client"` anywhere in its import chain).

**Patterns to follow:**
- `src/lib/id.ts` — small focused utility module pattern

**Test scenarios:**
- Happy path: `generateRandomPassword()` returns a string of default length 15 containing at least one character from each required class (uppercase, lowercase, digit, special).
- Edge case: `generateRandomPassword(20)` returns a string of length 20 with the same class guarantees.

**Verification:**
- `new-user-workflow.ts` compiles and imports correctly with no behavioral change in the onboarding flow.

---

### U2. Permission model — add three new actions

**Goal:** Extend `evaluate.ts` with the new action types and their evaluation rules. Add runtime tests for all allowed/denied role combinations.

**Requirements:** R1, R2, R3, R4

**Dependencies:** None

**Files:**
- Modify: `src/lib/permissions/evaluate.ts`
- Test: `src/lib/permissions/permissions.test.ts`

**Approach:**
- Add `"user.department.change"` to the `UserScopedAction` union type and the `userScopedActions` const array. Add a `case "user.department.change":` switch arm in `evaluateUserScopedAction`:
  - Allowed when `isDepartmentHead(authority, scope.targetDepartment)` OR `isLegalOfficer(authority)` OR `hasPeopleAdminGrant(authority)`.
  - When `targetDepartment === null` (supporting alumni with no dept), `isDepartmentHead` returns false — legal officers and people admins still pass.
- Add `"user.personal_email.change"` and `"user.password.reset"` to the `GlobalAction` union type and the `globalActions` const array. Add `case` arms in `evaluateGlobalAction` for both:
  - Both allowed when `hasAdminGrant(authority)` (covers both `admin` and `super_admin`).
- `user.department.change` is NOT an `UnscopedViewAction` — it always requires explicit scope in server actions.

**Patterns to follow:**
- `user.membership.propose` case in `evaluateUserScopedAction`
- `users.impersonate` case in `evaluateGlobalAction`

**Test scenarios:**
- `user.department.change` — allowed: dept head matching target dept; legal officer (any dept); people admin (any dept); legal officer with `targetDepartment: null`.
- `user.department.change` — denied: dept head with non-matching target dept; dept head with `targetDepartment: null`; finance admin (no people_admin/legal); inactive user (any role).
- `user.personal_email.change` — allowed: `admin` grant; `super_admin` grant.
- `user.personal_email.change` — denied: `people_admin` only; department head only; legal officer only; inactive user.
- `user.password.reset` — allowed: `admin` grant; `super_admin` grant.
- `user.password.reset` — denied: `people_admin` only; department head only; legal officer only; inactive user.

**Verification:**
- All new test cases pass. TypeScript compilation passes — no unhandled switch branches in either evaluator function.

---

### U3. Email templates

**Goal:** Create the four email templates used by the three new actions.

**Requirements:** R4, R5, R6

**Dependencies:** None

**Files:**
- Create: `src/emails/admin/department-changed-member.tsx`
- Create: `src/emails/admin/department-changed-dept-head.tsx`
- Create: `src/emails/admin/personal-email-changed.tsx`
- Create: `src/emails/admin/password-reset.tsx`

**Approach:**
- All templates use `<EmailShell footerAudience="member">` as the outer wrapper.
- `department-changed-member.tsx`: Props `{ firstName, oldDepartment: string | null, newDepartment: string }`. When `oldDepartment` is null, "has been assigned to [dept]"; when set, "has been changed from [old] to [new]."
- `department-changed-dept-head.tsx`: Props `{ firstName, memberName: string, memberEmail: string, department: string, direction: "joined" | "left" }`. Notifies the head that a member joined or left their department.
- `personal-email-changed.tsx`: Props `{ firstName, newEmail: string, isSecurityNotice: boolean }`. Security notice variant (to old address): "your contact email address has been changed by an admin to [newEmail]." Confirmation variant (to new address): "your contact email address has been updated to [newEmail]."
- `password-reset.tsx`: Props `{ firstName, companyEmail: string, temporaryPassword: string }`. Adapted from `src/emails/auth/signin-instructions.tsx` — same credential delivery structure with `EmailDetailBlock` for the email/password rows, plus a note that the user must change the password on next sign-in.

**Patterns to follow:**
- `src/emails/positions/position-assigned.tsx` — simple notification shape
- `src/emails/auth/signin-instructions.tsx` — credential delivery with `EmailDetailBlock`

**Test scenarios:**
- Test expectation: none — React components with no business logic; visual correctness validated via `npm run email:dev` preview.

**Verification:**
- All four templates render without errors. `npm run email:dev` shows all four previews correctly.

---

### U4. Change Department server action

**Goal:** Server action that updates a user's department, fires Inngest group-sync events, notifies affected parties, writes audit log, and tracks PostHog.

**Requirements:** R1, R2, R5, R7, R8, R9

**Dependencies:** U2, U3

**Files:**
- Create: `src/app/(authenticated)/(app)/(default)/admin/people/[id]/change-department-action.ts`

**Approach:**
- Input: `{ userId: string, department: z.enum(DEPARTMENT_IDS) }`.
- Fetch current user: capture `department` (old), `status`, `batchNumber`, `personalEmail`, `email` (company), `firstName`, `lastName`. If user not found, throw `"Not authorized"` (uniform error — do not reveal user existence).
- Permission check: `can("user.department.change", { department: existingUser.department })`. Throw `"Not authorized"` if denied.
- Write audit log immediately after permission check: `category: "user"`, `eventType: "user.department_changed"`, actor + subject + `metadata: { oldDepartment, newDepartment }`. This ensures every authorized attempt is recorded.
- DB update with optimistic concurrency: `UPDATE user SET department = newDept WHERE id = userId AND department = oldDept`. If 0 rows affected, throw a conflict error ("Department was changed concurrently — please reload and try again").
- Fire `events.cockpitUserUpdated` with `{ id: userId }`.
- Fire `events.userSystemGroupsSync` with `before: { status, department: oldDept, batchNumber }` and `after: { status, department: newDept, batchNumber }`. Wrap `inngest.send` calls in try/catch — log failures at error level but do not throw (the daily cron is the backstop).
- Fetch `getPositionAssignments()` to resolve old dept head and new dept head. Filter out entries where `PositionHolder.email` is null (log a warning). If old and new heads are the same person, send one email.
- Send notifications via `sendEmail` with `to: [personalEmail, companyEmail]` for the user, and `to: deptHead.email` for dept head notifications:
  - User: `DepartmentChangedMemberEmail`
  - Old dept head (if any, email non-null): `DepartmentChangedDeptHeadEmail` with `direction: "left"`
  - New dept head (if any, email non-null, different from old): `DepartmentChangedDeptHeadEmail` with `direction: "joined"`
- Call `revalidatePath("/admin/people/[id]")` so the UI refreshes after success.
- `after(() => track(...))`: add `"admin_user_department_changed"` to `TrackingEvent`; properties `{ actor_id: string, old_department: string | null, new_department: string }` + `SubjectProperties`.

**Patterns to follow:**
- `src/app/(authenticated)/(app)/(default)/admin/people/[id]/board-kick-action.ts`
- `src/app/(authenticated)/(app)/(default)/admin/people/import-google-user-action.ts` (Inngest dispatch pattern)

**Test scenarios:**
- Happy path: dept head for "operations" updates a user in "operations" to "events" → DB updated, both Inngest events fired with correct before/after, 3 notifications sent (each to personal + company email), audit log written, page revalidated.
- Edge case: supporting alumni with `department: null` — dept head permission denied; legal officer/people admin allowed; update proceeds.
- Edge case: new department has no head assigned → user receives notification only; no error.
- Edge case: old dept head and new dept head are the same person → one email sent, no duplicate.
- Edge case: dept head email is null for a position → that notification skipped with a warning log; no error thrown.
- Error path: actor has no permission → uniform "Not authorized", no DB change.
- Error path: user not found → uniform "Not authorized" (same error as permission denied — no existence leak).
- Error path: optimistic concurrency conflict → descriptive conflict error, no side-effects.
- Integration: after success, `cockpitUserUpdated` event visible in Inngest dev server; page revalidates and shows new department.

**Verification:**
- `department` field updated in DB. Inngest events visible in dev server. Notifications sent to correct addresses (personal + company). Audit log entry exists before any Inngest or email side-effects.

---

### U5. Change Personal Email server action

**Goal:** Server action that updates a user's personal email and notifies the old, new, and company addresses.

**Requirements:** R3, R6, R7

**Dependencies:** U2, U3

**Files:**
- Create: `src/app/(authenticated)/(app)/(default)/admin/people/[id]/change-personal-email-action.ts`

**Approach:**
- Input: `{ userId: string, personalEmail: z.string().email() }`.
- Fetch current user to capture old `personalEmail`, `email` (company), `firstName`. If not found, throw `"Not authorized"`.
- Permission check: `can("user.personal_email.change")` — GlobalAction, no scope.
- Guard: if `newEmail === oldEmail`, surface a validation error (no-op).
- Write audit log immediately after permission check: `category: "user"`, `eventType: "user.personal_email_changed"`, actor + subject + `metadata: { oldEmail, newEmail }`. Note: `oldEmail` and `newEmail` are PII — subject to the same erasure obligations as the `personalEmail` field itself.
- DB update: set `personalEmail` to new value.
- Send notifications via `sendEmail`:
  - To old personal address (if not null) + CC company email: `PersonalEmailChangedEmail` with `isSecurityNotice: true, newEmail`.
  - To new personal address + CC company email: `PersonalEmailChangedEmail` with `isSecurityNotice: false, newEmail`.
  - If old personal email is null: skip the old-address notification but still send to new address + company email.
- Call `revalidatePath("/admin/people/[id]")`.
- `after(() => track(...))`: add `"admin_user_personal_email_changed"` to `TrackingEvent`; properties `{ actor_id: string }` + `SubjectProperties` (no email values in PostHog).

**Patterns to follow:**
- Same server action structure as U4.

**Test scenarios:**
- Happy path: admin updates personal email → DB updated, notifications sent to old + new personal addresses (each CCing company email), audit log written before DB write.
- Edge case: old and new email are identical → validation error, no emails sent, no audit log.
- Edge case: user currently has no personal email → old-address notification skipped; new address + company email notified.
- Error path: invalid email format → Zod rejects before any DB change.
- Error path: non-admin actor (dept head, people_admin, legal officer) → denied before fetch.
- Security: audit log contains both email values (PII acknowledged — admin-only read access applies).

**Verification:**
- `personalEmail` field updated in DB. Notifications sent to correct addresses. Company email always included.

---

### U6. Reset Password server action

**Goal:** Server action that generates a random password, updates it in Google Workspace with forced change at next login, and delivers credentials to the user's personal and company email addresses.

**Requirements:** R4, R7

**Dependencies:** U1, U2, U3

**Files:**
- Create: `src/app/(authenticated)/(app)/(default)/admin/people/[id]/reset-password-action.ts`

**Approach:**
- Input: `{ userId: string }`.
- Permission check: `can("user.password.reset")` — GlobalAction, no scope. Throw immediately if denied.
- Fetch current user: need `email` (company/Workspace), `personalEmail`, `firstName`. If not found, throw `"Not authorized"`.
- Guard: if `personalEmail` is null, throw `"Cannot reset password: this user has no personal email address on file."`.
- Write audit log immediately: `category: "user"`, `eventType: "user.password_reset"`, actor + subject; **no password in metadata**. Log before external API call so every authorized attempt is recorded.
- Call `generateRandomPassword()` from `src/lib/crypto.ts`. The password must not be assigned to a variable that could be returned from the action, serialized, or logged.
- Call Google Workspace Admin SDK with a 20-second `AbortSignal` timeout:
  `admin.users.update({ userKey: user.email, requestBody: { password, changePasswordAtNextLogin: true } })`.
  If the call times out or fails, throw `"Password reset timed out — please try again"` (or equivalent); the email is NOT sent.
- Send email via `sendEmail` with `to: [personalEmail, companyEmail]` using `PasswordResetEmail`. The company email (Google Workspace) will be accessible only after the user changes their password, but serves as a persistent record in their inbox.
- Call `revalidatePath("/admin/people/[id]")`.
- `after(() => track(...))`: add `"admin_user_password_reset"` to `TrackingEvent`; properties `{ actor_id: string }` + `SubjectProperties`.

**Patterns to follow:**
- Google Workspace password update: `src/inngest/new-user-workflow.ts` → `send-signin-instructions-email` step

**Test scenarios:**
- Happy path: admin resets password → audit log written first, Workspace password updated, email sent to both personal + company addresses, no password in audit log or PostHog payload.
- Error path: user has no personal email → action throws descriptive error before audit log or Workspace call.
- Error path: Workspace API times out → action throws; email NOT sent; audit log already written (attempt is recorded).
- Error path: `DISABLE_GOOGLE_WORKSPACE=true` → Workspace call skipped per existing env branching pattern.
- Error path: non-admin actor → denied before any fetch or log write.
- Security: generated password does not appear in any return value, audit log metadata, or PostHog event properties.

**Verification:**
- Audit log entry written before Workspace call. Password updated in Workspace (or skipped cleanly in dev). Reset email received at both personal and company addresses. No password in audit log.

---

### U7. UI — extend membership-card-menu and page permissions

**Goal:** Surface all three new actions in the per-member dropdown with inline modals and correct role-based visibility. Thread new permission booleans from the server component down to the menu.

**Requirements:** R1–R9 (surfaces all actions)

**Dependencies:** U2, U4, U5, U6

**Files:**
- Modify: `src/app/(authenticated)/(app)/(default)/admin/people/[id]/page.tsx`
- Modify: `src/app/(authenticated)/(app)/(default)/admin/people/[id]/membership-card.tsx` (intermediate server component that threads props to the menu)
- Modify: `src/app/(authenticated)/(app)/(default)/admin/people/[id]/membership-card-menu.tsx`

**Approach:**

**page.tsx** — add to the `Promise.all` permission block:
- `can("user.department.change", { department: user.department })` → `canChangeDepartment`
- `can("user.personal_email.change")` → `canChangePersonalEmail` (GlobalAction, no scope)
- `can("user.password.reset")` → `canResetPassword` (GlobalAction, no scope)
- Thread all three, plus `user.personalEmail` (for Reset Password dialog display) and `user.department` (for the Assign/Change label), through to `MembershipCard` and then to `MembershipCardMenu`.

**membership-card-menu.tsx** — add props, state, actions, and dialogs:

New props: `canChangeDepartment: boolean`, `canChangePersonalEmail: boolean`, `canResetPassword: boolean`, `currentDepartment: Department | null`, `personalEmail: string | null`.

Update null guard: `if (!canPropose && !canRemove && !canChangeDepartment && !canChangePersonalEmail && !canResetPassword) return null`.

Add 3 `useState(false)` hooks (dept dialog, email dialog, password dialog) and 3 `useAction(...)` hooks.

**Menu item ordering** (top to bottom):
1. Change/Assign Department (if `canChangeDepartment`)
2. Change Personal Email (if `canChangePersonalEmail`)
3. Propose for membership (if `canPropose`) — existing
4. `<DropdownMenuSeparator />` (if any of [canResetPassword, canRemove] are true)
5. Reset Password (if `canResetPassword`) — styled destructive
6. Remove from START Berlin (if `canRemove`) — existing, styled destructive

**Dialog: Change/Assign Department**
- Title: `currentDepartment ? "Change Department" : "Assign Department"`
- Content: shadcn/ui `<Select>` pre-populated with `currentDepartment` as the default value (so the admin sees what's currently set). Submit button disabled when `selectedValue === currentDepartment`.
- Warning text below the select: "Note: moving this member out of your department will remove your ability to undo this action."
- On submit: `execute({ userId, department: selectedValue })`.

**Dialog: Change Personal Email**
- Title: "Change Personal Email"
- Content: `<Input type="email" />`.
- On submit: `execute({ userId, personalEmail: inputValue })`.

**Dialog: Reset Password**
- Title: "Reset Password"
- Content: "A temporary password will be generated and sent to **[personalEmail]** (and [companyEmail] as a copy). The user will be required to change it on next sign-in." — show the actual `personalEmail` address.
- If `personalEmail` is null, the "Reset Password" menu item is disabled with a tooltip: "No personal email on file."
- On confirm: `execute({ userId })`.

**Success/error behaviour:**
- `onSuccess`: show a success toast; the server action calls `revalidatePath` so no manual `router.refresh()` is needed in the client.
- `onError`: show an error toast; the dialog stays open and form inputs retain their entered values (do not reset on error — the admin should be able to correct and resubmit).

**Patterns to follow:**
- `src/app/(authenticated)/(app)/(default)/admin/people/[id]/member-header-menu.tsx` — inline modal pattern
- `src/lib/departments.ts` — `DEPARTMENT_IDS`, `DEPARTMENT_NAMES` for the select options

**Test scenarios:**
- Happy path (dept head): dept head for "operations" sees "Change Department" only; "Change Personal Email" and "Reset Password" are absent.
- Happy path (admin): admin sees all three new items plus existing items in the specified order.
- Happy path (label): supporting alumni with no department shows "Assign Department" as item label and dialog title.
- Happy path (select preselect): Change Department dialog opens with the user's current department pre-selected; Submit is disabled until a different department is chosen.
- Happy path (reset dialog): Reset Password dialog shows the user's actual personal email address in the confirmation text.
- Edge case: `personalEmail` is null → Reset Password item is rendered but disabled with tooltip; submit cannot be triggered.
- Edge case: all 5 permission flags false → component returns null.
- Error path: server action returns error → toast shown, dialog stays open, form values preserved.
- Integration: after successful Change Department, page revalidates automatically and shows the new department without a manual refresh.

**Verification:**
- Admin sees all three actions in the correct order with destructive separator. Dept head sees Change Department only. Dialogs behave as specified on success, error, and null personalEmail. "Assign"/"Change" label is correct based on current state.

---

## System-Wide Impact

- **Interaction graph**: `cockpitUserUpdated` and `userSystemGroupsSync` Inngest handlers are triggered by U4's department change — no changes to those handlers, just a new caller. Inngest send failures are logged but do not fail the action; the daily cron reconciles.
- **Error propagation**: Server action errors propagate via `next-safe-action` to `useAction`'s `onError` callback and surface as toasts. Google Workspace errors in U6 throw before email is sent. Audit log is written before external calls in U5 and U6.
- **State lifecycle risks**: U4 uses optimistic concurrency — concurrent department changes result in a clear conflict error rather than silent overwrite.
- **Unchanged invariants**: `user.status`, `user.legalMembershipState`, and `user.email` (company address) are not touched by any of these actions.
- **Integration coverage**: Department change + Inngest event firing should be validated end-to-end in the Inngest dev server.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Password appears in step history | Not applicable — no Inngest steps used; password generated and consumed in one function scope |
| Google Workspace API unavailable | `DISABLE_GOOGLE_WORKSPACE` env var skips the API call; existing branching pattern in `new-user-workflow.ts` is the reference |
| Google Workspace API timeout | 20-second `AbortSignal` timeout; action throws before email is sent; audit log already written; admin can retry |
| Email fails after Workspace password update | Logged; admin can trigger a second reset — password is already rotated |
| Inngest enqueue failure after dept change | Wrapped in try/catch; logged at error level; daily cron reconciles within 24 hours |
| Concurrent department change (TOCTOU) | Optimistic concurrency: UPDATE WHERE department = oldDept; conflict error if 0 rows updated |
| Dept head loses undo ability after their own dept change | Warning shown in the Change Department dialog before confirm |
| Dept head notification email is null | Filtered before sendEmail; warning logged; action succeeds |
| No rate limiting on password reset | Accepted risk — admin-only action; audit log provides detection trail |

---

## Sources & References

- **Origin document:** [docs/brainstorms/admin-user-actions-requirements.md](docs/brainstorms/admin-user-actions-requirements.md)
- **Permission convention:** `docs/solutions/conventions/reusable-permission-policy-api-2026-05-02.md`
- **Member lifecycle invariants:** `docs/solutions/architecture-patterns/member-lifecycle-entry-points-and-application-flow-2026-05-10.md`
- Related code: `src/lib/permissions/evaluate.ts`, `src/inngest/new-user-workflow.ts`, `src/app/(authenticated)/(app)/(default)/admin/people/[id]/member-header-menu.tsx`
