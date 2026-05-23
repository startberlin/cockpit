---
date: 2026-05-23
topic: admin-member-detail-page-redesign
---

# Admin Member Detail Page Redesign

## Summary

Redesign the admin member detail page to match the new design: a richer header with inline member metadata and a permission-gated Impersonate button, a new summary strip, a renamed Membership card with a three-dot context menu for Propose and Remove actions, an upgraded Groups table with member counts and join dates (one schema migration required), a payment summary with total collected, and an inline read-only Roles & Permissions section. Mobile collapses to a single column with a centered avatar header and a 2×2 summary grid.

---

## Problem Frame

The current admin member detail page is a flat sequence of cards with no visual hierarchy. Profile, contact, groups, payments, and authority sit in an undifferentiated stack. Admin actions (Impersonate, Propose, Remove) appear as isolated buttons at the bottom, disconnected from the membership context in which they apply.

The groups section shows only a grid of group name links — no member counts, no indication of how the member was added, no join dates. The payment section shows a raw list of payment records with no summary. There is no quick-reference strip showing the most important membership facts at a glance.

The result is a page that is slow to scan and makes consequential actions feel contextless.

---

## Actors

- A1. **Admin viewer** — holds `users.impersonate`, `users.manage_authority`, `groups.view_all`, `user.payment.view`, `membership.cancel_member`, `user.membership.propose`. Sees all sections and all actions.
- A2. **Department viewer** — holds `user.view_details` and `user.membership.propose` scoped to their department. Sees Membership, Contact, optionally Groups; can Propose. Does not see payment, Impersonate, or manage permissions.
- A3. **Finance / legal viewer** — holds `user.payment.view` and `membership.cancel_member`. Sees payment section; can Remove. Does not see Impersonate or manage permissions.
- A4. **Target member** — the member whose detail page is being viewed.

---

## Requirements

**Header**

- R1. The header shows: profile avatar (Google OAuth image; initials fallback), full name, START email, and a row of inline metadata: Batch number, Department, membership status label ("Active member"), and legal membership status label ("Legal member").
- R2. When the viewer holds `users.impersonate`, an "Impersonate" action button is shown in the header. When the viewer lacks this permission, the button is hidden entirely (not greyed-out).
- R3. "Propose for membership" is not a header-level button on any viewport; it is only accessible via the Membership card's three-dot menu (R11).
- R4. When the viewer holds neither `users.impersonate` nor any permission that produces a three-dot menu option, the header renders with no action buttons.

**Summary strip**

- R5. A summary strip is rendered between the header and the first card, showing four values: Status, Member since, Batch, and Last sign-in.
- R6. On desktop (≥ tablet breakpoint), the summary strip renders as a single horizontal row of four items.
- R7. On mobile (< tablet breakpoint), the summary strip renders as a 2×2 grid.
- R8. When a value is unavailable (no batch assigned, never signed in), the strip shows "—" for that item.

**Membership card**

- R9. The card formerly labelled "Profile" is renamed to "Membership".
- R10. The Membership card shows a three-dot (⋯) button at the top right. The button is visible only when the viewer holds at least one permission that produces a visible menu option; it is hidden entirely when no options would appear.
- R11. The three-dot menu contains "Propose for membership" when the viewer holds `user.membership.propose` on the target member AND the member is eligible (profile onboarding complete, not already a legal member, and not in a live membership tenure).
- R12. The three-dot menu contains "Remove from START Berlin" when the viewer holds `membership.cancel_member` AND the target member's status is not already "cancelled".
- R13. Clicking "Propose for membership" navigates to the existing propose-membership sub-page. Clicking "Remove from START Berlin" navigates to the existing remove-member sub-page. No action fires inline from the menu.
- R14. The Membership card shows the following fields: Status (badge with tooltip), Batch number, Department (badge), Department lead (name + avatar, or "—" if none), Legal membership state (badge with tooltip), Member since date, Member-for duration (e.g., "2 years 3 months"), Onboarding status (badge), and Last sign-in (derived from the most recent session `updatedAt` for this user; "Never" if no session record exists).
- R15. The "Source" field is not shown. It is deferred pending schema support for invitation tracking.
- R16. The dedicated "Remove member" section previously rendered at the bottom of the page is removed; the action is now exclusively accessible via the three-dot menu (R12).

**Contact section**

- R17. The Contact section is unchanged: START email (copyable), personal email (copyable), phone (copyable), full address (copyable). Optional fields that are empty display "Not provided" in italic.

**Groups section**

- R18. The Groups section is shown only to viewers holding `groups.view_all`.
- R19. The Groups section renders as a table with four columns: Group name (linked to the group's page), Member count (total members in that group), Source ("Matching rule" or "Manual"), and Joined (the `joinedAt` timestamp for this member's membership in that group).
- R20. The section heading is accompanied by a summary line: "N memberships, X added by matching rules and Y manually." When all memberships share one source type, the summary reads "N memberships, all added by matching rules." or "N memberships, all added manually."
- R21. When a member has no group memberships, the section renders an empty state ("No group memberships.") rather than being hidden.
- R22. A `joinedAt` timestamp column is added to the `usersToGroups` table via a migration. Existing rows are backfilled with the target user's `createdAt` as a best-guess value. New memberships record `joinedAt` at the time of assignment.

**Payment section**

- R23. The Payment section is shown only to viewers holding `user.payment.view` on the target member.
- R24. The section heading is accompanied by a summary line: "€X collected over N years." (sum of paid/confirmed payments). When a next payment due date is available, the summary appends "Next collection [Month] [Year]."
- R25. The section renders a table with three columns: Date, Event (e.g., "Payment received"), and Amount.
- R26. Only payment records are included; GoCardless mandate lifecycle events (SEPA mandate confirmed, etc.) are not shown.
- R27. Empty states: when no GoCardless customer is configured, the section shows "No direct debit set up." When a customer exists but no payments have been made, the section shows "No payment history."

**Roles & permissions section**

- R28. The Roles & permissions section is shown only to viewers holding `users.manage_authority`.
- R29. The section displays the member's positions as a read-only list; each position shows the title and scope label (e.g., "President — Organization", "Head of Partnerships — Department"). If the member holds no positions, the list shows "No positions."
- R30. The section displays the member's app permission grants as a read-only list; each grant shows the permission name and resource scope label (e.g., "Super Admin — All resources"). If the member holds no grants, the list shows "No app permissions."
- R31. An "Edit permissions" button is shown adjacent to the section heading and navigates to the existing permissions sub-page.

**Mobile layout**

- R32. On mobile, all sections render in a single-column layout; no multi-column card arrangements are used.
- R33. On mobile, the header avatar is centered at the top, with name, email, metadata badges, and the Impersonate button centered beneath it.
- R34. Tables (Groups and Payment) use TanStack Table, which provides horizontal scroll on small viewports. No mobile-specific table layout is required beyond this.

---

## Acceptance Examples

- AE1. **Covers R10, R11, R12.** Given a viewer holding neither `user.membership.propose` nor `membership.cancel_member`, when they open any member's detail page, the three-dot button on the Membership card is not rendered.

- AE2. **Covers R11.** Given a viewer with `user.membership.propose` opening a member who is already a legal member, when the detail page loads, "Propose for membership" does not appear in the three-dot menu because the member is not eligible.

- AE3. **Covers R12.** Given a viewer with `membership.cancel_member` opening a member whose status is "cancelled", when the detail page loads, "Remove from START Berlin" does not appear in the three-dot menu.

- AE4. **Covers R2, R4.** Given a viewer without `users.impersonate` who also has no applicable three-dot menu options, when the detail page loads, the header renders with no action buttons.

- AE5. **Covers R8.** Given a member with no batch number who has never signed in, when the detail page loads, the summary strip shows "—" for both Batch and Last sign-in.

- AE6. **Covers R21.** Given a member who belongs to no groups, when a viewer with `groups.view_all` opens the detail page, the Groups section renders with "No group memberships." rather than being hidden entirely.

- AE7. **Covers R6, R7.** Given a member detail page viewed on a mobile viewport, the summary strip renders as a 2×2 grid; on a desktop viewport, the same four values render as a single horizontal row.

- AE8. **Covers R16, R13.** Given a viewer with `membership.cancel_member` clicking "Remove from START Berlin" in the three-dot menu, the browser navigates to the existing remove-member sub-page. No removal action fires from the menu itself.

---

## Success Criteria

- An admin can identify a member's key membership facts (status, batch, department, last sign-in, legal membership) without scrolling, from the header and summary strip alone.
- Consequential membership actions (Propose, Remove) are accessible in-context on the Membership card, clearly permission-gated, and absent when the viewer lacks the relevant permission or the member is ineligible.
- The Groups section communicates how a member joined each group and when, not just which groups they belong to.
- The detail page renders correctly on mobile in a single-column layout with no layout breakage.

---

## Scope Boundaries

- Source / invitation tracking ("Invited by S. Peters") — deferred; no schema support for invite tracking currently exists.
- Group source sub-type labels (Matching rule · dept / · batch / · position) — only "Matching rule" / "Manual" shown; sub-type inference from criteria condition JSON is deferred.
- SEPA mandate events and other GoCardless lifecycle events in the payment table — payment records only.
- Changes to the members listing page — covered by the prior admin member view requirements doc.
- Changes to the propose-membership or remove-member sub-page flows themselves.
- Mobile-specific table layouts — TanStack Table's horizontal scroll handles this without custom design work.

---

## Key Decisions

- **Three-dot menu on the Membership card, not standalone action cards at page bottom**: Groups Propose and Remove actions adjacent to the membership context where they apply. Impersonate stays in the header as an admin utility action distinct from membership management.
- **"Matching rule" / "Manual" source labels only**: Inferring sub-types (dept / batch / position) from criteria condition JSON adds implementation complexity for modest user value; deferred.
- **Payments only, no mandate events**: The payment table is scoped to financial transactions. Mandate lifecycle events are informational and add visual noise without aiding the primary payment audit use case.
- **joinedAt schema migration with createdAt backfill**: Group join dates are a confirmed user value. Approximate backfill dates are acceptable; precise historical backfill is not required.
- **TanStack Table for Groups and Payment tables**: Provides built-in horizontal scroll on mobile without custom layout work.

---

## Dependencies / Assumptions

- Last sign-in is derived from the most recent `session.updatedAt` for the target user; no new field is required on the user record.
- `joinedAt` backfill uses the target user's `createdAt`. Pre-existing rows will have approximate dates; this is accepted.
- The existing propose-membership and remove-member sub-pages are unchanged; the three-dot menu navigates to them as-is.
- `getGcPaymentHistoryForMember` and `getActivePaymentTerm` remain the data sources for the payment section; no new GoCardless API calls are introduced.
- All section and action visibility is gated via `can()` server-side and `<Can>` / `useCan()` client-side — no direct grant or position name checks in page or component code.

---

## Outstanding Questions

### Resolve Before Planning

- None.

### Deferred to Planning

- [Affects R19, R20][Technical] How member count per group is queried — single aggregated query with a subquery, or a per-row count join.
- [Affects R22][Needs research] Whether `joinedAt` should be nullable (for the backfill window) or non-nullable with a backfill default; implications for the migration rollback path.
- [Affects R14][Needs research] Whether Last sign-in is fetched inline alongside `getUserDetails` or via a separate query to the session table, and the performance impact on Membership card load time.
