---
date: 2026-05-21
topic: email-system-revamp
---

# Email System Revamp

## Summary

Upgrade the email system to eliminate per-file boilerplate via a shared `EmailShell` component and standardised sub-components, revamp the visual design across all emails to match the brand template (dark header, proper footer, muted body text, 600 px container), improve copy on all existing emails per the tone-of-voice convention, and add two new emails for the mandate-cancelled and upcoming-payment events.

---

## Problem Frame

The 12 existing emails share no structural component. Every file repeats the same ~20-line boilerplate: Font declarations, `Html`, `Head`, `Body`, `Tailwind` wrapper, and a `Container`. The design is inconsistent — some emails use an out-of-place blue info block (`#F0F9FF` / `#0EA5E9`), none carry a footer, headings are uppercase instead of sentence-case, the container is narrower than the industry-standard 600 px, and no email uses the dark brand header that other START Berlin materials use.

Copy improvements from the app-wide tone-of-voice work have not been applied consistently to emails. Several still lead with technical setup language rather than member-outcome language (e.g. "Your first membership fee will be collected as soon as GoCardless confirms the setup").

The react-email packages produce npm install warnings, signalling outdated API usage. The `email:dev` preview server exists in `package.json` but is not part of any regular development workflow, and some emails have thin or missing `PreviewProps`.

Two member-facing events have no email at all: a cancelled payment mandate (which requires the member to re-setup) and an upcoming scheduled payment (reassurance that a collection is expected).

---

## Actors

- A1. **Member** — receives lifecycle emails covering account setup, application, admission, payment, and position changes.
- A2. **Board member / admin** — receives operational emails covering vote requests and admission completion.

---

## Requirements

**Technical foundation**

- R1. Upgrade `@react-email/components` and `react-email` to current stable versions, eliminating npm install warnings. No breaking changes may be introduced to existing email rendering.

- R2. Create an `EmailShell` component in `src/emails/` that encapsulates the repeated boilerplate: Font declarations, `Html`, `Head`, `Body`, Tailwind config, outer background, dark brand header with white logo, and footer. Every existing and new email must use `EmailShell` and remove its own boilerplate.

- R3. `EmailShell` accepts:
  - `preview` — forwarded to the `<Preview>` component
  - `eyebrow` — optional short uppercase label displayed below the logo in the dark header (e.g. `"Membership payment"`, `"Board resolution"`)
  - `footerAudience` — `"member"` (default) or `"board"`, controls the "why am I receiving this" sentence in the footer

- R4. Every email must export a `PreviewProps` object with realistic data that covers the email's most informative render state (for conditional emails, the state with the most content visible).

**Design system sub-components**

- R5. Create an `EmailStatusBadge` component rendering a pill badge accepting `label` and `variant` (`"active"` | `"info"` | `"warning"`). Used in confirmation-type emails.

- R6. Create an `EmailDetailBlock` component rendering a bordered block for label/value pairs (sign-in credentials, payment details, membership IDs). Replaces the current ad-hoc blue info boxes.

- R7. Create an `EmailCta` component rendering a primary CTA button and a plain-text fallback link below it, accepting `href` and `label`.

- R8. The visual design of all emails must follow the brand template:
  - **Outer background**: `#F5F5F4`
  - **Container**: white, `max-w-[600px]`, no outer border (up from the current `465px`)
  - **Header**: dark background (`#0A0F2C`), white logo (`logo-white.png`), optional eyebrow text (uppercase, small, muted white at ~70 % opacity)
  - **Heading**: sentence-case, dark foreground (`#1C1917`), 24 px, weight 700
  - **Body copy**: muted foreground (`#78716C`), 15 px, line-height 1.65; strong/highlighted values use `#1C1917`
  - **CTA button**: dark background (`#1C1917`), white text, no border-radius
  - **Footer**: top border separator, "why am I receiving this" line, then legal entity block (association name, address, registration, Vorstand, contact email)

- R9. The footer "Open START Cockpit" link must point to `NEXT_PUBLIC_COCKPIT_URL`. A "Manage email preferences" link is omitted until a preferences system exists.

**Existing email revamp**

- R10. All 12 existing emails must be updated to use `EmailShell`, adopt the design language from R8, and apply copy guidelines from `docs/solutions/conventions/reusable-tone-of-voice-and-wording-decisions-2026-05-02.md`. The table below specifies heading, eyebrow, and copy direction for each email.

| File | Subject line | Eyebrow | Heading | Copy direction |
|---|---|---|---|---|
| `signin-instructions` | "Your START Berlin sign-in details" | "Your START Berlin account" | "Sign in to your START Berlin account" | Credentials in `EmailDetailBlock`; note new-password prompt on first login; link to Gmail |
| `start-cockpit-enabled` | "Your START Cockpit access is ready" | Status-contextual (e.g. "Welcome, member") | "Your START Cockpit access is ready" | Brief personalised note per user status; sign-in URL in `EmailDetailBlock` |
| `membership-application-submitted` | "We've received your membership application" | "Membership application" | "Application received" | What happens next: board reviews, you'll hear back; copy is attached for records |
| `membership-application-ready` | "Complete your START Berlin membership application" | "Membership application" | "Complete your membership application" | Board approved your admission; fill in details and sign in START Cockpit; `EmailCta` |
| `membership-admission-confirmed` (payment CTA path) | "Finalize your START Berlin membership" | "Welcome to START Berlin" | "Set up your yearly membership payment" | Membership confirmed; 40 EUR/year; what it funds; `EmailCta` to payment setup |
| `membership-admission-confirmed` (active path) | "Your START Berlin membership is active" | "Welcome to START Berlin" | "Your membership is active" | `EmailStatusBadge` variant `"active"`, label "Active member"; thanks for being part of START Berlin |
| `membership-payment-ready` | "Finalize your START Berlin membership" | "Membership payment" | "Set up your yearly membership payment" | 40 EUR/year; what it covers; `EmailCta` to `/membership` |
| `board-resolution-task-assigned` | "Action required: vote on [name]'s membership" | "Board resolution" | "Membership vote required" | [Name] applied; your vote is needed; `EmailCta` to resolution; `footerAudience: "board"` |
| `membership-admission-completed-board` | "[Name] is now a member of START Berlin" | "Admission complete" | "[Name] is now a member" | All documents archived; `EmailDetailBlock` with membership ID and date; `footerAudience: "board"` |
| `position-assigned` | "You've been assigned as [position] at START Berlin" | "Position update" | "You've been assigned as [position]" | Brief context on the role; contact ops if unexpected |
| `position-removed` | "Your role as [position] has ended" | "Position update" | "Your role as [position] has ended" | Access for [position] has been updated; contact ops with questions |

- R11. `membership-admission-confirmed` retains its single-component conditional structure (one component, props-driven). The heading, badge, and CTA differ per path as specified in R10 — no split into two separate files.

**New emails**

- R12. Add `mandate-cancelled.tsx` — sent when a member's payment mandate is cancelled.
  - Subject: "Action required: set up your membership payment again"
  - Eyebrow: "Membership payment"
  - Heading: "Set up your membership payment again"
  - Preview: "Your yearly membership payment was cancelled. Set it up again to keep your membership active."
  - Body: the payment setup was cancelled; membership will lapse without a new setup; tone is calm and helpful, not alarming
  - `EmailCta`: "Set up payment" → `/membership`
  - Must not name GoCardless or use direct-debit terminology visible to the member

- R13. Add `membership-payment-upcoming.tsx` — sent when a payment is scheduled, giving the member advance notice.
  - Subject: "Your START Berlin membership payment is coming up"
  - Eyebrow: "Membership payment"
  - Heading: "Your membership payment is coming up"
  - Preview: "40 EUR will be collected on [date]. No action needed."
  - Body: reassurance-first — payment is scheduled automatically, nothing to do
  - `EmailDetailBlock`: amount (40 EUR), scheduled date
  - No CTA (informational)
  - Must not name GoCardless; use "collected automatically" / "yearly membership payment" language

**Preview server**

- R14. After the upgrade, `npm run email:dev` must show all 14 emails (12 existing + 2 new) without runtime errors, with each displaying a realistic preview from its `PreviewProps`.

---

## Acceptance Examples

- AE1. **Covers R11, R10.** Given `includesPaymentCta: true` on `membership-admission-confirmed`, the email renders with heading "Set up your yearly membership payment" and an `EmailCta`; no status badge is shown.

- AE2. **Covers R11, R10.** Given `includesPaymentCta: false` on `membership-admission-confirmed`, the email renders with heading "Your membership is active" and an `EmailStatusBadge` with variant `"active"` and label "Active member"; no CTA button is shown.

- AE3. **Covers R3, R9.** Given `footerAudience: "board"`, the footer reads "You're receiving this because you're a board member of START Berlin." Given the default `"member"`, it reads "You're receiving this because you're a member of START Berlin."

- AE4. **Covers R12.** Given a cancelled mandate event, the `mandate-cancelled` email renders with a "Set up payment" CTA linking to `/membership` and body copy that names no payment provider or technical system.

---

## Success Criteria

- Running `npm run email:dev` shows all 14 emails rendered correctly with no errors and no npm install warnings on `npm install`.
- An email sent to a real client has the dark brand header, consistent footer with legal entity info, and muted body text — visually consistent across all templates.
- Members and board recipients receive emails that describe what happened and what to do next, without exposure to internal system names (GoCardless, Inngest, mandate IDs).

---

## Scope Boundaries

- Email preferences management ("Manage email preferences" footer link) is excluded — no preferences system exists.
- Profile-updated-by-admin notification emails are deferred to a later pass.
- Batch / alumni transition emails are deferred.
- German-language email variants are out of scope.
- Resend configuration, Inngest trigger wiring, and event payload mapping are planning concerns, not requirements.

---

## Key Decisions

- **Single `EmailShell`, not per-variant shells**: the three template patterns (notification / one-action / confirmation-with-detail) differ only in which sub-components appear in the body. The shell is the invariant wrapper; variants are composed from `EmailStatusBadge`, `EmailCta`, and `EmailDetailBlock` inside it.
- **No GoCardless naming in member-facing emails**: mandate-cancelled and payment-upcoming describe events in member-outcome language only. This applies to all future payment-related emails.
- **Container width 600 px** (up from current 465 px): matches the brand template and the HTML email industry standard.

---

## Dependencies / Assumptions

- `public/logo-white.png` exists and is reachable at `NEXT_PUBLIC_COCKPIT_URL/logo-white.png` (confirmed in repo).
- The footer legal entity block (address, registration number, Vorstand names) needs confirmed values — planning should locate these in the repo or confirm with the user before hardcoding.
- The mandate-cancelled and payment-upcoming email triggers will be wired in Inngest; the exact event names and data shape are a planning decision.

---

## Outstanding Questions

### Resolve Before Planning

*(none)*

### Deferred to Planning

- [Affects R12, R13][Technical] Which GoCardless webhook events and Inngest functions trigger the two new emails? Identify in `src/inngest/gocardless-events-cleanup.ts` and related files.
- [Affects R13][Technical] What data is available at payment-creation time to populate the `EmailDetailBlock` scheduled date and amount? Confirm from GoCardless event payload shape.
- [Affects R8][Technical] Does the Tailwind 4 config in this repo expose design tokens for `#0A0F2C`, `#78716C`, and `#1C1917` as named utilities, or should `EmailShell` use hardcoded arbitrary values? Check `tailwind.config.*` and CSS variables.
- [Affects R1, R2][Technical] Confirm exact target versions for `@react-email/components` and `react-email`; check changelog for breaking API changes that affect existing email component usage.
