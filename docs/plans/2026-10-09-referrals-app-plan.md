# Personal recruiting referrals

## Scope and analysis

Members need one permanent, non-editable link and a count of completed recruiting applications. Recruiting submissions stay separate from legal membership applications. The implementation follows the internal-app convention and reuses the app shell, Avenir typography, cards and buttons.

On 9 October 2026, main and all reachable remote branches containing internal apps contained the same Example app. Other remote branches predate the app structure. No separate app implementation was found to merge. The baseline has 365 passing tests.

The connected Tally form Me9Xlp was inspected without changes. Applications open 5 October and close 26 October 2026 at 23:59 Europe/Berlin. There are no hidden referral fields. Production database and Tally credentials are absent locally. Development and verification use a dedicated localhost PostgreSQL database.

## Decisions

- One random, opaque code per member, stored once. `/r/<code>` is a public redirect, so the shared URL survives campaign changes. Members cannot select, regenerate or edit codes. Deleted owners become null; their codes remain reserved.
- Access follows Cockpit's active authority statuses: member and supporting_alumni. Own data is bound to the authenticated session. The aggregate overview is available to super_admin, department heads, department co-leads and head_of_finance, as requested.
- The current campaign is selected server-side. The redirect ignores caller-supplied referral/campaign parameters and forwards the stored code and configured campaign to the existing application address.
- A signed FORM_RESPONSE stores one record per `(form_id, submission_id)`. The submission timestamp controls the application window, including delayed delivery. Partial responses and unsupported events do not count. Separate completed submissions count separately, including repeat applicants.
- Exact configured hidden-field keys control attribution. Missing codes, unknown codes, campaign mismatches and submissions outside the window remain diagnostic records with no personal credit. The applicant's self-reported referrer does not override the code. Applicant names, email addresses and answers are not stored by this app.
- Webhook and API reconciliation use the same ingestion function. Duplicates never mutate the original attribution. Database failure returns an error so Tally can retry. No independently incremented counter.
- Provision all existing active members at setup, maintain links on member-change events and a daily reconciliation, and create a missing own link on first visit.

## Variations to compare

| Variant | Composition | Decision criterion |
| --- | --- | --- |
| Compact card | One number, one link, copy/share actions | Primary candidate. Direct mobile use, little copy. |
| Split dashboard | Separate statistics and sharing panels | Assess desktop scanability and mobile height. |
| Table | Campaign and link rows | Assess readability and action prominence at narrow widths. |

Use temporary previews made from the same components. Ship only the selected composition. Keep comparison screenshots and the decision in the verification record.

## Implementation order

1. Own branch `codex/referrals-app`; register app, permissions, schema and ID prefixes.
2. Generate the migration with db:generate; apply it with db:migrate against the isolated local database.
3. Implement stable link provisioning, own counts, aggregate diagnostics and public redirect.
4. Add signature-checked Tally webhook and paginated completed-submission reconciliation.
5. Build and compare the three views. Verify the chosen mobile and desktop flows.
6. Run tests, type checks, lint and production build. Remove temporary previews and all test records.

## Production activation

The Example app is retired at the user's request after functional verification. Its source, registry entry, icon, access permission and ID prefix are removed. The release review found that dropping its table before promotion breaks the old app and rollback. Drizzle's own drop command removed the unpublished destructive migration; the retired table schema stays for compatibility. Only the additive referral migration is released.

Deployment and changes to the live recruiting form are separate from local implementation. Add and publish Tally hidden fields `ref` and `campaign`, record their actual webhook keys, then configure the campaign with the existing TALLY_API_KEY. The signing secret is derived from that credential; no new required environment variable is introduced. The setup's explicit `--connect-webhook` flag configures the signed webhook through Tally's API. Verify one real completed test response, including signature and redirect preservation, then delete that response from Tally and the app. Existing applications without recorded codes cannot be automatically credited.

On 9 October the user authorized the full release, GitHub pipeline inspection and independent subagent review. The pipeline remains feature PR → main/staging → deploy PR → production. Vercel Sensitive values cannot be pulled into a local CI build, so Staging uses native cloud builds. Its domain is attached to the reserved `staging` Git reference, which is not a deployment source. A pre-build guard verifies that association; after build and migration the pipeline explicitly assigns the domain. Production keeps its staged deployment and protected promotion. Both workflows verify the exact commit. The existing Inngest function initializes referrals in the production runtime after sync, where the protected credentials are available. For initial activation, open `Provision personal referral links` in Inngest Production and use `All actions > Invoke` with `{"data":{}}`. The internal invocation and subsequent daily cron runs both require `VERCEL_ENV=production` and the canonical Cockpit HTTPS origin. Business-user events, Staging and localhost only provision links. Database tests stay local, as requested. Three independent reviews plus final local tests are required before deployment.

Sources: [internal app convention](../solutions/conventions/internal-app-convention-2026-08-03.md), [Tally hidden fields](https://tally.so/help/hidden-fields), [Tally webhooks](https://tally.so/help/webhooks), [Tally submission API](https://developers.tally.so/api-reference/endpoint/forms/submissions/list).
