---
title: "START Cockpit tone of voice and wording conventions"
date: "2026-05-02"
category: conventions
module: "app-wide copy and tone"
problem_type: convention
component: documentation
severity: low
related_components:
  - frontend_stimulus
  - development_workflow
  - assistant
tags:
  - copywriting
  - tone-of-voice
  - product-copy
  - wording-conventions
  - member-admin-language
applies_when:
  - Updating member-facing or admin-facing app copy
  - Naming actions, empty states, errors, metadata, or onboarding text
  - Keeping wording consistent across membership, people, groups, tools, sign-in, and errors
---

# START Cockpit tone of voice and wording conventions

## Context

During the app-wide copy refactor, we moved START Cockpit away from system-centered wording and toward copy that explains what a member or admin actually needs to know in that moment. The source work lives in `docs/brainstorms/2026-05-01-app-wide-copy-and-tone-rework-requirements.md` and `docs/plans/2026-05-01-002-refactor-app-copy-tone-plan.md`.

The chosen baseline voice is warm and direct. Member-facing copy should feel human, clear, and helpful without becoming overly casual. Admin-facing copy should stay precise and outcome-oriented.

## Core Principles

Choose the audience and lifecycle stage before writing. A member who just finished onboarding needs next steps, cost, cadence, and purpose. An active member needs reassurance that everything is set up. Supporting alumni need recognition for their ongoing contribution. Admins need to understand the operational outcome of an action.

Explain the user-visible outcome before the system mechanism. Avoid leading with provider or implementation details such as GoCardless, background jobs, or internal statuses unless the user needs that detail to act.

Use the description to restore context. Titles should be short and action-oriented. Descriptions can carry the why, the cost, the cadence, or what will happen next.

Prefer START-specific nouns over generic product nouns. Use "member" where the UI is about START people, "membership payment" for the annual payment setup, and "START Berlin" when a broader association context helps.

Keep chosen admin terminology stable unless there is a clear reason to revisit it. We intentionally left existing admin status descriptions and the "Slug" label unchanged.

## Member-Facing Copy

Membership payment setup should say exactly what is being set up, how much it costs, how often it is paid, and what it funds. The chosen title is "Set up your yearly membership payment." The description should explain that START Berlin membership costs 40 EUR per year and that it covers the essentials of running the association while funding internal and external events, catering, and member benefits throughout the year.

Payment copy should avoid technical setup language. Do not lead with "Your first membership fee will be collected as soon as GoCardless confirms the setup." Say what matters to the member: they are setting up the yearly membership payment and will be guided through the payment setup.

Active member copy should reassure without over-explaining. Use copy like "Your membership is active" and "Your yearly membership payment is set up. Thanks for being part of START Berlin."

Supporting alumni copy should acknowledge continued support. Use copy like "Thanks for supporting START Berlin" and "Your yearly payment is set up. Thank you for continuing to support the community as alumni."

Alumni copy should be clear that no membership payment is needed. Use copy like "You're listed as alumni" and explain that START Cockpit will show anything relevant to their alumni status there.

Processing states should say that START Cockpit is updating the membership status and that it usually only takes a moment. Avoid making provider confirmation the main story.

## Onboarding Copy

Onboarding should feel like finishing a membership setup, not filling out a system profile. The welcome title should be "Welcome to START Berlin." The description should explain that START needs a few details for membership and that it only takes a few minutes.

Contact details should name what START needs and why. Use "Your contact details" and explain that members should add the email address and phone number START Berlin can use to reach them.

For personal email collection, explicitly steer members toward a long-term personal address. The helper text should say to use a personal email address they will keep long-term and to avoid school or work addresses they might lose access to later.

For address collection, keep the explanation administrative and specific. The chosen direction is "We only show this to people who need it for administration."

## Tools And Access Copy

Slack and Notion should be described as START Berlin workspaces, not abstract integrations.

Slack copy should explain that it is for START Berlin communication, updates, and day-to-day coordination. The action should split between joining Slack and opening Slack when access already exists.

Notion copy should explain that it contains START Berlin resources, project docs, and internal information. The action should split between joining Notion and opening Notion when access already exists.

Auth error copy should focus on readiness and help. When an account is not ready yet, say that the account is not ready and explain what the user can do next, without exposing unnecessary provisioning mechanics.

## Admin Copy

Admin actions should describe the operational outcome, not just the implementation side effect. The membership finalization action should be "Invite to finalize membership." Its confirmation should explain that this marks onboarding as complete and asks the person to set up their yearly membership payment.

Do not make an email the main outcome when it is only the delivery mechanism. For example, "send payment email" is weaker than copy that says START is asking the member to set up payment.

People management should use member-centered labels where appropriate. Use "Add member" and "Import from Google Workspace" instead of generic user language.

Group automation should use "Matching rules" rather than "Auto-Add Criteria." Empty states should say "No matching rules" and explain that future members will be added automatically when they match the rule.

## Empty States, Errors, And Metadata

Empty table states should distinguish between an empty resource and an empty search result. For filtered tables, use concise copy like "No members match this search" or "No groups match this search."

Errors should use the shared pattern: "Could not [action]. Please try again. If this keeps happening, email operations@start-berlin.com." This gives members and admins a concrete next step instead of referring to "Operations" without contact context.

Metadata should be short, page-specific, and descriptive. Avoid broad marketing-style descriptions or internal implementation language.

## Examples

Payment setup:

- Before: "Your first membership fee will be collected as soon as GoCardless confirms the setup."
- Better: "Set up your yearly membership payment. Your START Berlin membership costs 40 EUR per year. It covers the essentials that keep the association running and helps fund internal and external events and member benefits throughout the year."

Supporting alumni:

- Before: "Payment active."
- Better: "Thanks for supporting START Berlin. Your yearly payment is set up. Thank you for continuing to support the community as alumni."

Admin membership action:

- Before: "Send payment setup email."
- Better: "Invite to finalize membership. This marks their onboarding as complete and asks them to set up their yearly membership payment."

Group rules:

- Before: "Auto-Add Criteria."
- Better: "Matching rules."

Error copy:

- Before: "Contact Operations if this is wrong."
- Better: "Could not update the member. Please try again. If this keeps happening, email operations@start-berlin.com."

## When To Apply This

Apply this convention whenever changing copy in member-facing flows, especially `src/app/(authenticated)/(app)/membership/billing-copy.ts`, `src/app/(authenticated)/(app)/membership/onboarding.tsx`, `src/app/(authenticated)/(app)/membership/payment-button.tsx`, and `src/app/(authenticated)/(redirect)/membership/payment-return/payment-return-redirect.tsx`.

Also apply it to onboarding files under `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/`, access copy in `src/app/(authenticated)/(app)/membership/slack-dialog.tsx` and `src/app/(authenticated)/(app)/membership/notion-dialog.tsx`, admin people and groups screens, email templates such as `src/emails/membership-payment-ready.tsx`, and app metadata.

When newer lifecycle work changes a business outcome, keep the voice principles from this document but update the exact action wording to match the current product decision.
