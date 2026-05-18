---
title: "refactor: Remove Slack Groups Integration"
type: refactor
status: active
date: 2026-05-18
---

# refactor: Remove Slack Groups Integration

## Summary

Remove all Slack channel sync logic from the groups feature, leaving Google Groups as the sole integration. This means stripping Slack-specific columns from the `group` table, pruning Slack branches from the reconcile library and cron, removing Slack fields from the group-creation UI and server actions, deleting the Slack webhook route and its Inngest handler, and removing the Slack client helpers that served only group operations.

---

## Problem Frame

The groups feature currently maintains two parallel sync lanes: Google Groups (email-based) and Slack private channels. Slack sync is no longer needed — it adds schema weight, code branches in critical sync paths, and dead surface area in the group-creation UI. Removing it simplifies the mental model and reduces the blast radius of future group-sync changes.

---

## Requirements

- R1. No Slack-specific fields (`slackEnabled`, `slackChannelSlug`, `slackChannelId`) remain in the `group` DB table or Drizzle schema.
- R2. The reconcile library (`src/lib/groups/reconcile.ts`) operates on Google Groups only.
- R3. The sync cron (`sync-groups-cron.ts`) queries and guards are Google-only.
- R4. The group-create Inngest workflow no longer creates Slack channels.
- R5. The group-creation form, Zod schema, server action, and DB helpers contain no Slack references.
- R6. The Slack event webhook (`/api/slack/events`) and its Inngest handler (`slack-user-joined`) are deleted.
- R7. `SLACK_SIGNING_SECRET` is removed from `src/env.ts`. `SLACK_BOT_TOKEN` and `DISABLE_SLACK` are retained — they are used by the membership Slack onboarding feature which is out of scope.
- R8. `cockpitUserUpdated` continues to be sent by its remaining sources (admission workflow, new-user workflow, reconfirmation workflow, import action) — the group reconcile trigger chain is unaffected.
- R9. The codebase compiles without TypeScript errors after removal.

---

## Scope Boundaries

- Removing the `slack-user-joined.ts` Inngest handler is safe: `cockpitUserUpdated` is still sent by `membership-admission-workflow.ts`, `new-user-workflow.ts`, `membership-reconfirmation-workflow.ts`, `sync-google-workspace-user-name.ts`, and `import-google-user-action.ts`. No replacement trigger is needed.
- **Membership Slack onboarding feature is out of scope.** `src/app/(authenticated)/(app)/membership/get-slack-status-action.ts`, `slack-dialog.tsx`, and `onboarding.tsx` use `@/lib/slack` and `env.DISABLE_SLACK` to check if a user is in the Slack workspace during onboarding. These files are unaffected by this refactor. Consequently, `src/lib/slack.ts` cannot be deleted — only the groups-specific exports within it are removed.
- `check-slug-action.ts` (group slug availability, not Slack-specific) is unaffected and not part of this work.
- No changes to Google Groups logic, `checkGoogleEmailPrefixAction`, or `checkGoogleEmailPrefixAvailability`.

### Deferred to Follow-Up Work

- Updating `.env.example` and any deployment docs that reference `SLACK_SIGNING_SECRET` / `SLACK_BOT_TOKEN`: low-risk but outside the scope of this code change.

---

## Context & Research

### Relevant Code and Patterns

- `src/db/schema/group.ts` — Slack columns: `slackEnabled`, `slackChannelSlug`, `slackChannelId`
- `src/lib/groups/reconcile.ts` — `GroupForReconcile` interface and `pushAddToIntegrations` / `pushRemoveToIntegrations` contain the Slack branches
- `src/inngest/sync-groups-cron.ts` — two queries (`find-pending-groups`, `find-groups-with-integrations`) have Slack branches; one early-continue guard
- `src/inngest/create-group.ts` (`syncGroupIntegrationsWorkflow`) — Slack channel creation block gated on `slackEnabled && !slackChannelId`
- `src/app/(authenticated)/(app)/groups/create-group-schema.ts` — `integrationsSchema` has `slack` and `slackChannelSlug` fields
- `src/app/(authenticated)/(app)/groups/create-group-action.ts` — inserts `slackEnabled`, `slackChannelSlug`
- `src/app/(authenticated)/(app)/groups/create-group-dialog.tsx` — Slack `Controller` block with `slackEnabled`, slug debounce, availability check
- `src/app/(authenticated)/(app)/groups/check-integration-actions.ts` — `checkSlackSlugAction` (remove) + `checkGoogleEmailPrefixAction` (keep)
- `src/db/groups.ts` — `checkSlackChannelSlugAvailability` (remove)
- `src/inngest/slack-user-joined.ts` — `handleSlackEvent` (entire file removed)
- `src/app/api/slack/events/route.ts` — Slack webhook (entire file removed)
- `src/inngest/index.ts` — remove `handleSlackEvent` import and registration
- `src/lib/slack.ts` — remove groups-related functions; delete entire file once `slack-user-joined.ts` and Slack block in `create-group.ts` are gone
- `src/env.ts` — remove `SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN`, `DISABLE_SLACK`

### Institutional Learnings

- `docs/solutions/architecture-patterns/membership-journey-vs-payment-journey-2026-05-12.md` — `user.status` is not the authoritative membership signal; this refactor does not change group eligibility logic so this remains out of scope.
- Migration workflow per `CLAUDE.md`: edit schema → `npm run db:generate` → `npm run db:migrate`. Never manually edit migration files.

---

## Key Technical Decisions

- **Prune `slack.ts`, do not delete it**: `src/app/(authenticated)/(app)/membership/get-slack-status-action.ts` imports `{ slack }` from `@/lib/slack` and uses `env.DISABLE_SLACK`. The membership onboarding feature is out of scope. Remove only the groups-specific exports (`fetchSlackChannelNames`, `slackChannelExists`, `lookupSlackUserIdByEmail`, `inviteToChannel`, `kickFromChannel`) while keeping the `slack` WebClient export.
- **Schema columns removed last**: All TypeScript code referencing `group.slackEnabled`, `group.slackChannelId`, `group.slackChannelSlug` must be removed before the Drizzle schema columns are dropped. This prevents TypeScript errors during the migration generation step.
- **No replacement trigger for Slack user-join**: Verified that `cockpitUserUpdated` is fired from five other sites (admission, new-user, reconfirmation, sync-google-workspace-user-name, import-google-user-action). The Slack webhook is not load-bearing for group reconciliation continuity.
- **`integrationsSynced` on `usersToGroups` is kept**: This flag is shared and still needed for the Google-only retry path.
- **`DISABLE_SLACK` env var kept**: It is still used by `membership/get-slack-status-action.ts` (out of scope). Only `SLACK_SIGNING_SECRET` is removed from `src/env.ts` — it was used exclusively by the now-deleted Slack event webhook.

---

## Open Questions

### Resolved During Planning

- **Is `cockpitUserUpdated` still sent after removing `slack-user-joined.ts`?** Yes — five other send sites exist: `membership-admission-workflow.ts`, `new-user-workflow.ts`, `membership-reconfirmation-workflow.ts`, `sync-google-workspace-user-name.ts`, and `import-google-user-action.ts`. Safe to remove.
- **Is `slack.ts` safe to delete?** No — `src/app/(authenticated)/(app)/membership/get-slack-status-action.ts` imports `{ slack }` from `@/lib/slack`. The file must be pruned (groups-specific exports removed) rather than deleted. See Key Technical Decisions.

### Deferred to Implementation

- Whether the `integrationsSchema` `.refine()` in `create-group-schema.ts` (which currently requires at least one integration enabled) needs adjustment now that only `email` remains — depends on whether single-integration groups with email disabled are valid. If Google email is always required, the refine can be simplified or removed.

---

## Implementation Units

### U1. Strip Slack logic from reconcile library

**Goal:** Remove the Slack integration paths from the shared `pushAddToIntegrations` and `pushRemoveToIntegrations` functions and from the `GroupForReconcile` interface.

**Requirements:** R2

**Dependencies:** None

**Files:**
- Modify: `src/lib/groups/reconcile.ts`
- Modify: `src/inngest/sync-group-member-integrations.ts`

**Approach:**
- Remove `slackChannelId` from the `GroupForReconcile` interface
- Remove the `if (g.slackChannelId)` block in `pushAddToIntegrations` (Slack invite + archive-guard + clear logic)
- Remove the `if (g.slackChannelId)` block in `pushRemoveToIntegrations` (Slack kick logic)
- Remove the imports of `inviteToChannel`, `kickFromChannel`, `lookupSlackUserIdByEmail` from `@/lib/slack`
- `sync-group-member-integrations.ts`: remove `slackChannelId: true` from both `db.query.group.findFirst` column selections; simplify both early-return guards from `(!g.slackChannelId && !g.googleGroupEmail)` to `(!g.googleGroupEmail)`

**Patterns to follow:**
- Existing Google Groups branch in the same functions — keep its shape unchanged

**Test scenarios:**
- Happy path: `pushAddToIntegrations` with a group that has `googleGroupEmail` — adds member to Google Group, marks `integrationsSynced`
- Happy path: `pushRemoveToIntegrations` with a group that has `googleGroupEmail` — removes member from Google Group
- Edge case: group with neither `googleGroupEmail` (nor any Slack fields) — both functions are no-ops and do not throw
- Integration: `onGroupMembersAdded` fires for a group with `googleGroupEmail` — calls `pushAddToIntegrations` for each user
- Edge case: `onGroupMembersAdded` fires for a group with no integrations (`googleGroupEmail` null) — returns `{ pushed: 0 }` without calling `pushAddToIntegrations`

**Verification:**
- `src/lib/groups/reconcile.ts` imports no symbols from `@/lib/slack`
- `src/inngest/sync-group-member-integrations.ts` has no reference to `slackChannelId`
- TypeScript compiles without errors in both files

---

### U2. Prune Slack branches from sync cron

**Goal:** Remove the two Slack-specific query branches and simplify the early-continue guard in `syncGroupsCron`.

**Requirements:** R3

**Dependencies:** None

**Files:**
- Modify: `src/inngest/sync-groups-cron.ts`

**Approach:**
- In `find-pending-groups` step: remove the `and(eq(group.slackEnabled, true), isNull(group.slackChannelId))` branch from the `or()`. Keep only the `emailEnabled`/`isNull(googleGroupEmail)` branch.
- In `find-groups-with-integrations` step: remove the `isNotNull(group.slackChannelId)` branch from the `or()`. Keep only `isNotNull(group.googleGroupEmail)`.
- Simplify the early-continue guard from `if (!g.slackChannelId && !g.googleGroupEmail) continue` to `if (!g.googleGroupEmail) continue`.

**Patterns to follow:**
- Existing Drizzle query style in the same file

**Test scenarios:**
- Happy path: cron fires and correctly identifies a group with `googleGroupEmail` set as having a pending integration
- Edge case: cron fires with no groups that have `googleGroupEmail` set — no reconciliation steps run, function exits cleanly
- Edge case: a group has `emailEnabled = true` but `googleGroupEmail` already set — not picked up in pending-groups query

**Verification:**
- No references to `group.slackEnabled` or `group.slackChannelId` remain in this file

---

### U3. Remove Slack channel creation from group-create Inngest workflow

**Goal:** Remove the Slack channel provisioning block from `syncGroupIntegrationsWorkflow` in `src/inngest/create-group.ts`.

**Requirements:** R4

**Dependencies:** None

**Files:**
- Modify: `src/inngest/create-group.ts`

**Approach:**
- Delete the entire `if (g.slackEnabled && !g.slackChannelId)` block (the step that creates the Slack channel and persists `slackChannelId`)
- Remove any imports from `@/lib/slack` used only by that block
- Keep the Google Groups creation block and all DB updates for `googleGroupEmail`

**Patterns to follow:**
- Existing Google Groups creation block in the same function

**Test scenarios:**
- Happy path: `groupSyncRequested` event fires for a group with `emailEnabled = true` — Google Group is created and `googleGroupEmail` persisted
- Edge case: workflow fires for a group with `emailEnabled = false` — no external calls, function exits without side effects
- Integration: after Slack block removal, no `slackChannelId` is written to DB regardless of group config

**Verification:**
- `src/inngest/create-group.ts` has no imports from `@/lib/slack`
- No references to `slackChannelId` or `slackEnabled` remain in this file

---

### U4. Remove Slack from group creation form, actions, and DB helpers

**Goal:** Remove all Slack-specific fields and actions from the group-creation UI, Zod schema, server action, and DB query layer.

**Requirements:** R1, R5

**Dependencies:** None (can be done in parallel with U1–U3)

**Files:**
- Modify: `src/app/(authenticated)/(app)/groups/create-group-schema.ts`
- Modify: `src/app/(authenticated)/(app)/groups/create-group-action.ts`
- Modify: `src/app/(authenticated)/(app)/groups/create-group-dialog.tsx`
- Modify: `src/app/(authenticated)/(app)/groups/check-integration-actions.ts`
- Modify: `src/db/groups.ts`
- Modify: `src/components/groups-table.tsx`

**Approach:**
- `create-group-schema.ts`: remove `slack` and `slackChannelSlug` fields from `integrationsSchema`; evaluate and simplify the `.refine()` validator (see deferred question)
- `create-group-action.ts`: remove `slackEnabled` and `slackChannelSlug` from the `db.insert(group).values(...)` call; remove related imports
- `create-group-dialog.tsx`: remove the entire Slack `Controller` block, all `slackEnabled`/`slackChannelSlugValue`/`slackSlugUnlocked`/`slackAvailability`/`debouncedSlackSlug`/`slackQuery` state variables and their `useEffect`/`useQuery` usages; remove the `checkSlackSlugAction` import; simplify `isSlackValid`/`canSubmit` logic
- `check-integration-actions.ts`: delete `checkSlackSlugAction` entirely; remove the `checkSlackChannelSlugAvailability` import from `@/db/groups` and `slackChannelExists` import from `@/lib/slack`; keep `checkGoogleEmailPrefixAction`
- `src/db/groups.ts`: delete `checkSlackChannelSlugAvailability` function
- `src/components/groups-table.tsx`: remove the `{ id: "slackChannel", header: "Slack Channel", ... }` column definition (currently renders `#{slug}` — this column is dead UI after Slack removal)

**Patterns to follow:**
- Remaining Google email `Controller` block in `create-group-dialog.tsx` for the final UI shape

**Test scenarios:**
- Happy path: group creation form renders with Google email prefix field only — no Slack section visible
- Happy path: submitting the form with `emailEnabled = true` and a valid Google prefix — action inserts `emailEnabled`, `googleEmailPrefix`, no Slack fields
- Edge case: submitting the form with `emailEnabled = false` — action inserts without any integration fields
- Error path: if the `.refine()` validator for "at least one integration" is kept, submitting with no integration enabled should produce a validation error

**Verification:**
- No `checkSlackSlugAction` export in `check-integration-actions.ts`
- No `checkSlackChannelSlugAvailability` in `src/db/groups.ts`
- `create-group-dialog.tsx` renders without Slack UI elements in dev

---

### U5. Remove Slack webhook, Inngest handler, and library

**Goal:** Delete the Slack event webhook route and its Inngest handler; prune groups-specific functions from `slack.ts`; deregister `handleSlackEvent` and remove the `slackUserJoined` event type; remove `SLACK_SIGNING_SECRET` from env; remove Slack webhook verification helpers; update `.env.example`.

**Requirements:** R6, R7

**Dependencies:** U1, U2, U3, U4 (all Slack imports in reconcile.ts, sync-groups-cron.ts, create-group.ts, and UI must be removed before slack.ts is pruned)

**Files:**
- Delete: `src/app/api/slack/events/route.ts`
- Delete: `src/inngest/slack-user-joined.ts`
- Modify: `src/lib/slack.ts` (prune groups-specific exports; keep `slack` WebClient)
- Modify: `src/lib/verify-request.ts` (remove Slack verification functions)
- Modify: `src/lib/inngest.ts` (remove `slackUserJoined` event type)
- Modify: `src/inngest/index.ts`
- Modify: `src/env.ts`
- Modify: `.env.example`

**Approach:**
- Delete `route.ts` and `slack-user-joined.ts`
- `src/lib/slack.ts`: remove `fetchSlackChannelNames`, `slackChannelExists`, `lookupSlackUserIdByEmail`, `inviteToChannel`, `kickFromChannel` and their related imports/exports; keep the `slack` WebClient export (used by membership onboarding)
- `src/lib/verify-request.ts`: remove `verifySlackRequest`, `isValidSlackRequest`, and `SlackRequestVerificationOptions`; keep the GoCardless verification functions
- `src/lib/inngest.ts`: remove the `slackUserJoined` event type entry from the `events` object
- `src/inngest/index.ts`: remove `import { handleSlackEvent } from "./slack-user-joined"` and remove `handleSlackEvent` from `inngestFunctions`
- `src/env.ts`: remove only `SLACK_SIGNING_SECRET` (from schema, `server` object, and `runtimeEnv`); leave `SLACK_BOT_TOKEN` and `DISABLE_SLACK` intact
- `.env.example`: remove the `SLACK_SIGNING_SECRET` entry; leave `SLACK_BOT_TOKEN` and `DISABLE_SLACK`

**Patterns to follow:**
- Remaining Inngest function registrations in `index.ts`
- Remaining GoCardless verification functions in `verify-request.ts` as shape reference

**Test scenarios:**
- Integration: after removal, `npm run dev` starts without errors; the Inngest dev server lists all remaining functions without `handleSlackEvent`
- Edge case: a POST to `/api/slack/events` returns 404 (route no longer exists)
- Integration: membership onboarding still compiles and runs — `get-slack-status-action.ts` can import `{ slack }` and read `env.DISABLE_SLACK` without errors
- Verification: `src/lib/inngest.ts` has no `slackUserJoined` entry; `src/lib/verify-request.ts` has no Slack exports

**Verification:**
- `src/inngest/index.ts` exports `inngestFunctions` with no `handleSlackEvent`
- `src/lib/slack.ts` still exports `slack` (WebClient) but no groups-related functions
- TypeScript compiles without errors across the full project
- No remaining `import ... from "@/lib/slack"` in reconcile, cron, create-group, or UI files

---

### U6. Drop Slack columns from group schema and migrate

**Goal:** Remove the three Slack-specific columns from the Drizzle group schema and generate + apply the DROP COLUMN migration.

**Requirements:** R1, R9

**Dependencies:** U1, U2, U3, U4 (all code referencing these columns must be removed first)

**Files:**
- Modify: `src/db/schema/group.ts`
- Create: `drizzle/XXXX_*.sql` (generated migration — do not edit manually)
- Modify: `drizzle/meta/_journal.json` (auto-updated by `db:generate`)

**Approach:**
- Remove `slackEnabled`, `slackChannelSlug`, and `slackChannelId` field definitions from the `group` table in `src/db/schema/group.ts`
- Run `npm run db:generate` to generate the DROP COLUMN migration
- Run `npm run db:migrate` to apply it

**Patterns to follow:**
- CLAUDE.md migration workflow: edit schema → `db:generate` → `db:migrate`. Never manually edit the generated `.sql` file.

**Test scenarios:**
- Test expectation: none — this is a schema/migration-only change with no behavioral logic. Correctness is verified by compilation and migration success.

**Verification:**
- `src/db/schema/group.ts` contains no `slackEnabled`, `slackChannelSlug`, or `slackChannelId` fields
- `npm run db:generate` produces a migration with `ALTER TABLE "group" DROP COLUMN` for all three columns
- `npm run db:migrate` applies successfully
- TypeScript compiles without errors across the full project

---

## System-Wide Impact

- **Interaction graph:** `pushAddToIntegrations` and `pushRemoveToIntegrations` are called from `sync-group-member-integrations.ts` and `sync-groups-cron.ts`. Both will continue to work correctly as Google-only after U1.
- **Error propagation:** The Slack error paths (channel archived, user not in workspace, rate limit) are removed. No new error paths are introduced.
- **State lifecycle risks:** Existing rows in the `group` table that have `slackChannelId` set will lose that column when the migration runs. This data is intentionally discarded. No cleanup script needed — the feature is being removed, not migrated.
- **API surface parity:** The `/api/slack/events` route is deleted. No equivalent replacement is needed. The membership Slack status check (`/api/...getSlackStatusAction`) is not affected.
- **`slack.ts` callers after pruning:** Only `membership/get-slack-status-action.ts` will import from `@/lib/slack` after U5. No groups-related file should import it.
- **Integration coverage:** `cockpitUserUpdated` continues to trigger `reconcileUserGroupMembershipWorkflow` from five remaining send sites. Verified before planning.
- **Unchanged invariants:** The `usersToGroups.integrationsSynced` flag and all Google Groups sync paths remain unmodified.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Groups with live `slackChannelId` values in production will lose that column | Data is intentionally discarded; Slack sync is being removed by design |
| `SLACK_SIGNING_SECRET` is currently `z.string().min(1)` — required, not optional | Removing it from the schema is safe: the var simply stops being validated. Any environment that still has the var set will run fine; any environment missing it was already failing startup before this change. No transition step needed. |
| A future reader re-adds Slack via `slack.ts` after it's deleted | The deletion is the intent; no stub or comment needed |
| TypeScript compilation errors if any Slack reference is missed | Run `tsc --noEmit` after U1–U5 before proceeding to U6 |
| Future developer adds groups functions back to `slack.ts` not knowing it was intentionally pruned | The file is kept for membership use — the pruning is the intent, not an oversight |
