# START Jobboard

Cockpit manages employer submissions, private drafts and reviewed listings. Website V2 renders the public board and application links through the scoped Jobboard API. Only Cockpit connects to PostgreSQL.

The module follows Cockpit's internal-app convention: Tools launcher, its own AppShell, prefixed app tables in the existing PostgreSQL database, and independent permission checks in every server action. Active Partnerships members, delegated Jobboard editors and Cockpit admins can manage drafts and review submissions. Partnerships heads and co-leads can also open the app when their own department is elsewhere. Cockpit's active authority statuses are member and supporting alumnus.

## Local development

Use a dedicated local PostgreSQL database for editing. Integration tests use a separate disposable database named `jobboard_test`. Never point local development login or seed commands at production. Start only Next.js for manual testing, not the combined `npm run dev` command that also starts Inngest.

1. `npm ci`
2. Create `.env` using the core `.env.example`. Set `DATABASE_URL` to your isolated database.
3. Set `ENABLE_DEV_LOGIN=true`, `DISABLE_GOOGLE_WORKSPACE=true`, `DISABLE_EMAIL=true`, and `DISABLE_SLACK=true` locally. Core AWS/OAuth fields can use local placeholder values when their integrations are disabled. Do not copy real credentials from another checkout.
4. Generate distinct random keys of at least 32 characters for `JOBBOARD_READ_API_KEY` and `JOBBOARD_SUBMIT_API_KEY`. Configure each key on both servers. `JOBBOARD_METRICS_API_KEY` is optional and needs its own distinct value for an integration that sends request counts. The website controls collection separately. Removing or changing a key revokes the old credential after the environment is reloaded.
5. `npm run db:migrate`
6. `npm run jobboard:seed` creates only local demonstration records and test accounts.
7. `npm run next:dev -- --hostname 127.0.0.1 --port 3011`
8. Point the public app on port 3012 at `COCKPIT_API_URL=http://localhost:3011/api/jobboard/v1`. Set Cockpit's `JOBBOARD_PUBLIC_URL` to `http://localhost:3012/jobs` for Website V2 or `http://localhost:3012` for the older standalone board.

The Settings page reports whether service capabilities are configured, never the values of keys. Live addresses and infrastructure are configured only during a separate release.

## Editorial workflow

Create a company and its private contacts, then create a role. Saving a draft does not publish it. In the job editor, "Add UTM parameters" appends missing START attribution to the application URL. The defaults are `utm_source=start_berlin`, `utm_medium=referral` and `utm_campaign=jobboard`. Existing partner parameters and URL fragments are preserved. Publication snapshots the reviewed job content and public company fields together. Later edits to the company or job do not silently change the published snapshot; publish the updated job after review.

Partnerships heads and co-leads with a Partnerships assignment can publish or change a live listing, as can Cockpit admins and super admins. Editors can archive a draft that has never been published. A concurrent publication invalidates an editor's archive request.

Every publication requires a review confirmation, review notes and a future expiry (60 days suggested). Review the complete text for discrimination, accurate location and permitted working countries, valid application destinations, compensation conditions and publishing rights. Unpaid roles and international work require a case-specific explanation. Missing disclosure is different from unpaid work.

For an active listing, use its expiry-date button to change the date or extend it by 30 or 60 days. This updates only the published expiry and retains unpublished draft changes. Concurrent publication changes require a reload. Paused, closed and expired listings require a fresh publication review.

Pause and close remove the role from active listings. Expiry is enforced when reading public data, independently of the maintenance schedule. Pausing hides the original public URL and its application link. Closed and expired roles keep a closed detail page. To publish again, explicitly review and publish a fresh version.

Active department heads and co-leads across all departments and the Legal Board receive incoming submission notifications. Recipients can open their own notification while they still hold an eligible position. Editing the submission requires separate Jobboard access.

Employer submissions remain private and pending until reviewed. Acceptance creates a draft against the selected company; it does not modify that company's contacts or publish a role. Review potential duplicates before accepting. Rejecting does not erase the review history.

## Verification

- `npm run test:jobboard` runs pure contract, service-auth and permission tests.
- `npm run test:jobboard:integration` uses the explicitly configured `JOBBOARD_TEST_DATABASE_URL` and exercises PostgreSQL transactions. The database must be disposable and local.
- `npm run test:jobboard:history` checks an unsaved job editor in Chromium, Firefox and WebKit. Install the browsers with `npx playwright install chromium firefox webkit`. Set `JOBBOARD_TEST_COCKPIT_URL` to the loopback address of a running Cockpit with the local editor test account.
- `npm run jobboard:check-contract` compares the exact shared contract with the sibling public project.
- `npm run test:jobboard:live` verifies both running local servers using disposable fixtures, including submission retries, private-field isolation, public draft stability and blocked application redirects after closing. It refuses remote hosts and removes its own fixtures afterwards. Enable request metrics in the public test configuration when checking ingestion.
- `npx tsc --noEmit`, `npm run build`, and targeted Biome checks validate the implementation.
- Test public and internal pages together, including a real submission, review, publication, private-field isolation, expiry, service-key rejection, repeat delivery and metrics failure.
- Inspect the public browser for cookies, local/session storage, third-party analytics and unexpected requests. Test the iframe on a permitted parent and reject an unrelated parent.

## Integration and release

The Cockpit and public applications deploy separately. Only the existing Cockpit deployment owns Cockpit workflows. Preview testing must use isolated data and disabled integrations. Apply schema migrations before exposing new routes to traffic.

Cockpit owns the PlanetScale PostgreSQL database. The deployment workflows apply migrations to the matching branch using `DATABASE_URL_STAGING` or `DATABASE_URL_PROD`. The Jobboard runtime uses the shared Cockpit connection.

Generate additions against the current Cockpit migration history. Jobboard's `0062_jobboard.sql` follows `0061_member_participation_pause.sql`. It adds eight `jobboard_*` tables with their indexes and constraints, and the `jobboard_editor` access grant. Migration `0063_jobboard_submission_notifications.sql` then adds the personal inbox and unread lookup index.
