---
date: 2026-05-23
topic: admin-member-view-revamp
---

# Admin Members View Revamp

## Summary

Revamp the members listing page and the member detail page so they're useful to a broader set of viewers — department heads, legal officers, and finance roles — not just admins. All visibility gates are expressed as named permissions checked through the existing `can()` / `<Can>` API; two new permissions are added to the evaluator.

---

## Problem Frame

The admin People directory and member detail page were designed for full admins. Two problems have surfaced as more roles gain access:

**Listing page**: Department viewers can access the directory but see all members unfiltered — there is no "my department" scoping. Viewers who manage all members (legal officers, finance) need to see alumni and cancelled members, but the default listing hides them. Better filters and sort options are missing for anyone managing a large list.

**Detail page**: The page has no visual hierarchy — profile, contact, groups, and authority cards sit in a flat 2×2 grid with no section structure. Payment data is absent. Onboarding status is absent. Admin actions (propose membership, remove member, impersonate) are standalone buttons with no context or explanation, and there is no guided flow for consequential or destructive actions.

The page is also missing data that department heads and legal officers need: when a member last logged in, whether their mandate is set up, what open tasks the member has.

---

## Actors

- A1. **Admin viewer** — holds permissions including `users.manage_authority`, `users.view_inactive`, `groups.view_all`, `user.payment.view`. Sees all sections.
- A2. **Legal board / finance viewer** — holds `membership.cancel_member` and/or `user.payment.view` and `users.view_inactive`. Does not hold `users.manage_authority` or `groups.view_all`.
- A3. **Department viewer** — holds `user.view_details` and `user.membership.propose` scoped to their department. Does not hold `users.view_inactive`, `user.payment.view`, or `groups.view_all`.
- A4. **Subject member** — the member whose listing row or detail page is being viewed.

---

## Key Flows

- F1. **Department-scoped listing**
  - **Trigger:** A department viewer (A3) opens the Members listing.
  - **Actors:** A3.
  - **Steps:** 1. Server evaluates whether the viewer's authority grants `user.view_details` on at least one user (computed from grants and positions only — no additional DB query; see R6). If not, redirect. 2. Listing query is filtered to only users the viewer has `user.view_details` permission on (their department). 3. Listing renders with active statuses only (onboarding, member, supporting_alumni). 4. "Alumni" and "Cancelled / Former" filter presets are not shown.
  - **Outcome:** Viewer sees only their department members. No additional configuration is needed.
  - **Covered by:** R5, R6, R7, R8.

- F2. **Propose membership sub-page flow**
  - **Trigger:** An authorized viewer clicks the "Propose for membership" action card on a member's detail page.
  - **Actors:** A1 or A2 (with `user.membership.propose`).
  - **Steps:** 1. Navigate to the propose-membership sub-page. 2. Page explains what proposing means and that board approval is required. 3. Viewer clicks the single confirm button. 4. Existing propose-membership action executes. 5. Redirect back to the member detail page.
  - **Outcome:** Board admission workflow is started; viewer returns to the detail page.
  - **Covered by:** R34, R35, R36, R37.

- F3. **Remove member two-step flow**
  - **Trigger:** An authorized viewer clicks the "Remove member" action card on a member's detail page.
  - **Actors:** A1 or A2 (with `membership.cancel_member`).
  - **Steps:** 1. Navigate to the remove-member sub-page. 2. Step 1 lists consequences (immediate account revocation, board notification) with a Continue button. 3. Viewer clicks Continue. 4. Step 2 shows two confirmation checkboxes; destructive confirm button is disabled until both are checked. 5. Viewer confirms. 6. Existing board-kick action executes. 7. Redirect to listing page.
  - **Outcome:** Member is removed; board is notified.
  - **Covered by:** R38, R39, R40, R41.

---

## Requirements

### Permission model — new actions

- R1. A new **`users.view_inactive`** global action is added to the evaluator. Viewers who hold this permission can access alumni and cancelled members via filter presets in the listing. Viewers without it see only members with status onboarding, member, or supporting_alumni.
- R2. A new **`user.payment.view`** user-scoped action is added to the evaluator. Viewers who hold this permission can see the payment section on a member's detail page.
- R3. Which grants and positions receive `users.view_inactive` and `user.payment.view` is determined in `evaluate.ts` during planning — not in page or component code.
- R4. All visibility gates in the listing and detail pages use `can()` server-side and `<Can>` / `useCan()` client-side. No page, action, or component checks grants, positions, or role names directly.

### Members listing page

- R5. The page heading is "Members" for all viewers.
- R6. `user.view_details` serves dual purpose. Called without scope, it gates the Members listing route and navigation entry: the evaluator checks grants and positions only (no additional DB query) and returns true for admins, people admins, and any department head. Called with `targetDepartment` scope, it filters which members appear in the listing and gates the detail page. `users.view_all` is removed; `user.view_details` replaces it. The existing evaluator already scopes department viewers to their own department — no additional dept-filter mechanism is needed.
- R7. Without `users.view_inactive`, viewers see only members with status onboarding, member, or supporting_alumni.
- R8. With `users.view_inactive`, viewers additionally see a "Cancelled / Former" filter preset and an "Alumni" preset. These presets are hidden for viewers without this permission.
- R9. Filter presets (exact set visible depends on R8): Active members (member + supporting_alumni), Onboarding, Alumni, Cancelled / Former.
- R10. Additional filter controls added: filter by legal membership state; sort by join date / duration alongside existing alphabetical sort.
- R11. The Name column is updated to include the member's avatar alongside their name.
- R12. A legal membership state column is added to the table, shown for all viewers. The value is displayed as a status badge; hovering the badge shows a tooltip that explains what the state means.
- R13. All other existing columns (Department, Batch, Status), filters (search, department, batch), and pagination are retained unchanged.

### Member detail page — structure and loading

- R14. The 2×2 card grid is replaced with full-width sections with clear headings, in order: member header → profile → contact → payment (gated) → onboarding → groups (gated) → admin actions (gated).
- R15. The loading skeleton in `loading.tsx` and any component-level skeletons are updated to reflect the new section layout.

### Member detail page — header

- R16. The header shows the member's profile picture (stored Google OAuth `image` field; avatar initial fallback if empty), full name, START email, and current status badge.

### Member detail page — profile section

- R17. Profile section shows: status, batch number, department, department head (name + avatar), member since date, member-for duration (e.g., "2 years 3 months"), legal membership state (badge with tooltip).
- R18. Member since uses `memberSinceDate` when set; falls back to account `createdAt` when null.
- R19. Contextual task notices appear inline adjacent to the relevant field. The notice logic mirrors the `deriveMembershipNotice` function used on the member-facing `/membership` page, but all copy is rephrased from the admin's perspective (e.g., "This member needs to set up their direct debit" rather than "Set up your direct debit"). Each notice is only shown if the viewer can also see the related section (see R23 for payment gating).

### Member detail page — contact section

- R20. Contact section shows: START email (copyable), personal email (copyable), phone (copyable), full address (copyable). Unchanged from the current contact card.

### Member detail page — payment section

- R21. Payment section is only rendered for viewers with `user.payment.view` permission on this member.
- R22. Payment section shows: mandate status (active / not set up / cancelled), last payment date and amount, a list of recent payments (up to 5 entries), next payment due date.
- R23. The payment-related contextual notices from R19 ("set up direct debit", "direct debit cancelled") are only shown when the viewer holds `user.payment.view`.

### Member detail page — onboarding section

- R24. Onboarding section is shown to all viewers who can open the detail page (gated by the existing `user.view_details` permission only).
- R25. Onboarding section shows: overall status (complete / not yet complete) and last active session timestamp, derived from the most recent session record's `updatedAt` for that user.

### Member detail page — groups section

- R26. Groups section is only rendered for viewers with the existing `groups.view_all` permission.

### Member detail page — authority

- R27. The inline authority card is removed from the detail page.
- R28. Viewers with the existing `users.manage_authority` permission see a "Manage permissions" CTA that navigates to `admin/people/directory/[id]/permissions`. Position assignments (authority) are managed on a separate existing authority page and are not part of this sub-page.
- R29. Viewers without `users.manage_authority` see no authority information and no CTA button.

### Member detail page — permissions sub-page

- R42. The permissions sub-page (`admin/people/directory/[id]/permissions`) is accessible only to viewers holding `users.manage_authority`; unauthorized access redirects to the member's detail page.
- R43. The permissions sub-page displays the member's current permission grants (from `globalAccessGrants`) and allows adding or removing them. Changes take effect immediately upon save.

### Member detail page — admin action cards

- R30. The existing standalone action buttons (impersonate, propose membership, remove member) are replaced by cards, each with a title and a short description explaining what the action does.
- R31. The admin actions section renders only if the viewer has at least one applicable action. No empty section is shown.
- R32. Each card is gated by its existing permission: impersonate by `users.impersonate`, propose membership by `user.membership.propose`, remove member by `membership.cancel_member`.
- R33. The impersonate card triggers an immediate confirmation dialog (no sub-page). No change to the underlying impersonate action.

### Propose membership sub-page

- R34. Clicking the "Propose for membership" card navigates to a dedicated sub-page under the member's detail route.
- R34a. The propose-membership sub-page checks `user.membership.propose` on the target user server-side; unauthorized access redirects to the member's detail page.
- R35. The sub-page explains what proposing for membership means and states that board approval is required before the proposal takes effect.
- R36. The sub-page has a single confirm button and a back link. No form input is required from the viewer.
- R37. On confirm, the existing propose-membership action executes, the viewer is redirected back to the member detail page, and the existing propose-membership confirmation dialog is removed from the codebase.

### Remove member sub-page

- R38. Clicking the "Remove member" card navigates to a dedicated sub-page under the member's detail route.
- R38a. The remove-member sub-page checks `membership.cancel_member` server-side; unauthorized access redirects to the member's detail page.
- R39. Step 1 of the sub-page lists the consequences of removal (immediate account access revocation, board notification) with a Continue button and a back link.
- R40. Step 2 requires the viewer to check two confirmation checkboxes before the destructive confirm button is enabled.
- R41. On confirm, the existing board-kick action executes, the viewer is redirected to the members listing page, and the existing board-kick confirmation dialog is removed from the codebase.

---

## Acceptance Examples

- AE1. **Covers R6, R7, R8.** Given a department viewer (dept head of Engineering), when they open the Members listing, only Engineering members with status onboarding/member/supporting_alumni appear. No other department's members are shown. No "Alumni" or "Cancelled / Former" presets are visible.

- AE2. **Covers R8, R9.** Given a viewer with `users.view_inactive`, when the Members listing is open with no preset active, only active-status members appear. When they click the "Cancelled / Former" preset, the list updates to show only cancelled/former members. When they click the "Alumni" preset, the list updates to show only alumni members.

- AE3. **Covers R21, R23.** Given a department viewer opening a member's detail page, the payment section is absent and no payment-related contextual notice appears anywhere on the page.

- AE4. **Covers R19, R21, R23.** Given a viewer with `user.payment.view` opening a member whose mandate is not set up, the profile section shows a "This member needs to set up their direct debit" notice adjacent to the relevant field, and the payment section shows mandate status as "Not set up".

- AE5. **Covers R31, R32.** Given a department viewer (who holds `user.membership.propose` but not `users.impersonate` or `membership.cancel_member`), when they open a member detail page, only the "Propose for membership" action card is shown.

- AE6. **Covers R39, R40.** Given a viewer with `membership.cancel_member` on Step 2 of the remove-member sub-page, when neither confirmation checkbox is checked, the destructive confirm button is disabled.

- AE7. **Covers R28, R29.** Given a viewer without `users.manage_authority` on a member detail page, no authority CTA button is shown and no authority information appears anywhere on the page.

---

## Success Criteria

- A department viewer opening the Members listing sees only their department's members with no configuration required.
- A viewer with `user.payment.view` can see mandate status and recent payment history for any member they can view, without navigating to the separate payments admin page.
- An admin performing the "remove member" action completes a two-step flow that makes consequences explicit before the destructive action fires.
- No page or component directly checks grants, positions, or role names — all gates go through `can()` / `<Can>` / `useCan()`.
- Adding a grant to `users.view_inactive` or `user.payment.view` in `evaluate.ts` automatically extends access to the relevant UI without touching page or component code.

---

## Scope Boundaries

- Business logic changes to the propose-membership or board-kick workflows — only the UI entry flow changes (dialog replaced by sub-page).
- GoCardless integration changes beyond what `getGcPaymentHistoryForMember` and `getActivePaymentTerm` already provide.
- Adding new grant types or position types to the authority model — permission assignments are a planning decision.
- Mobile-specific design optimizations.
- Bulk actions from the listing page.

---

## Key Decisions

- **Permission-first visibility**: Every section gate references a named action in `evaluate.ts`. Role names and position names do not appear in page or component code.
- **Two new actions, not role changes**: `users.view_inactive` and `user.payment.view` are new named actions. Which grants and positions receive them is a planning decision.
- **`user.view_details` replaces `users.view_all`, serves dual purpose**: Called without scope it gates the listing route (authority-only, no DB query); called with `targetDepartment` scope it filters listing rows and gates detail pages. Department viewers are naturally scoped to their department by the evaluator; no separate dept-filter mechanism is needed.
- **Sub-pages over dialogs for consequential actions**: Propose and remove get dedicated sub-pages because the actions are consequential and the dialog pattern doesn't allow enough explanatory content. Impersonate retains a dialog because it is immediate and reversible by design.
- **Contextual notices inline, not as a top banner**: Notices are placed adjacent to the relevant data point and inherit its visibility gate. A payment-related notice only appears if the viewer can see the payment section.
- **Active statuses are onboarding + member + supporting_alumni**: These three are always visible to any viewer who can access the listing. Alumni and cancelled are inactive and require `users.view_inactive`.

---

## Dependencies / Assumptions

- The permission-registry-and-granular-roles work (`2026-05-20-permission-registry-and-granular-roles-requirements.md`) may land before or alongside this. If `targetStatus` is added to user-scoped `can()` calls (R30 of that doc), `user.payment.view` call sites must include `targetStatus`.
- `getGcPaymentHistoryForMember` and `getActivePaymentTerm` are the data sources for the payment section; no new GoCardless API integration is needed beyond what these functions already provide.
- Last active session timestamp is derived from `updatedAt` of the most recent `session` record for the target user.
- `memberSinceDate` is nullable; `createdAt` is the fallback for "member since" and "member for" calculations.

---

## Outstanding Questions

### Resolve Before Planning

- None.

### Deferred to Planning

- [Affects R1, R2, R3][Technical] Which existing grants and positions receive `users.view_inactive` and `user.payment.view` in `evaluate.ts`.
- [Affects R6][Needs research] Whether the listing query filters by department via an explicit WHERE clause using the viewer's authority or by cross-referencing member IDs the viewer has `user.view_details` on — performance implications differ for large lists.
- [Affects R22][Needs research] Whether mandate status is fetched live from GoCardless (an additional API call per detail page load) or inferred from the presence of `gocardlessMandateId` on the user record.
