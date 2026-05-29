# Membership Anniversary Emails — Requirements

**Date:** 2026-05-29
**Status:** Ready for planning

---

## Problem

START Berlin has no way to acknowledge long-term membership. Members reach their 6-month, 1-year, and multi-year milestones with no recognition from the organisation. A brief celebratory email at each milestone costs little to build and delivers a low-effort but meaningful moment for members.

---

## Goals

- Send a warm anniversary email to each eligible member when they hit the 6-month and 1-year milestones, then again on every subsequent yearly anniversary.
- Emails are purely celebratory — a "thank you for being here" note. No call to action, no upsell.

## Non-Goals

- Dynamic personalisation (event attendance, community stats, etc.)
- Admin UI for previewing or suppressing upcoming anniversaries
- Retroactive sends for members who have already passed a milestone before this ships

---

## Recipients

A user is eligible if **all** of the following are true at the time the cron runs:

| Field | Required value |
|---|---|
| `user.memberSinceDate` | non-null |
| `user.status` | `member` or `supporting_alumni` |
| `user.legalMembershipState` | `active_member` |

Members with `status = alumni`, `cancelled`, or `legalMembershipState = former_member` are excluded.

---

## Milestones

| Milestone | When triggered | Recurs? |
|---|---|---|
| 6 months | Exactly 6 months after `memberSinceDate` | No — once only |
| 1 year | Exactly 1 year after `memberSinceDate` | Yes — annually from this point |
| 2+ years | Each subsequent anniversary year | Yes — annually |

The 6-month email fires once and is never repeated. Yearly emails fire once per year on the anniversary date.

---

## Scheduling & Delivery Mechanism

A daily Inngest cron (same pattern as `src/inngest/sync-system-groups-cron.ts`, `TZ=Europe/Berlin`) runs each morning and:

1. Queries all eligible users whose anniversary milestone falls on today's date.
2. For each user + milestone combination, emits an Inngest event.
3. A separate Inngest function handles each event and sends the email.

**Deduplication:** Each emitted event carries a compound ID of the form `anniversary-{userId}-{milestoneMonths}m-{anniversaryDate}` (e.g. `anniversary-usr_abc-6m-2026-11-15`). Inngest's event deduplication ensures the email is not sent twice even if the cron fires multiple times on the same day or a step retries.

---

## Edge Cases

- **Feb 29 anniversary in a non-leap year:** treat Feb 28 as the anniversary date.
- **`memberSinceDate` is null:** skip the user silently — no error, no email.
- **User becomes ineligible between cron and send:** the function re-checks eligibility before sending and skips if the user no longer qualifies.

---

## Email Content

Three distinct email templates (colocated under `src/emails/membership/anniversary/`):

| Template | Subject line | Milestone copy |
|---|---|---|
| `membership-anniversary-6-months.tsx` | "6 months at START Berlin" | Acknowledges the 6-month milestone |
| `membership-anniversary-1-year.tsx` | "1 year at START Berlin" | Acknowledges the 1-year milestone |
| `membership-anniversary-years.tsx` | "{N} years at START Berlin" | Generic yearly template, receives year count as prop |

All three follow the existing `EmailShell` + React Email pattern. Warm, brief, first-name greeting. No CTA buttons. The 2+ year template receives a `years: number` prop to render "2 years", "3 years", etc.

**Sender:** `START Berlin <no-reply@notification.cockpit.start-berlin.com>` (consistent with all other membership emails)

---

## Success Criteria

- Every eligible member receives an email on their 6-month anniversary (±1 day tolerance for cron timing).
- Every eligible member receives an email on their 1-year and each subsequent yearly anniversary (±1 day tolerance).
- No member receives the same milestone email twice.
- Members who become ineligible (cancelled, transitioned to alumni) before their next anniversary do not receive an email.
- No emails are sent to members with `memberSinceDate = null`.
