---
title: "fix: Groups feature moderate issues"
type: fix
status: active
date: 2026-05-18
---

# fix: Groups feature moderate issues

## Summary

Addresses five P2 findings from the groups feature code review. Two findings (#12, #13) were already resolved by the previous session's work. The remaining five cover: batching N individual DELETEs in the reconcile loop, removing dead code in the Google Group creation step, moving the hardcoded `start-berlin.com` domain to an env var, splitting reconcile into DB + integration phases so integration failures are independently retryable via Inngest, and gracefully handling the slug unique-violation race that can surface despite the DB constraint.

---

## Requirements

- R1. `removeUserFromGroup` calls in the reconcile loop are replaced with a single batch DELETE.
- R2. Dead `result.status !== 200` check in the Google Group creation step is removed.
- R3. The Google Workspace email domain is read from `env.GOOGLE_WORKSPACE_DOMAIN`, not hardcoded.
- R4. Integration push failures (Slack, Google) do not silently diverge external state from the DB; each push is independently retryable via Inngest.
- R5. The `createGroupAction` handles a slug unique-violation error with a user-readable message instead of surfacing an unhandled DB exception.

## Scope Boundaries

- Does not add LIMIT to `findUsersNotInGroupByCriteria` — the route using it was deleted; the server action is permission-gated.
- Does not fix the Google Group creation step's retry idempotency gap (name_taken recovery) — out of scope, separate concern from #11.
- Does not change the `syncGroupIntegrationsWorkflow` (`create-group.ts`) integration push logic — that function creates channels/groups when they don't exist yet; the retry fix (#15) targets the membership reconcile path only.

---

## Context & Research

### Relevant Code and Patterns

- `src/lib/groups/reconcile.ts` — contains both reconcile functions and integration push helpers; core file for U1, U4.
- `src/db/groups.ts` — `removeUserFromGroup`, `addUsersToGroup`; U1 adds `removeUsersFromGroup`.
- `src/inngest/create-group.ts` — Google Group creation step; U2 and U3.
- `src/env.ts` — `@t3-oss/env-nextjs` with `createEnv`; U3 adds `GOOGLE_WORKSPACE_DOMAIN`.
- `src/inngest/sync-groups-cron.ts` — calls `reconcileGroupMembership` inside `step.run`; U4 adds integration push step.
- `src/inngest/reconcile-user-group-membership.ts` — calls `reconcileUserGroupMembership` inside `step.run`; U4 adds integration push steps.
- `src/app/(authenticated)/(app)/groups/create-group-action.ts` — `checkSlugAvailability` + `db.insert`; U5 wraps insert in try/catch for unique-violation.

### Institutional Learnings

- Prior session (U1): Inngest step idempotency pattern — DB writes before the risky call must be guarded with `IS NULL` or `ON CONFLICT DO NOTHING` so retries are no-ops.
- Drizzle `inArray` is available for batch WHERE clauses; already imported in reconcile.ts.

---

## Key Technical Decisions

- **U4 — split, not wrapper**: `reconcileGroupMembership` and `reconcileUserGroupMembership` become pure DB functions. Integration pushes are lifted out and called in separate `step.run()` blocks by the Inngest callers. This is the correct Inngest idiom: the retry boundary is the step, not a try/catch inside a step.
- **U4 — enrich ReconcileResult with email**: The callers need user emails and group integration config to push integrations without extra DB queries. `ReconcileResult` is extended to carry `addedUsers: { id, email }[]`, `removedUsers: { id, email }[]`, and `group: { slackChannelId, googleGroupEmail }`.
- **U4 — no per-user fan-out events**: Rather than firing N events via `step.sendEvent`, callers run a single `step.run("push-integrations-${groupId}")` after the DB reconcile step. This keeps step counts manageable and is semantically correct — integration sync for a group is one logical unit.
- **U5 — catch at action level**: The UNIQUE constraint on `group.slug` is already present in the schema. The fix catches the Postgres unique-violation error (`23505` / message includes "unique") in `createGroupAction` and surfaces a user-readable message matching the existing slug-taken copy.

---

## Open Questions

### Resolved During Planning

- **Are #12 and #13 still open?** No — `search-by-criteria` route was deleted (U8 prior session), and both components now use `department.enumValues`/`userStatus.enumValues`. Not planned here.
- **Does a UNIQUE constraint on `group.slug` already exist?** Yes — `slug: text("slug").notNull().unique()`. U5 only needs error handling in the action.
- **Does `GOOGLE_WORKSPACE_DOMAIN` already exist in env.ts?** No. U3 adds it.

### Deferred to Implementation

- Exact Postgres error code/message matching for the slug unique-violation: implementer should check whether Drizzle surfaces the raw `PgError` or wraps it, and match accordingly.

---

## Implementation Units

### U1. Batch DELETE for reconcile removes

**Goal:** Replace the N-round-trip loop in `reconcileGroupMembership` with a single batch DELETE.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/db/groups.ts`
- Modify: `src/lib/groups/reconcile.ts`

**Approach:**
- Add `removeUsersFromGroup(userIds: string[], groupId: string)` to `db/groups.ts` using `inArray(usersToGroups.userId, userIds)` + `eq(usersToGroups.groupId, groupId)`. Guard with `if (userIds.length === 0) return`.
- In `reconcileGroupMembership`, replace `for (const m of toRemove) { await removeUserFromGroup(...) }` with a single `await removeUsersFromGroup(toRemove.map(m => m.userId), groupId)`.
- Leave `removeUserFromGroup` (single-user) in place — it is used by the manual remove action.

**Patterns to follow:**
- `addUsersToGroup` in `src/db/groups.ts` — same pattern: length guard, `inArray`/bulk insert.

**Test scenarios:**
- Happy path: reconcile with 3 users to remove → single DELETE issued, all 3 removed from DB.
- Edge case: `toRemove` is empty → `removeUsersFromGroup` returns early, no query issued.

**Verification:**
- `toRemove.length > 1` in a test triggers one DELETE statement (not N). DB state matches expected membership.

---

### U2. Remove dead Google Group status check

**Goal:** Delete the unreachable `if (result.status !== 200)` block after `admin.groups.insert`.

**Requirements:** R2

**Dependencies:** None

**Files:**
- Modify: `src/inngest/create-group.ts`

**Approach:**
- Remove lines 104–108 (`if (result.status !== 200) { throw ... }`). The googleapis client throws `GaxiosError` on non-2xx responses before execution reaches that check. The surrounding try/catch already handles the error.
- No functional change — this is dead code removal.

**Test scenarios:**
- Test expectation: none — pure dead code removal with no behavioral change.

**Verification:**
- File compiles; the step logic is identical minus the dead block.

---

### U3. Move hardcoded Google Workspace domain to env var

**Goal:** Replace `@start-berlin.com` literals in `create-group.ts` with `env.GOOGLE_WORKSPACE_DOMAIN`.

**Requirements:** R3

**Dependencies:** None

**Files:**
- Modify: `src/env.ts`
- Modify: `src/inngest/create-group.ts`
- Modify: `.env.example`

**Approach:**
- Add `GOOGLE_WORKSPACE_DOMAIN: z.string().min(1)` to `env.ts` `server` block and `runtimeEnv` mapping (alongside the other `GOOGLE_*` vars).
- Add `GOOGLE_WORKSPACE_DOMAIN=start-berlin.com` to `.env.example`.
- In `create-group.ts`, replace `\`${g.slug}@start-berlin.com\`` (×2: the `DISABLE_GOOGLE_WORKSPACE` warn log and the `groupEmail` assignment) with `` `${g.slug}@${env.GOOGLE_WORKSPACE_DOMAIN}` ``.

**Patterns to follow:**
- Existing `GOOGLE_APPLICATION_CREDENTIALS_BASE64` entry pattern in `src/env.ts`.

**Test scenarios:**
- Test expectation: none — configuration extraction with no behavioral change given a valid env var.

**Verification:**
- `env.ts` validates at startup; if `GOOGLE_WORKSPACE_DOMAIN` is unset, app fails fast on boot. Both `@start-berlin.com` string literals are gone from `create-group.ts`.

---

### U4. Split reconcile into DB phase + integration phase

**Goal:** Remove integration push calls from `reconcileGroupMembership` and `reconcileUserGroupMembership`, enrich `ReconcileResult` with the data callers need, and push integrations in separate `step.run()` blocks in the Inngest functions so each push is independently retryable.

**Requirements:** R4

**Dependencies:** U1 (both touch reconcile.ts; land U1 first to avoid conflict)

**Files:**
- Modify: `src/lib/groups/reconcile.ts`
- Modify: `src/inngest/sync-groups-cron.ts`
- Modify: `src/inngest/reconcile-user-group-membership.ts`

**Approach:**

**reconcile.ts changes:**
- Extend `ReconcileResult` to include `addedUsers: { id: string; email: string }[]`, `removedUsers: { id: string; email: string }[]`, and `group: { id: string; slackChannelId: string | null; googleGroupEmail: string | null }`.
- Remove `pushAddToIntegrations` and `pushRemoveToIntegrations` calls from both reconcile functions (keep the helper functions themselves — callers will use them).
- Remove the try/catch wrappers around those calls.
- Export `pushAddToIntegrations` and `pushRemoveToIntegrations` so Inngest callers can use them directly. Remove the error-swallowing try/catch from inside each helper — let errors propagate so `step.run` sees the failure and Inngest retries.
- The reconcile functions now return the enriched `ReconcileResult`.

**sync-groups-cron.ts changes:**
- After `step.run(\`reconcile-${g.id}\`)`, add a conditional `step.run(\`push-integrations-${g.id}\`)` that calls `pushAddToIntegrations` and `pushRemoveToIntegrations` for each user in `result.addedUsers` / `result.removedUsers`.
- Only fire the step when `result.addedUsers.length > 0 || result.removedUsers.length > 0`.

**reconcile-user-group-membership.ts changes:**
- After the `step.run("reconcile-db-user")`, loop over results and fire a `step.run(\`push-integrations-${result.groupId}\`)` for each group that had changes.

**Technical design:**
> Directional guidance only — not implementation specification.

```
sync-groups-cron (for each group):
  step.run("reconcile-db-<id>")    → pure DB: returns enriched ReconcileResult
  step.run("push-integrations-<id>") → calls push helpers; throws on failure → Inngest retries this step
  
reconcile-user-group-membership (for one user):
  step.run("reconcile-db-user")   → pure DB: returns ReconcileResult[]
  for each changed group:
    step.run("push-integrations-<groupId>") → push helpers; throws on failure → Inngest retries
```

**Patterns to follow:**
- `sync-groups-cron.ts` existing fan-out pattern: parallel step dispatch with separate steps per group.
- `create-group.ts` U1 pattern: separate `step.run("persist-slack-channel-id")` after the channel creation step.

**Test scenarios:**
- Integration path: reconcile DB succeeds; Slack push throws → integration step fails, Inngest retries push step; DB state is unchanged on retry (idempotent); Slack invite called again.
- Happy path: reconcile adds 2 users → integration step called once for both; result includes `addedUsers` with emails.
- Edge case: zero changes → integration step is not fired.
- Error path: Google Group push fails → does not prevent Slack push from succeeding (each integration is pushed in the same step but the step retries atomically).

**Verification:**
- `reconcileGroupMembership` and `reconcileUserGroupMembership` contain no Slack/Google calls.
- Integration push helpers no longer have the error-swallowing try/catch.
- `step.run("push-integrations-…")` appears in both Inngest callers.
- If a push helper throws, the Inngest step fails (visible in Inngest dashboard) and retries.

---

### U5. Gracefully handle slug unique-violation in createGroupAction

**Goal:** Catch the Postgres unique-constraint error thrown by `db.insert(group)` when a concurrent create races to the same slug, and surface a user-readable message.

**Requirements:** R5

**Dependencies:** None

**Files:**
- Modify: `src/app/(authenticated)/(app)/groups/create-group-action.ts`

**Approach:**
- Wrap the `db.insert(group)` call in a try/catch.
- If the caught error message includes `"unique"` (or the Postgres error code is `23505`), throw a user-readable error matching the existing copy: `"This slug is already taken. Please choose another one."`.
- Re-throw all other errors unchanged.
- The `checkSlugAvailability` pre-check can stay as-is — it provides a fast, friendly validation path for the normal case; the catch handles the rare race.

**Patterns to follow:**
- `new-user-workflow.ts` GaxiosError catch pattern: catch, check `error.message`, throw `NonRetriableError` or a human-readable equivalent.

**Test scenarios:**
- Error path: two concurrent creates with the same slug — second insert throws unique violation → action returns the slug-taken message, not a 500.
- Happy path: insert with a unique slug succeeds → group created, `groupSyncRequested` event fired.

**Verification:**
- Simulating a unique-violation (e.g., pre-inserting a group with the same slug) results in the user-readable "slug is already taken" error from the action, not an unhandled exception.

---

## System-Wide Impact

- **U4 — step count**: Each group or user-group combination with changes now produces 2 Inngest steps instead of 1. For a cron run reconciling 10 groups with changes, that is 20 steps. Acceptable.
- **U4 — retry safety**: DB operations in `addUsersToGroup` / `removeUsersFromGroup` use `ON CONFLICT DO NOTHING` / idempotent DELETE. Retrying the DB reconcile step is safe.
- **U4 — integration push idempotency**: Slack `inviteToChannel` and `kickFromChannel`, and Google `addGroupMember` / `removeGroupMember`, are expected to be idempotent (inviting an already-member or removing a non-member are no-ops in both APIs). Implementer should verify and log benign no-op responses rather than throwing.
- **U3 — boot-time validation**: Adding a required env var causes the app to fail fast if `GOOGLE_WORKSPACE_DOMAIN` is absent. This is intentional and aligns with the existing pattern for required Google vars.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| U4 changes `ReconcileResult` shape — callers may not expect the new fields | Both callers (cron, user-updated workflow) are in this plan's scope; no external consumers of `ReconcileResult` found |
| U3 requires setting `GOOGLE_WORKSPACE_DOMAIN` in all environments (staging, prod) before deploying | Add to `.env.example`; document in commit message; deploy env var before code |
| U4 integration push step names include the groupId — Inngest step memoisation uses the step name as a cache key | Step names are deterministic per run; no collision risk |
| Slack/Google idempotency edge cases on retry may surface errors for "already member" responses | Implementer should check API error codes and treat known benign errors as non-fatal (log only, don't rethrow) |

---

## Sources & References

- Previous plan: `docs/plans/2026-05-18-001-fix-groups-feature-critical-and-high-issues-plan.md`
- Related code: `src/lib/groups/reconcile.ts`, `src/inngest/sync-groups-cron.ts`, `src/inngest/reconcile-user-group-membership.ts`, `src/inngest/create-group.ts`, `src/env.ts`
