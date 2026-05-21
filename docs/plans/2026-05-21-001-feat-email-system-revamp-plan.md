---
title: "feat: Email system revamp — shared shell, design overhaul, 2 new emails"
type: feat
status: active
date: 2026-05-21
origin: docs/brainstorms/2026-05-21-email-system-revamp-requirements.md
---

# feat: Email system revamp — shared shell, design overhaul, 2 new emails

## Summary

Five sequenced units: migrate email imports from the deprecated `@react-email/components` to the consolidated `react-email` v6 package; build a shared `EmailShell` wrapper and three reusable sub-components in `src/emails/components/`; revamp all 12 existing templates with the new shell, brand design, and tone-of-voice copy; and add two new email files — `mandate-cancelled` and `membership-payment-upcoming` — wired into the existing GoCardless event handler at `src/db/gocardless-events.ts`.

---

## Problem Frame

See origin document for full context. In brief: 12 email files each duplicate ~20 lines of boilerplate, no email carries the dark brand header or a legal footer, copy is inconsistent with the tone-of-voice convention, and two triggered member events (mandate invalidated, payment submitted) have no email at all.

---

## Requirements

- R1. Upgrade to React Email v6 consolidated package — no npm install warnings
- R2. `EmailShell` eliminates per-file boilerplate across all emails
- R3. `EmailShell` accepts `preview`, `eyebrow`, `footerAudience`
- R4. All emails export realistic `PreviewProps`
- R5. `EmailStatusBadge` sub-component (active / info / warning variants)
- R6. `EmailDetailBlock` sub-component (label/value pairs, bordered)
- R7. `EmailCta` sub-component (button + fallback link)
- R8. Brand design: dark header `#0A0F2C`, body text `#78716C`, emphasis `#1C1917`, 600px container
- R9. Footer links to `NEXT_PUBLIC_COCKPIT_URL`; no email preferences link
- R10. All 12 existing emails revamped per the requirements table (headings, eyebrows, copy)
- R11. `membership-admission-confirmed` retains single-component conditional structure
- R12. `mandate-cancelled.tsx` — re-setup prompt, no GoCardless naming
- R13. `membership-payment-upcoming.tsx` — reassurance email, no GoCardless naming
- R14. `npm run email:dev` shows all 14 emails without errors

**Origin actors:** A1 (Member), A2 (Board member / admin)
**Origin acceptance examples:** AE1 (R11, R10 — admission-confirmed CTA path), AE2 (R11, R10 — active path), AE3 (R3, R9 — footerAudience board), AE4 (R12 — mandate-cancelled copy)

---

## Scope Boundaries

- Profile-updated-by-admin and batch/alumni transition emails: deferred (no trigger source)
- Email preferences management: excluded — no preferences system exists
- Mandate-cancelled email for `replaced`, `consumed`, `blocked` mandate actions: excluded — `replaced` means a new mandate is already incoming via `billing_requests:fulfilled`; `consumed` and `blocked` have different user contexts requiring separate decisions
- Payment charge date in the upcoming email: excluded — no `charge_date` stored in `membershipPayments`; a GoCardless API lookup would introduce a new dependency
- Vorstand names in footer: excluded — not present in codebase; footer uses address + registration from `brand.ts` only

---

## Context & Research

### Relevant Code and Patterns

- All 12 email templates: `src/emails/*.tsx` — identical `@react-email/components` boilerplate, `pixelBasedPreset`, 465px container, `logo-black.png`
- Email send helper: `src/lib/email.ts` — uses `@react-email/render` (now part of `react-email`) + AWS SES; includes suppression check and `DISABLE_EMAIL` guard; established `from`: `"START Berlin <notifications@cockpit.start-berlin.com>"`
- GoCardless event handler: `src/db/gocardless-events.ts` — `recordAndProcessGoCardlessEvent`, `isMandateInvalidatedEvent`, `handlePaymentEvent`
- Webhook type helpers: `src/lib/gocardless/webhook.ts` — `isMandateInvalidatedEvent` covers 6 actions; `isPaymentLifecycleEvent` covers submitted/confirmed/paid_out/failed/cancelled/charged_back
- Legal entity constants: `src/lib/legal-documents/templates/brand.ts` — `"Luisenstraße 53 · c/o HU-Gründerhaus · 10117 Berlin"`, `"Vereinsregister VR 32262 B · Amtsgericht Charlottenburg, Berlin"`, `"START Berlin e.V."`
- `public/logo-white.png` confirmed present; `public/logo-black.png` used by all current templates
- `src/db/schema/membership-payments.ts` — has `userId` and `amount` (integer in cents, default `4000`)
- Existing email render tests: `src/emails/membership-admission-confirmed.test.tsx`, `src/emails/start-cockpit-enabled.test.tsx`
- Status label lookup: `src/lib/user-status.ts` → `USER_STATUS_INFO` used in `start-cockpit-enabled.tsx` for status-contextual text

### Institutional Learnings

- `docs/solutions/conventions/reusable-tone-of-voice-and-wording-decisions-2026-05-02.md`: never surface GoCardless, mandate IDs, or internal statuses; describe outcomes and practical meaning; active member emails reassure without over-explaining
- `docs/solutions/architecture-patterns/membership-journey-vs-payment-journey-2026-05-12.md`: GoCardless events are payment-administrative triggers only; do not imply membership status changes from payment events; email sends for payment events belong in the event handler, not in Inngest admission workflows
- `docs/solutions/architecture-patterns/member-lifecycle-entry-points-and-application-flow-2026-05-10.md`: imported members skip the Inngest admission workflow; the new emails added here (triggered from the webhook handler) reach all members regardless of onboarding path

### External References

- React Email v6: `react-email` package exports all components + `render`; `@react-email/components` is deprecated; `pixelBasedPreset` still exported from `react-email`; Tailwind custom tokens via `theme.extend.colors` in the `<Tailwind>` config prop
- `@react-email/ui` replaces `@react-email/preview-server` for the dev server

---

## Key Technical Decisions

- **Email design tokens defined in `EmailShell`'s Tailwind config**: the app's CSS variables use oklch, which is incompatible with email clients; email-specific hex tokens (`#0A0F2C`, `#1C1917`, `#78716C`, `#F5F5F4`, `#E7E5E4`) are defined in `EmailShell`'s `<Tailwind theme.extend.colors>` and used via Tailwind utility classes throughout all templates
- **`src/emails/components/` subdirectory keeps sub-components out of the preview server**: react-email renders default-exported components from `--dir src/emails`; shell and sub-components use only named exports so they don't appear as standalone templates
- **Mandate-cancelled fires only for `cancelled`, `expired`, `failed`**: `isMandateInvalidatedEvent` covers 6 actions; only these three require the member to set up payment again; `replaced` means a new mandate is already incoming; `consumed` and `blocked` require different handling
- **User lookup runs before the mandate UPDATE (U4)**: to obtain email + firstName for the email send, the user must be queried while `gocardlessMandateId` still matches the event's mandate ID; after the UPDATE that field is cleared
- **Payment-upcoming fires on `payment:submitted`**: earliest point in the GoCardless payment lifecycle, giving maximum advance notice; gated on `advancePaymentStatus` succeeding so duplicate events don't produce duplicate emails
- **Charge date omitted from payment-upcoming email**: `membershipPayments` has no `charge_date` column; amount in EUR derived from `amount` in cents (`/ 100`)

---

## Open Questions

### Resolved During Planning

- **Package target versions?** `react-email` v6 (already at 6.1.4 in devDeps); remove `@react-email/components` and `@react-email/render` from deps; replace `@react-email/preview-server` with `@react-email/ui` in devDeps
- **Email design tokens in CSS variables?** No — app uses oklch; email tokens live in `EmailShell`'s Tailwind config
- **Legal entity details for footer?** Name, address, registration confirmed in `src/lib/legal-documents/templates/brand.ts`; Vorstand names omitted
- **Which mandate actions trigger the re-setup email?** `cancelled`, `expired`, `failed` only
- **`from` address for new emails?** `"START Berlin <notifications@cockpit.start-berlin.com>"` — matches all existing `sendEmail` calls in Inngest workflows

### Deferred to Implementation

- **Error handling for email send in event handler**: the webhook handler does not retry on failure; wrap U4 and U5 `sendEmail` calls in try/catch so an email failure does not block the mandate/payment state update that has already succeeded
- **`start-cockpit-enabled` eyebrow wording per status**: derive from `USER_STATUS_INFO` labels or define short overrides per status context; implementer should ensure each status maps to a meaningful short string

---

## Implementation Units

### U1. Package upgrade and import migration

**Goal:** Replace `@react-email/components` (1.0.12) and `@react-email/render` (2.0.8) with the consolidated `react-email` v6 package; replace `@react-email/preview-server` with `@react-email/ui` in devDeps; update all import paths.

**Requirements:** R1, R14

**Dependencies:** None

**Files:**
- Modify: `package.json`
- Modify: `src/lib/email.ts`
- Modify: `src/emails/board-resolution-task-assigned.tsx`
- Modify: `src/emails/membership-admission-completed-board.tsx`
- Modify: `src/emails/membership-admission-confirmed.tsx`
- Modify: `src/emails/membership-application-ready.tsx`
- Modify: `src/emails/membership-application-submitted.tsx`
- Modify: `src/emails/membership-payment-ready.tsx`
- Modify: `src/emails/position-assigned.tsx`
- Modify: `src/emails/position-removed.tsx`
- Modify: `src/emails/signin-instructions.tsx`
- Modify: `src/emails/start-cockpit-enabled.tsx`

**Approach:**
- In `package.json`: remove `@react-email/components` from `dependencies`; remove `@react-email/render` from `dependencies`; remove `@react-email/preview-server` from `devDependencies`; add `@react-email/ui` to `devDependencies`; promote `react-email` from `devDependencies` to `dependencies` (it is now the runtime render package used by `src/lib/email.ts`)
- In `src/lib/email.ts`: change `import { render } from "@react-email/render"` to `import { render } from "react-email"`
- In all 12 email files: change `import { ... } from "@react-email/components"` to `import { ... } from "react-email"`; the destructured component names are identical — only the package specifier changes; `pixelBasedPreset` is still exported from `react-email`

**Patterns to follow:**
- v6 import pattern: `import { Button, Html, Head, Body, pixelBasedPreset } from "react-email"`

**Test scenarios:**
- Happy path: `npm install` completes with no deprecation or peer-dep warnings related to `@react-email/*`
- Happy path: `npm run email:dev` starts and renders at least one existing template without import errors
- Happy path: `npm run build` passes with no TypeScript errors introduced by the import changes

**Verification:**
- No `@react-email/components` or `@react-email/render` entries remain in `package.json`
- `npm run email:dev` shows all existing emails without errors before U2 begins

---

### U2. EmailShell and shared sub-components

**Goal:** Create the `src/emails/components/` module with `EmailShell`, `EmailStatusBadge`, `EmailDetailBlock`, and `EmailCta` — the foundation all revamped templates build on.

**Requirements:** R2, R3, R5, R6, R7, R8, R9

**Dependencies:** U1

**Files:**
- Create: `src/emails/components/email-shell.tsx`
- Create: `src/emails/components/email-status-badge.tsx`
- Create: `src/emails/components/email-detail-block.tsx`
- Create: `src/emails/components/email-cta.tsx`

**Approach:**

`EmailShell` renders:
- `Html → Head`: two `Font` declarations for Avenir Next bold + medium loaded from `${env.NEXT_PUBLIC_COCKPIT_URL}/avenirnext-{bold,medium}.otf` (exactly as in current templates)
- `Tailwind` with `pixelBasedPreset` and `theme.extend.colors` defining the email-specific hex tokens (brand dark, body fg, muted, border, outer bg); tokens are used via Tailwind arbitrary-value classes or the named utilities within the templates
- `Body`: outer background (`#F5F5F4`)
- `Preview` forwarding the `preview` prop — placed before the visible container
- White container (`max-w-[600px]`, no border)
- Dark header section (`#0A0F2C`): `logo-white.png` at appropriate display size; below the logo, optional `eyebrow` text in uppercase small muted-white
- `{children}` slot for email body content
- Footer section: top border separator; "You're receiving this because you're a [member / board member] of START Berlin." (controlled by `footerAudience`); legal entity block (name, address, registration from `brand.ts`); "Open START Cockpit" link to `env.NEXT_PUBLIC_COCKPIT_URL`

`EmailStatusBadge` props: `label` (string), `variant` ("active" | "info" | "warning")
- `active`: green pill — background `#ECFDF5`, border + text `#047857`
- `info`: neutral tones
- `warning`: amber tones

`EmailDetailBlock` props: `rows: Array<{ label: string; value: string }>`
- Bordered block (`#E7E5E4` border); each row shows label in muted text (`#78716C`) and value in emphasis text (`#1C1917`)

`EmailCta` props: `href` (string), `label` (string)
- `Button` component: background `#1C1917`, white text, padding matching current templates, no border-radius
- Below: small `Text` with plain `Link` fallback ("If the button does not work, open this link:")

**Patterns to follow:**
- Font declaration: match the exact `webFont` structure from current templates (`url`, `format: "opentype"`, `fontWeight`, `fontStyle`)
- CTA fallback: match current `text-[12px] text-[#57534E] leading-[18px]` pattern from existing templates

**Test scenarios:**
- Covers AE3. `EmailShell` rendered with `footerAudience: "board"` produces HTML containing "board member of START Berlin"; rendered with default produces "member of START Berlin"
- Happy path: `EmailShell` renders with `preview`, `eyebrow`, and a `Text` child — produces valid HTML via `render()`
- Edge case: `EmailShell` renders with no `eyebrow` prop — header contains only the logo, no eyebrow element
- Happy path: `EmailStatusBadge` renders with each variant without errors; `active` variant contains the text of `label`
- Happy path: `EmailDetailBlock` with two rows renders both labels and values in output HTML
- Happy path: `EmailCta` rendered HTML contains the `href` in both the button and the fallback link

**Verification:**
- Each component can be imported and rendered with `render()` without throwing
- Sub-components have no default exports (they do not appear in `npm run email:dev` as standalone templates)

---

### U3. Revamp all 12 existing email templates

**Goal:** Update every existing email in `src/emails/` to use `EmailShell` and the new sub-components, adopt the brand design, and apply the copy and heading/eyebrow specs from the R10 requirements table.

**Requirements:** R2, R3, R4, R8, R9, R10, R11, R14

**Dependencies:** U2

**Files:**
- Modify: `src/emails/signin-instructions.tsx`
- Modify: `src/emails/start-cockpit-enabled.tsx`
- Modify: `src/emails/membership-application-submitted.tsx`
- Modify: `src/emails/membership-application-ready.tsx`
- Modify: `src/emails/membership-admission-confirmed.tsx`
- Modify: `src/emails/membership-payment-ready.tsx`
- Modify: `src/emails/board-resolution-task-assigned.tsx`
- Modify: `src/emails/membership-admission-completed-board.tsx`
- Modify: `src/emails/position-assigned.tsx`
- Modify: `src/emails/position-removed.tsx`
- Test: `src/emails/membership-admission-confirmed.test.tsx`
- Test: `src/emails/start-cockpit-enabled.test.tsx`

**Approach:**

Every template follows the same migration pattern:
1. Remove all boilerplate (`Font`, `Html`, `Head`, `Body`, `Tailwind`, outer `Container`, `Img` logo section)
2. Wrap content in `<EmailShell preview="..." eyebrow="..." footerAudience="...">`
3. Replace the blue info boxes (`bg-[#F0F9FF] border-[#0EA5E9]`) with `<EmailDetailBlock>`
4. Replace manual `Button` + fallback link with `<EmailCta>`
5. Remove the ops contact paragraph — now covered by the shell footer
6. Apply the heading text, eyebrow, and copy direction from the requirements table
7. Update `PreviewProps` to realistic data showing the most informative state

Notable per-email specifics beyond the universal pattern:

- `signin-instructions`: credentials (`Email`, `Password`, `Sign in at`) in `EmailDetailBlock`; remove blue box
- `start-cockpit-enabled`: derive `eyebrow` from `statusContext` using `USER_STATUS_INFO` labels (or a short override mapping); sign-in URL in `EmailDetailBlock`; `PreviewProps` shows a status that produces visible eyebrow text
- `membership-admission-confirmed` (R11 — conditional structure retained): payment CTA path uses `EmailCta`; active path uses `EmailStatusBadge` variant `"active"` with label `"Active member"` and no CTA; `PreviewProps` shows `includesPaymentCta: true` (covers AE1); both heading strings from R10 apply per path
- `board-resolution-task-assigned`: `footerAudience: "board"`
- `membership-admission-completed-board`: `footerAudience: "board"`; membership ID in `EmailDetailBlock`
- `position-assigned` and `position-removed`: notification-only, no CTA; copy follows the position update spec from R10

**Patterns to follow:**
- Existing test files in `src/emails/*.test.tsx` use `render()` to produce HTML and assert on text presence — follow the same pattern; update or replace snapshot assertions to match the new structure

**Test scenarios:**
- Covers AE1. `membership-admission-confirmed` rendered with `includesPaymentCta: true` → HTML contains the CTA href (`/membership`) and does not contain the "Active member" badge text
- Covers AE2. Rendered with `includesPaymentCta: false` → HTML contains "Active member" and does not contain a button element
- Covers AE3. `board-resolution-task-assigned` rendered HTML contains "board member of START Berlin" in the footer
- Happy path: each of the 12 emails renders without errors when passed its `PreviewProps` values
- Edge case: `start-cockpit-enabled` renders without `statusContext` — no eyebrow element emitted; no runtime error
- Happy path: no rendered email HTML contains the word "uppercase" applied to a heading element (sentence-case check)
- Happy path: no rendered email HTML contains the blue info block hex values (`#F0F9FF`, `#0EA5E9`)

**Verification:**
- `npm run email:dev` shows all 12 existing templates without errors
- No email file contains `Font`, `Html`, `Head`, `Body`, or `Tailwind` imports after the migration (all delegated to `EmailShell`)
- Existing test files pass

---

### U4. mandate-cancelled email and event wiring

**Goal:** Create `src/emails/mandate-cancelled.tsx` and add a send call to the `isMandateInvalidatedEvent` handler in `src/db/gocardless-events.ts`, firing only for `cancelled`, `expired`, and `failed` actions.

**Requirements:** R4, R12, R14

**Dependencies:** U2

**Files:**
- Create: `src/emails/mandate-cancelled.tsx`
- Create: `src/emails/mandate-cancelled.test.tsx`
- Modify: `src/db/gocardless-events.ts`

**Approach:**

`mandate-cancelled.tsx` props: `firstName` (string), `membershipUrl` (string)
- `EmailShell` with `eyebrow="Membership payment"` and preview "Your yearly membership payment was cancelled. Set it up again to keep your membership active."
- Heading: "Set up your membership payment again"
- Body: calm, helpful tone — the yearly payment setup was cancelled; without a new setup the membership will not remain active; takes about a minute; no GoCardless naming, no "mandate", no "direct debit"
- `EmailCta` with label "Set up payment" and href from `membershipUrl`
- `PreviewProps`: realistic `firstName`, `membershipUrl` pointing to `/membership`

`gocardless-events.ts` changes inside the `isMandateInvalidatedEvent` branch:
1. Before the `UPDATE`, query the user table for `{ id, email, firstName }` where `gocardlessMandateId = event.links.mandate`
2. Perform the existing `UPDATE` (clearing `gocardlessMandateId` and `gocardlessSetupSessionId`)
3. If user was found AND `event.action` is `"cancelled"`, `"expired"`, or `"failed"`: call `sendEmail` with the mandate-cancelled template, `from: "START Berlin <notifications@cockpit.start-berlin.com>"`, `to` the user's email, and subject `"Action required: set up your membership payment again"`; wrap in try/catch so an email failure does not surface as a handler error
4. If user not found: skip the email, continue with `return { status: "mandate_cleared" }`

**Patterns to follow:**
- Drizzle query pattern: `db.query.user.findFirst({ where: (u, { eq: eqFn }) => eqFn(u.gocardlessMandateId, mandateId), columns: { id: true, email: true, firstName: true } })`
- `sendEmail` call shape: matches calls in `src/inngest/new-user-workflow.ts` — `{ from, to, subject, react }`

**Test scenarios:**
- Covers AE4. `mandate-cancelled.tsx` rendered with `PreviewProps` → HTML contains href with `/membership`; does not contain the strings "GoCardless", "mandate", or "direct debit"
- Happy path: `recordAndProcessGoCardlessEvent` called with `{ resource_type: "mandates", action: "cancelled", links: { mandate: "MD123" } }` for a known mandate → user is looked up, `sendEmail` is called once, mandate field is cleared
- Happy path: same for `action: "expired"` and `action: "failed"`
- Edge case: `action: "replaced"` → `sendEmail` is not called; mandate cleared normally
- Edge case: `action: "consumed"` and `action: "blocked"` → no email sent; mandate cleared normally
- Edge case: mandate ID `"MD_UNKNOWN"` not present in any user row → no email sent, function returns `{ status: "mandate_cleared" }` without throwing
- Integration: after processing, `user.gocardlessMandateId` is `null` regardless of whether email was sent

**Verification:**
- `mandate-cancelled` appears in `npm run email:dev` without errors
- GoCardless sandbox: fire a `mandates:cancelled` event and confirm email send is logged (check `DISABLE_EMAIL` mode output or SES call)

---

### U5. membership-payment-upcoming email and event wiring

**Goal:** Create `src/emails/membership-payment-upcoming.tsx` and add a send call to `handlePaymentEvent` in `src/db/gocardless-events.ts` when a payment advances to `submitted`.

**Requirements:** R4, R13, R14

**Dependencies:** U2

**Files:**
- Create: `src/emails/membership-payment-upcoming.tsx`
- Create: `src/emails/membership-payment-upcoming.test.tsx`
- Modify: `src/db/gocardless-events.ts`

**Approach:**

`membership-payment-upcoming.tsx` props: `firstName` (string), `amountEur` (number)
- `EmailShell` with `eyebrow="Membership payment"` and preview "Your yearly START Berlin membership payment is coming up. No action needed."
- Heading: "Your membership payment is coming up"
- Body: reassurance-first — the yearly membership payment of `amountEur` EUR is scheduled and will be collected automatically; nothing to do; no GoCardless naming, no "direct debit"
- `EmailDetailBlock` with row `{ label: "Amount", value: "€${amountEur}" }`
- No `EmailCta` (informational only)
- `PreviewProps`: `firstName: "Sönke"`, `amountEur: 40`

`gocardless-events.ts` changes inside `handlePaymentEvent` after `advancePaymentStatus` returns truthy for `action: "submitted"`:
1. Look up the `membershipPayments` row by `id` (already available) for `userId` and `amount`
2. Look up `{ email, firstName }` from the user table by `userId`
3. If user found: call `sendEmail` with the upcoming template, `from: "START Berlin <notifications@cockpit.start-berlin.com>"`, subject `"Your START Berlin membership payment is coming up"`, `amountEur: row.amount / 100`; wrap in try/catch
4. Only fires for `"submitted"` action — no other payment actions

The send must be gated on `advancePaymentStatus` returning truthy, so a duplicate `submitted` event (already `confirmed`) does not re-send.

**Patterns to follow:**
- Amount conversion: `membershipPayments.amount` is integer cents; divide by 100 for EUR display
- Same `sendEmail` shape as U4

**Test scenarios:**
- Happy path: `membership-payment-upcoming.tsx` rendered with `PreviewProps` → HTML contains "40"; does not contain "GoCardless" or "direct debit"; contains the amount in the detail block
- Happy path: `recordAndProcessGoCardlessEvent` called with `payments:submitted` for a payment linked to a known user → `sendEmail` called once, payment status advanced to `"submitted"`
- Edge case: `payments:confirmed` event → no upcoming email sent; payment status advances normally
- Edge case: `payments:failed` → no upcoming email sent
- Edge case: `payments:submitted` for a payment ID not in `membershipPayments` → existing `"ignored"` path, no email sent
- Edge case: duplicate `payments:submitted` event (already `confirmed`, `advancePaymentStatus` returns falsy) → no email sent

**Verification:**
- `membership-payment-upcoming` appears in `npm run email:dev` without errors
- GoCardless sandbox: submit a payment and confirm upcoming email fires on `payment:submitted` event

---

## System-Wide Impact

- **Interaction graph:** `src/db/gocardless-events.ts` gains a dependency on `src/lib/email.ts` — first email-sending call site outside Inngest workflows; consistent with the helper's design but a new call pattern to be aware of in code review
- **Error propagation:** U4 and U5 email sends must be wrapped in try/catch; an email failure must not propagate and break the mandate clear or payment status advance that has already succeeded
- **State lifecycle (U4):** the user lookup in U4 must run before the `UPDATE` that clears `gocardlessMandateId`; reversing the order loses the association
- **API surface parity:** no new external endpoints; all 12 existing email callers in Inngest workflows are unaffected — the revamp is an internal implementation change
- **Unchanged invariants:** `sendEmail`'s `from` address, suppression check, and `DISABLE_EMAIL` flag behavior are unchanged; U1–U5 do not touch `src/lib/email.ts` beyond the render import update in U1

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| React Email v6 rendering regressions in existing templates | Run `npm run email:dev` after U1 and before touching any template; catch import or rendering errors early |
| `isMandateInvalidatedEvent` also covers `replaced` — could send misleading re-setup email | U4 explicitly filters to `cancelled/expired/failed`; test scenario covers `replaced` explicitly |
| Email send adds latency to the synchronous webhook response | Acceptable for now; if latency becomes an issue, move send calls to Inngest in a follow-up |
| Footer Vorstand names expected by design template but absent in codebase | Omit; use address + registration only; can be added when the values are established |

---

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-21-email-system-revamp-requirements.md](docs/brainstorms/2026-05-21-email-system-revamp-requirements.md)
- Tone of voice: [docs/solutions/conventions/reusable-tone-of-voice-and-wording-decisions-2026-05-02.md](docs/solutions/conventions/reusable-tone-of-voice-and-wording-decisions-2026-05-02.md)
- Membership/payment journey architecture: [docs/solutions/architecture-patterns/membership-journey-vs-payment-journey-2026-05-12.md](docs/solutions/architecture-patterns/membership-journey-vs-payment-journey-2026-05-12.md)
- GoCardless event handler: `src/db/gocardless-events.ts`
- Email send helper: `src/lib/email.ts`
- Legal entity constants: `src/lib/legal-documents/templates/brand.ts`
