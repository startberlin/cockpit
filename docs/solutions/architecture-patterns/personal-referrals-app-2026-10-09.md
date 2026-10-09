---
title: "Personal recruiting referrals"
date: "2026-10-09"
category: architecture-patterns
module: "referrals"
problem_type: architecture
tags: [apps, tally, referrals, authorization, idempotency]
---

# Personal recruiting referrals

The app at `/referrals` gives active members and supporting alumni one permanent code and a count of completed recruiting applications. It uses the existing Cockpit app shell and components. Recruiting data is separate from legal membership applications.

## Access and identity

`apps.referrals.access` follows the existing active-authority statuses. Own queries bind the member to the current authenticated session. `apps.referrals.overview` permits super_admin, department heads, department co-leads and head_of_finance. It does not permit ordinary members or unrelated grants.

Codes are random, opaque and stored once in `referrals_link`. There is no edit or regeneration action. `/r/<code>` resolves publicly and adds the current campaign server-side. Caller-supplied attribution parameters are ignored. Deleted owners become null while codes stay reserved. The overview retains former members' counts as an aggregate without exposing their names.

## Credentials and activation

The existing `TALLY_API_KEY` is sufficient when it has access to the form and webhook API. No new environment variable is required. The webhook signing secret is derived with HMAC-SHA256 and a fixed app-specific context, so the API key itself is never used as the webhook secret. `TALLY_REFERRALS_WEBHOOK_SECRET` remains an optional independent override. Rotating the API key requires refreshing the configured webhook unless an override is used.

On 9 October 2026, a dedicated `START Cockpit Referrals` key was created in the existing Tally account without a paid plan change. It was saved to ignored `.env.local` with mode 600 and to the existing Vercel `cockpit` project's `TALLY_API_KEY` Secret for Production and Preview. Existing keys were retained. Read-only API checks confirmed access to Me9Xlp's form and questions, and to the webhook list with the pinned API version. The current form still has no referral hidden fields. Vercel requires a new deployment before the stored key takes effect.

1. Deploy the generated migrations and app. Confirm the intended `NEXT_PUBLIC_COCKPIT_URL` and existing API key.
2. Add and publish Tally hidden fields named `ref` and `campaign`. Preserve the existing application form and its Notion integration. Check the Notion mapping separately if provenance is also needed there.
3. Copy `config/referrals/batch11-fall2026.example.json` to an operational configuration and replace the placeholder field keys with the actual keys. The batch must already exist if `batchNumber` is set.
4. Run `npm run referrals:setup -- <campaign.json> --dry-run`. This validates field names and keys against the Tally API and checks database configuration without saving records.
5. Run `npm run referrals:setup -- <campaign.json> --connect-webhook`. This provisions every active member and creates or updates only the matching form and Cockpit webhook endpoint. It configures the secret privately through Tally's API without printing it. The connection flag requires the production or staging Cockpit HTTPS hostname. Unrelated integrations are preserved.
6. Verify a real completed test response through the final link, then remove that test response from Tally and the corresponding app record. This live provider test was not performed during local implementation.

The setup is idempotent. Existing campaigns cannot silently change their form, field mapping or window. Overlapping enabled campaigns are refused under a transaction lock. Member changes and a daily Inngest job provision any missing links; an own page visit also repairs a missing own link.

The setup and reconciliation scripts load `.env.local` before `.env`. Externally supplied variables take precedence, so explicit deployment or database credentials are not overridden.

## Intake and reconciliation

`POST /api/tally/referrals` verifies Tally's documented signature over `JSON.stringify(payload)`. It validates the event, rejects oversized bodies, ignores partial or unsupported events, and acknowledges only after the durable write. Database failures return 503 for provider retries.

The unique `(form_id, submission_id)` key deduplicates webhook delivery and API reconciliation. Attribution uses exact hidden-field keys and the submitted timestamp. Opening is inclusive; closing is exclusive. For Batch #11, midnight on 27 October 2026 in Berlin is 26 October at 23:00 UTC after the daylight-saving change. A late delivery of an on-time application can still count.

`npm run referrals:reconcile -- <campaign-id>` requests completed submissions, follows `hasMore`, pins API version `2025-02-01` and feeds the same ingestion function. Repeated runs are safe. Ordinary submissions without a code remain unattributed. The app stores no applicant names, email addresses or application answers.

The count measures completed submissions, not unique people or admitted members. Forwarded links keep the original owner. Self-reported referrer text remains in Tally and does not override the code. Existing applications without recorded codes cannot be automatically credited. URL parameters remain editable at the applicant's end; this system records provenance through known codes, not proof of who sent a message.

## Verification and design

Three compositions were rendered using the same components: compact card, split dashboard and table. The compact card was selected because the count stays prominent and copy/share actions need less mobile height. Only the selected composition remains in source.

The checks cover signatures, malformed payloads, storage failures, concurrent link provisioning, duplicate delivery, campaign mismatches, missing codes, deadline boundaries, owner deletion, campaign rotation, setup dry runs and API backfill. Browser checks cover the actual launcher tab, own-data isolation, Head-of access, copy and share fallbacks, keyboard access, refreshed counts, inactive campaigns and widths from 320 to 1920 pixels in Chromium and WebKit. Local tests use an isolated database and roll back or delete their fixtures.

The final local run passed all 393 tests in 63 suites with no skips, plus all 24 browser tests across desktop Chromium, mobile Chromium and mobile WebKit. TypeScript, lint and the production build passed; lint retains 26 pre-existing warnings. The production build used local placeholder Google OAuth credentials because the preview only uses dev login. The setup's live API dry run correctly refused activation while the hidden fields were absent and changed no data. The QA database contained zero users, campaigns, links and submissions after cleanup.

The Example app was retired on request. Its source, permission, icon and ID prefix were removed. `0059_fuzzy_vance_astro.sql` was generated by Drizzle and removes its table. Historical migrations remain unchanged. Generated Drizzle metadata is excluded from formatting, so the linter cannot rewrite it.

The localhost preview uses a separate database with two demo accounts and no application records. Its referral redirect remains local and does not create live Tally applications. Production data and the live recruiting form were not modified.

Open `http://localhost:3000/auth?redirect=%2Freferrals` and use Dev login with `demo@start-berlin.test` for the Head-of view, or `member@start-berlin.test` for the ordinary member view. No password is needed. These accounts exist only in the isolated preview database; dev login is restricted to development.

References: [Tally hidden fields](https://tally.so/help/hidden-fields), [Tally webhooks](https://tally.so/help/webhooks), [submission API](https://developers.tally.so/api-reference/endpoint/forms/submissions/list), [webhook API](https://developers.tally.so/api-reference/endpoint/webhooks/post).
