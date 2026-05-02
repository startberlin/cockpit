---
date: 2026-05-01
topic: app-wide-copy-and-tone-rework
---

# App-Wide Copy and Tone Rework

## Problem Frame

START Cockpit has the right functional surfaces, but much of the copy still speaks from the system's perspective instead of the user's current situation. Members see internal terms like billing setup, GoCardless confirmation, software accounts, and membership actions when they need plain answers about what happens next, why START needs something, how much they pay, how often they pay, and what their status means.

The rework should happen in stages so each product moment can get the right voice. New members need clarity and reassurance. Supporting alumni need recognition and a small reminder of why their contribution matters. Alumni need calm, non-payment-oriented status copy. Admins need precise, scannable operational language that helps them make decisions without exposing unnecessary implementation details.

This brainstorm does not define final production copy. It identifies weak wording, explains why it is weak, and gives example directions so a later planning or writing pass can produce the actual strings.

---

## Actors

- A1. New onboarding member: Completes profile details, gets access to tools, and eventually sets up the yearly membership payment.
- A2. Active member: Uses START Cockpit to understand current membership status and open available tools.
- A3. Supporting alumni: Continues supporting START Berlin financially after active membership and should feel recognized rather than treated as a generic billing state.
- A4. Alumni: May retain START Cockpit access or profile presence without active paid membership.
- A5. Admin/operator: Creates and imports members, completes onboarding, manages groups, and needs fast, precise operational copy.
- A6. Future copy implementer: Uses this document to rewrite app copy consistently without re-litigating product intent.

---

## Key Flows

- F1. New member completes onboarding and reaches payment setup
  - **Trigger:** A1 has completed profile onboarding and now needs to finalize membership.
  - **Actors:** A1
  - **Steps:** The member opens the membership page, sees a clear explanation of the yearly fee, understands when payment starts, starts setup, and returns to a status that explains what is happening.
  - **Outcome:** The member understands the next step without needing to know about GoCardless internals.
  - **Covered by:** R4, R5, R6

- F2. Supporting alumni checks membership page
  - **Trigger:** A3 opens START Cockpit after being added or imported as a supporting alumni.
  - **Actors:** A3
  - **Steps:** The page acknowledges their supporting alumni status, thanks them for continuing to support START Berlin, and avoids treating their payment as a generic membership action.
  - **Outcome:** The page feels respectful and status-aware.
  - **Covered by:** R7, R8

- F3. Admin creates, imports, or updates people
  - **Trigger:** A5 uses people management screens.
  - **Actors:** A5
  - **Steps:** The admin sees action labels, form legends, helper text, and success/error messages that explain the operational consequence of each action.
  - **Outcome:** Admins can act quickly and understand whether they are creating a new person, linking an existing Google Workspace user, completing onboarding, or setting payment coverage.
  - **Covered by:** R15, R16, R17

- F4. Admin manages groups and automatic membership
  - **Trigger:** A5 creates groups, adds members, or configures automatic group rules.
  - **Actors:** A5
  - **Steps:** The admin sees labels that describe communication channels, group email, member roles, and automatic rules in human terms.
  - **Outcome:** Group management feels like operating START communities, not manipulating database criteria.
  - **Covered by:** R18, R19, R20

- F5. User hits empty, loading, success, or error states
  - **Trigger:** Any actor searches, waits, submits a form, hits an error, or has no data yet.
  - **Actors:** A1, A2, A3, A4, A5
  - **Steps:** The UI gives next-step-oriented feedback rather than generic "failed" or "no results" messages.
  - **Outcome:** Users know whether to retry, wait, adjust input, contact Operations, or simply move on.
  - **Covered by:** R21, R22, R23, R24

---

## Requirements

**Stage 1 - Establish Voice Principles and Copy Rules**
- R1. Define a small voice guide before rewriting strings: member-facing copy should be warm, concrete, and low on internal terminology; admin-facing copy should be precise, scannable, and outcome-oriented.
- R2. Classify every reviewed string by audience and moment: onboarding member, active member, supporting alumni, alumni, admin/operator, or cross-cutting system feedback.
- R3. Keep vendor and implementation terms out of member-facing copy unless they materially help the user make a decision.

**Stage 2 - Rewrite Member Onboarding and Membership Payment Copy**
- R4. Rewrite membership payment copy in `src/app/(authenticated)/(app)/membership/billing-copy.ts` so payment-pending members see amount, cadence, purpose, and reassurance instead of provider/status-machine language.
- R5. Replace the payment-processing text in `src/app/(authenticated)/(app)/membership/billing-copy.ts` and `src/app/(authenticated)/(app)/membership/onboarding.tsx` with a member-centered waiting state that explains "we are finishing this" without naming GoCardless confirmation as the main concept.
- R6. Align `src/app/(authenticated)/(app)/membership/payment-button.tsx` with the new payment tone so labels like "Set up payment" and "Opening payment..." become specific to annual membership setup.
- R7. Add dedicated supporting alumni copy in `src/app/(authenticated)/(app)/membership/billing-copy.ts`, distinct from active member and non-paying alumni copy.
- R8. Rework alumni copy in `src/app/(authenticated)/(app)/membership/billing-copy.ts` so alumni who do not pay are not shown vague "membership actions will appear" language.

**Stage 3 - Improve Onboarding Profile and Data Collection Copy**
- R9. Rewrite onboarding step titles and descriptions in `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/index.tsx` to frame the journey rather than describe START Cockpit abstractly.
- R10. Improve personal email, phone, and locked-field helper text in `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/step-master-data.tsx` so members understand why START needs each field and what can be changed later.
- R11. Improve address collection copy in `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/step-address.tsx` so it gives a concrete reason for collecting the address and uses trust-building privacy language without vague claims.

**Stage 4 - Rework Tools, Access, and Sign-In Copy**
- R12. Rewrite the tools section in `src/app/(authenticated)/(app)/membership/billing-copy.ts`, `src/app/(authenticated)/(app)/membership/onboarding.tsx`, `src/app/(authenticated)/(app)/membership/slack-dialog.tsx`, and `src/app/(authenticated)/(app)/membership/notion-dialog.tsx` so Slack and Notion descriptions explain their real START value rather than "software accounts" and "latest news and announcements."
- R13. Make sign-in copy in `src/app/auth/page.tsx` and `src/app/auth/google.tsx` clearer about account eligibility and what to do if access is not enabled.
- R14. Review email templates in `src/emails/membership-payment-ready.tsx`, `src/emails/start-cockpit-enabled.tsx`, and `src/emails/signin-instructions.tsx` so email tone and in-app tone reinforce each other.

**Stage 5 - Improve Admin People Management Copy**
- R15. Rework people table and onboarding completion copy in `src/components/people-table.tsx` so admin actions distinguish "complete profile onboarding", "invite to payment setup", and "member can now finalize membership."
- R16. Rework create/import copy in `src/app/(authenticated)/(app)/people/create-user-dialog.tsx` and `src/app/(authenticated)/(app)/people/import-google-user-dialog.tsx` so admins understand whether they are creating a new Google Workspace account or linking an existing one.
- R17. Improve user status labels and descriptions in `src/lib/user-status.ts` so statuses clarify membership/access implications and fix grammar issues.

**Stage 6 - Improve Group Management and Automation Copy**
- R18. Rework group creation copy in `src/app/(authenticated)/(app)/groups/create-group-dialog.tsx` so "slug" is explained as the channel/email name rather than as an implementation term.
- R19. Rework group detail and member management copy in `src/app/(authenticated)/(app)/groups/[id]/page-client.tsx` so labels are sentence-case, consistent, and describe user-visible outcomes.
- R20. Rename and explain "Auto-Add Criteria" language in `src/components/group-criteria-manager.tsx` and `src/components/bulk-add-users-dialog.tsx` around automatic group rules and matching members.

**Stage 7 - Improve System Feedback, Empty States, and Metadata**
- R21. Replace generic table empty states like "No results." in `src/components/people-table.tsx` and `src/components/groups-table.tsx` with contextual search/no-data messages.
- R22. Replace generic failure toasts and errors across reviewed files with messages that tell users what happened and what they can do next.
- R23. Fix typos and consistency issues such as "An error occured" in `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/step-master-data.tsx` and `src/app/(authenticated)/(app)/people/create-user-dialog.tsx`.
- R24. Update repeated page metadata descriptions in `src/app/layout.tsx`, `src/app/(authenticated)/(app)/membership/page.tsx`, `src/app/(authenticated)/(app)/people/page.tsx`, and `src/app/auth/page.tsx` so pages do not all share the same generic "Manage your membership, get access to software and more" framing.

---

## Stage Audit Notes

**Stage 1 - Voice Principles**
- `src/app/(authenticated)/(app)/membership/billing-copy.ts`: The same helper currently has to cover onboarding members, active members, alumni, and supporting alumni, but the copy does not define a voice per situation. Improve by writing a small copy rule set first. Example direction: "Use internal provider names only in admin or troubleshooting contexts; members see outcomes first."
- `src/lib/user-status.ts`: Status descriptions currently define people generically instead of explaining product implications. Improve by giving each status a purpose. Example direction: "Supporting alumni: Former active members who keep supporting START Berlin through an annual contribution."
- `src/app/layout.tsx`, `src/app/(authenticated)/(app)/membership/page.tsx`, `src/app/(authenticated)/(app)/people/page.tsx`, `src/app/auth/page.tsx`: Repeated metadata makes every page sound like the same general product. Improve by using page-specific descriptions.

**Stage 2 - Membership Payment**
- `src/app/(authenticated)/(app)/membership/billing-copy.ts`: "We're waiting for GoCardless to confirm your membership payment setup" is too technical for a member. Improve by focusing on the wait. Example direction: "We're finishing your membership setup. This usually only takes a moment."
- `src/app/(authenticated)/(app)/membership/billing-copy.ts`: "Set up your yearly membership billing" uses accounting language and hides the amount. Improve by naming the annual 40 EUR fee and why it exists. Example direction: "Set up your 40 EUR yearly membership contribution."
- `src/app/(authenticated)/(app)/membership/billing-copy.ts`: "Your first membership fee will be collected as soon as GoCardless confirms the setup" explains provider mechanics, not user expectation. Improve by saying when payment begins in plain language. Example direction: "Your yearly membership starts once the setup is complete."
- `src/app/(authenticated)/(app)/membership/billing-copy.ts`: "Future membership actions will appear here" is vague and placeholder-like. Improve by either removing it or stating the current truth. Example direction: "Your annual membership contribution is set up."
- `src/app/(authenticated)/(app)/membership/billing-copy.ts`: Alumni copy says they do not have an active paid membership and actions may appear later. Improve by distinguishing alumni from supporting alumni and avoiding phantom future actions. Example direction for alumni: "You are listed as alumni. There is no membership payment to set up."
- `src/app/(authenticated)/(app)/membership/payment-button.tsx`: "Set up payment" is generic and transactional. Improve by tying the action to membership. Example direction: "Set up yearly contribution."

**Stage 3 - Onboarding Profile**
- `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/index.tsx`: "START Cockpit is your central platform..." is product description rather than onboarding guidance. Improve by telling the new member what this step accomplishes. Example direction: "Let's finish the details START needs for your membership."
- `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/index.tsx`: "Set up your account" overlaps with the welcome button label and does not say what data is needed. Improve by using more specific titles. Example direction: "Your contact details."
- `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/step-master-data.tsx`: "You cannot change this" is blunt and unexplained. Improve by saying where locked values come from and how to fix mistakes. Example direction: "This comes from your START account. Contact Operations if it is wrong."
- `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/step-master-data.tsx`: "Use a personal email you'll keep long-term" is good but could be more helpful. Improve by saying what START uses it for. Example direction: "Use an address we can still reach after university or work changes."
- `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/step-address.tsx`: "Handled securely" and "need-to-know basis" are broad claims. Improve by naming the purpose. Example direction: "We use this for association records and only show it to people who need it for administration."

**Stage 4 - Tools, Access, and Sign-In**
- `src/app/(authenticated)/(app)/membership/billing-copy.ts`: "First steps" and "Your software & tools" are serviceable but generic. Improve by making the section about getting into START's working spaces.
- `src/app/(authenticated)/(app)/membership/onboarding.tsx`: Slack and Notion cards both use generic benefit language. Improve by differentiating them. Example direction for Slack: "Join the workspace where START Berlin coordinates day to day." Example direction for Notion: "Open the workspace for project docs, handbooks, and team resources."
- `src/app/(authenticated)/(app)/membership/notion-dialog.tsx`: Notion copy incorrectly says it helps users stay updated with news and announcements. Improve by describing documentation and collaboration.
- `src/app/auth/page.tsx`: "Something went wrong" for disabled signup hides the actual issue. Improve by saying access is not enabled yet and who can help. Example direction: "Your START Cockpit access is not active yet."
- `src/app/auth/google.tsx`: "Use your START Berlin Google account to continue" is clear, but it could pair better with the eligibility error state. Improve by clarifying that personal Google accounts will not work.
- `src/emails/membership-payment-ready.tsx`: This email already contains useful amount/cadence/purpose copy that should inform the in-app membership page. Improve by reducing provider emphasis and aligning terminology with the app.
- `src/emails/start-cockpit-enabled.tsx`: "You have been added to START Cockpit as Supporting Alumni" is technically accurate but emotionally flat. Improve by making status-specific variants, especially for supporting alumni.

**Stage 5 - Admin People Management**
- `src/components/people-table.tsx`: "Complete onboarding" sends an email so the member can finalize membership and set up payment. The label hides that operational consequence. Improve by naming the action more precisely or improving the confirmation body. Example direction: "Invite to finalize membership."
- `src/components/people-table.tsx`: Success toast "Onboarding completed" is ambiguous because payment may still be pending. Improve by separating profile completion from payment invitation.
- `src/app/(authenticated)/(app)/people/create-user-dialog.tsx`: "Create user" is system language. Improve by using "Add new member" when the action represents onboarding a person into START Cockpit, while still explaining that a Google Workspace account will be created.
- `src/app/(authenticated)/(app)/people/create-user-dialog.tsx`: "This is the Google Workspace email START Cockpit will create" is clear but system-first. Improve by stating the result. Example direction: "This will become their START Berlin email address."
- `src/app/(authenticated)/(app)/people/import-google-user-dialog.tsx`: "Local profile" is implementation language. Improve by using "START Cockpit profile."
- `src/app/(authenticated)/(app)/people/import-google-user-dialog.tsx`: "Paid through" and the helper text are useful but dense. Improve by clarifying that this prevents an immediate charge for already-paid members.
- `src/app/(authenticated)/(app)/people/[id]/profile-card.tsx`: "Payment setup was started. GoCardless confirmation is still pending" is admin-facing and can be more precise, but it should still focus on operational status. Example direction: "Payment setup started; waiting for provider confirmation."
- `src/lib/user-status.ts`: "Former members who that are still part..." has a grammar bug and unclear distinction between alumni and supporting alumni. Improve in the status-label pass.

**Stage 6 - Groups and Automation**
- `src/app/(authenticated)/(app)/groups/create-group-dialog.tsx`: "Slug" is a developer term. Improve by labeling it as channel/email name with the slug value as a technical detail. Example direction: "Channel and email name."
- `src/app/(authenticated)/(app)/groups/create-group-dialog.tsx`: "Auto-generated from name but can be customized" does not say where it appears. Improve by linking it to Slack and email. Example direction: "Used for the Slack channel and group email address."
- `src/app/(authenticated)/(app)/groups/[id]/page-client.tsx`: Mixed title casing such as "Add Member", "Total Members", "Make Admin", and "Remove from Group" feels inconsistent. Improve by using sentence case for actions unless the design system chooses title case.
- `src/app/(authenticated)/(app)/groups/[id]/page-client.tsx`: "All members of this group and their roles" is bland but acceptable. Improve by making role context clearer if admins often manage permissions here.
- `src/components/group-criteria-manager.tsx`: "Auto-Add Criteria" is implementation language. Improve by describing the job: automatic group rules. Example direction: "Automatic group rules."
- `src/components/group-criteria-manager.tsx`: "No specific criteria" is not user-friendly. Improve by saying whether the rule matches everyone or is incomplete, depending on actual behavior.
- `src/components/bulk-add-users-dialog.tsx`: "Add Users by Criteria" should become operational language. Example direction: "Add matching members."

**Stage 7 - Feedback, Empty States, and Metadata**
- `src/components/people-table.tsx` and `src/components/groups-table.tsx`: "No results." is too generic. Improve by distinguishing empty dataset from no search match. Example direction: "No members match this search."
- `src/components/copy-button.tsx`: "Copied to clipboard" is fine for generic copy, but copy labels around email/phone/address could be more specific where helpful.
- `src/app/(authenticated)/(app)/membership/payment-button.tsx`: "Could not start payment setup" lacks a next step. Improve by saying to retry or contact Operations if it keeps happening.
- `src/components/group-criteria-manager.tsx`, `src/components/bulk-add-users-dialog.tsx`, and `src/app/(authenticated)/(app)/groups/[id]/page-client.tsx`: Repeated "Failed to..." toasts are technically accurate but not helpful. Improve by adding action-specific context.
- `src/app/(authenticated)/(redirect)/membership/payment-return/payment-return-redirect.tsx`: "We could not finish setting up your membership payment" is close, but should give recovery guidance. Example direction: "We could not finish your membership payment setup. Please try again from the membership page."
- `src/app/(authenticated)/(onboarding)/onboarding/[step]/(steps)/step-master-data.tsx` and `src/app/(authenticated)/(app)/people/create-user-dialog.tsx`: "An error occured" should be corrected to "An error occurred" and ideally replaced with a more specific title per form.

---

## Acceptance Examples

- AE1. **Covers R4, R5, R6.** Given a new member has completed profile onboarding and has no active payment setup, when they open the membership page, the copy tells them the annual amount, cadence, and reason for payment without leading with provider terminology.
- AE2. **Covers R7, R8.** Given a supporting alumni opens the membership page, when they view their status, they see a short thank-you and explanation of continued support rather than generic active-member or alumni copy.
- AE3. **Covers R9, R10, R11.** Given a new member is asked for profile details, when they read the onboarding step descriptions and field helper text, they understand why START needs the information and what to do if locked data is wrong.
- AE4. **Covers R12, R13, R14.** Given a member opens the tools section or access email, when Slack and Notion are described, each tool has a distinct START-specific purpose and uses matching terminology across app and email.
- AE5. **Covers R15, R16, R17.** Given an admin creates or imports a person, when they read the dialog title, description, status fields, and success messages, they can tell whether a new Google Workspace account is created, an existing one is linked, and whether the person still needs payment setup.
- AE6. **Covers R18, R19, R20.** Given an admin creates a group or configures automatic group rules, when they read labels and helper text, they understand the effect on Slack channels, group email, and matching future members without relying on developer terms.
- AE7. **Covers R21, R22, R23, R24.** Given a user sees an empty state, error, or page preview, when they read the copy, it is contextual, typo-free, and gives the next useful action where one exists.

---

## Success Criteria

- Members understand their current status, next step, payment amount, payment cadence, and reason for payment without admin explanation.
- Supporting alumni feel recognized for continued support rather than collapsed into generic alumni or billing copy.
- Admins can scan people and group management screens faster because actions name outcomes rather than internal objects.
- Error, empty, and waiting states reduce uncertainty by telling users whether to retry, wait, adjust input, or contact Operations.
- A downstream planner can turn each stage into an implementation plan without inventing the affected surfaces, target audiences, or desired copy direction.

---

## Scope Boundaries

- Do not change business rules, permissions, membership status logic, payment behavior, or integrations as part of the copy rework unless a later plan explicitly adds that scope.
- Do not redesign page layouts beyond what is required to fit improved copy cleanly.
- Do not finalize every production string in this brainstorm document; examples are directional and should be refined during the copy-writing implementation stage.
- Do not introduce heavy brand guidelines or a full design-system content strategy beyond the small voice rules needed for this app.
- Do not localize the app or introduce multilingual copy in this stage.

---

## Key Decisions

- Stage the work by user moment rather than by file: Copy quality depends on actor and context, not source-code location.
- Start with voice principles: Without a small rule set, individual string rewrites will drift back toward generic or technical wording.
- Treat supporting alumni as a first-class audience: Their status has different emotional and payment implications from both active members and alumni.
- Keep admin copy precise, not overly warm: Admin surfaces need clarity and operational confidence more than member-facing reassurance.
- Use the membership payment email as a positive reference: It already states amount, cadence, and purpose more clearly than the in-app membership page.

---

## Dependencies / Assumptions

- The yearly active membership fee is 40 EUR, based on existing email copy in `src/emails/membership-payment-ready.tsx`.
- Supporting alumni are expected to continue contributing financially, based on the existing `supporting_alumni` status and membership payment flow handling.
- The app's primary language remains English.
- Operations & Digital remains the support contact for access/payment issues unless product owners decide otherwise.
- Slack organizational context was not searched for this brainstorm. If tone or membership framing has been discussed internally, that context could refine the final copy.

---

## Outstanding Questions

### Resolve Before Planning

- None.

### Deferred to Planning

- [Affects R4, R7][Product] Confirm whether supporting alumni pay the same 40 EUR yearly contribution as active members and whether the app should name the amount for them.
- [Affects R11][Product/Legal] Confirm the exact privacy wording START is comfortable using for address and personal contact data.
- [Affects R13, R14][Product] Decide whether support copy should always point to Operations & Digital or vary by surface.
- [Affects R18, R20][Product] Decide the final non-technical term for "slug" and "criteria" after seeing proposed copy variants in context.

---

## Next Steps

-> /ce-plan for structured implementation planning
