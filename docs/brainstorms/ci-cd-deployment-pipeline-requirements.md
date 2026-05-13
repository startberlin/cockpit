# CI/CD Deployment Pipeline — Requirements

**Date:** 2026-05-13
**Status:** Ready for implementation

---

## Goal

Replace ad-hoc Vercel auto-deployments with a GitHub Actions pipeline that controls the full release sequence for both staging and production. The key invariant: the app must be healthy and migrations must succeed before any domain receives traffic from a new deployment.

```
push to branch
→ GitHub Actions
→ Vercel build (no domain yet)
→ health check on generated deployment URL
→ database migration
→ domain alias / production promotion
→ Inngest sync
```

---

## Branch and environment model

| Git branch   | Vercel environment | Domain                            | DB                        | Inngest             |
|--------------|--------------------|-----------------------------------|---------------------------|---------------------|
| `main`       | Preview            | staging.cockpit.start-berlin.com  | PlanetScale staging branch | staging environment |
| `production` | Production         | cockpit.start-berlin.com          | PlanetScale prod branch   | production environment |

---

## What Claude implements

### 1. `.github/workflows/deploy-staging.yml`

Triggered on push to `main`. Sequence:

1. Checkout + `npm ci`
2. `npm test`
3. `vercel deploy --target=preview --yes` → capture deployment URL
4. `curl --fail <deployment-url>/api/health`
5. `npm run db:migrate` with `DATABASE_URL=${{ secrets.STAGING_DATABASE_URL }}`
6. `vercel alias set <deployment-url> staging.cockpit.start-berlin.com`
7. `curl --fail https://staging.cockpit.start-berlin.com/api/health`
8. Inngest sync via `POST https://api.inngest.com/v2/apps/$INNGEST_APP_ID/syncs`

Concurrency group `staging-db-app-inngest` with `cancel-in-progress: false` (no queuing races).

### 2. `.github/workflows/deploy-production.yml`

Triggered on push to `production`. Sequence:

1. Checkout + `npm ci`
2. `npm test`
3. `vercel deploy --prod --skip-domain --yes` → capture deployment URL
4. `curl --fail <deployment-url>/api/health`
5. `npm run db:migrate` with `DATABASE_URL=${{ secrets.PRODUCTION_DATABASE_URL }}`
6. `vercel promote <deployment-url>`
7. `curl --fail https://cockpit.start-berlin.com/api/health`
8. Inngest sync via `POST https://api.inngest.com/v2/apps/$INNGEST_APP_ID/syncs`

Concurrency group `production-db-app-inngest` with `cancel-in-progress: false`.

### 3. `vercel.json`

Add `"git": { "deploymentEnabled": false }` — repository-level guard against Vercel auto-deploying from Git pushes.

The `buildCommand` override was already removed on `main`; no further change needed there.

### 4. `src/app/api/health/route.ts`

New Next.js App Router route handler:

```json
{ "ok": true, "commit": "<VERCEL_GIT_COMMIT_SHA>" }
```

`VERCEL_GIT_COMMIT_SHA` is a Vercel system variable injected at build time. Returns `null` locally. No auth required — this is a public liveness endpoint.

### 5. `package.json` script additions

| Script | Command |
|--------|---------|
| `env:pull` | `vercel env pull .env.local` |
| `db:check` | `drizzle-kit check --config=drizzle.config.ts` |

---

## What you configure (external systems)

Work through these before the first deploy workflow can run.

### A. Vercel dashboard

1. **Project → Settings → Git**
   - Production Branch: `production`
   - Automatic Deployments: **disabled**

2. **Project → Settings → Domains**
   - Confirm `staging.cockpit.start-berlin.com` is present and not set to auto-follow a branch (auto-following is moot once deployments are disabled, but worth verifying)

### B. GitHub: environments and secrets

Create two environments in **Settings → Environments**:

**`staging`** — no approval gate needed

**`production`** — add required reviewer(s) so production jobs need manual approval before accessing secrets

**Repository-level secrets** (Settings → Secrets → Actions):

| Secret | Value |
|--------|-------|
| `VERCEL_TOKEN` | Vercel personal access token |
| `VERCEL_ORG_ID` | From `.vercel/project.json` or Vercel dashboard |
| `VERCEL_PROJECT_ID` | From `.vercel/project.json` or Vercel dashboard |

**`staging` environment secrets:**

| Secret | Value |
|--------|-------|
| `STAGING_DATABASE_URL` | PlanetScale staging branch direct connection string |
| `STAGING_INNGEST_API_KEY` | Inngest staging environment event key |
| `STAGING_INNGEST_APP_ID` | Inngest staging app ID |

**`production` environment secrets:**

| Secret | Value |
|--------|-------|
| `PRODUCTION_DATABASE_URL` | PlanetScale production branch direct connection string |
| `PRODUCTION_INNGEST_API_KEY` | Inngest production event key |
| `PRODUCTION_INNGEST_APP_ID` | Inngest production app ID |

### C. Inngest

1. Create a **staging custom environment** in the Inngest dashboard (separate from production)
2. Collect event key and app ID for staging
3. If the Vercel × Inngest integration is currently active, **disable it** — CI will sync Inngest manually after each deploy

### D. PlanetScale

Ensure staging and production Postgres branches exist and you have direct connection strings for each. Set these as `STAGING_DATABASE_URL` / `PRODUCTION_DATABASE_URL` in GitHub secrets.

### E. Git

Create the `production` branch (from current `main` once ready for first production deploy):

```bash
git checkout -b production
git push origin production
```

---

## Migration contract

Migrations run **while the old app still serves the domain**. The new app only receives traffic after migrations succeed. Therefore, every migration committed to `main` or `production` must be backward-compatible with the currently live version.

**Safe before promotion:** add table, add nullable column, add index, add enum value the old code ignores.

**Unsafe before promotion:** drop column the old app reads, rename column directly, make nullable column NOT NULL without backfill.

---

## Failure modes

| Failure point | Consequence | Recovery |
|---|---|---|
| Vercel build fails | No migration, no alias, no sync | Fix and repush |
| Health check on deployment URL fails | No migration, no alias, no sync | Fix and repush |
| Migration fails | New deployment exists but domain still points to old version | Fix migration, repush |
| Alias/promote fails after migration | DB changed, old app still serves — okay because migrations are forward-compatible | Fix config, rerun alias step |
| Inngest sync fails | App is deployed and serving traffic; Inngest config may be stale | Rerun sync or sync via Inngest dashboard |

---

## Local development

After setup, the local workflow is:

```bash
npx vercel link             # one-time
npm run env:pull            # pulls shared dev env into .env.local
cp .env.example .env.development.local  # fill personal values
npm run dev                 # Next.js + Inngest dev server
```

`.env.example` documents developer-owned values only (database URL for local Postgres, Slack app credentials, GoCardless sandbox keys). Vercel-managed shared values (`GOOGLE_CLIENT_ID`, `RESEND_API_KEY`, etc.) are pulled via `env:pull` and should not be in `.env.example`.
