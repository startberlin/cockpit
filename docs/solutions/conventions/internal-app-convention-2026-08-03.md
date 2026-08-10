---
title: "Internal app convention"
date: "2026-08-03"
category: conventions
module: "apps"
problem_type: convention
component: documentation
severity: medium
related_components:
  - app_registry
  - permissions
  - database
  - sidebar
tags:
  - apps
  - modularity
  - drizzle
  - authorization
applies_when:
  - Adding a new internal app to Cockpit
  - Adding or changing an entry in the app launcher (/tools)
  - Adding tables owned by an app rather than by the core schema
---

# Internal app convention

## Context

Cockpit hosts more than one application. External SaaS workspaces (Slack, Notion, Gmail, ...) and internal apps built in this repository are both "apps": they appear in the same launcher at `/tools`, share one session, one database, one Inngest endpoint, and one deployment.

Before this convention, `/tools` was 253 lines of hardcoded JSX and there was no way to add an app without editing that file. Apps are now entries in a registry, and an internal app owns its own folder, tables, permission, and routes.

The core layer (`@/lib`, `@/components`, `@/db`) was deliberately **not** moved into a `shared/` tree. New apps import it as-is.

## Where things live

```text
src/lib/apps/
  types.ts        AppDefinition and friends. No renderable assets — see below.
  visibility.ts   AppVisibility + evaluateAppVisibility (pure, isomorphic)
  external.ts     the external SaaS definitions
  registry.ts     the apps array, AppId, and pure selectors
  server.ts       "server-only": getCurrentAuthority, canAccessApp, requireAppAccess

src/components/apps/
  app-icons.tsx   app id -> icon (SVG / lucide)
  launchers.tsx   app id -> dialog component, for external dialog tools
  app-card.tsx, app-launcher.tsx, apps-grid.tsx, app-icon.tsx
  app-shell.tsx, app-shell-sidebar.tsx   the chrome an internal app renders in

src/internal-apps/<slug>/
  app.ts                 the AppDefinition
  db/schema.ts           tables — or a db/schema/ directory for larger apps
  db/queries.ts          "server-only"
  actions/<verb>.ts      "use server" + actionClient + can()
  components/*.tsx
  inngest/*.ts           optional

src/app/(authenticated)/(apps)/            guards only (auth, onboarding, authority)
src/app/(authenticated)/(apps)/<slug>/
  layout.tsx             requireAppAccess("<slug>") + <AppShell appId="<slug>">
  page.tsx, loading.tsx
```

`src/internal-apps/example` is a working reference implementation. It carries a deletion checklist in its `app.ts`.

## Core rules

**The registry holds data, never renderable assets.** No icons, no components, no JSX in `src/lib/apps/` or in an app's `app.ts`. SVG static imports and `lucide-react` both fail to resolve under `node --test`, so putting them in the registry makes it untestable. Icons go in `app-icons.tsx`, dialogs in `launchers.tsx`, both keyed by app id and both typed against `AppId` so a missing entry is a compile error.

**`app.ts` must stay client-safe.** The sidebar is a client component and imports the registry directly. An app's `app.ts` may import only types, `lucide-react`, and plain constants — never `@/db`, `server-only`, or an action file.

**An internal app is a separate product, not a Cockpit section.** Apps live in `(authenticated)/(apps)/`, a *sibling* of `(app)` — not nested inside it — so they do not inherit Cockpit's sidebar, header, or breadcrumbs. They open in a new tab from the launcher and render their own sidebar (`AppShell`), built from the same shared primitives, with the app's own nav items and a "Back to Cockpit" link. `/tools` is the only entry point; the Cockpit sidebar deliberately has no Apps group.

Because apps sit outside `(app)`, the `(apps)/layout.tsx` group layout repeats the auth, onboarding, and `AuthorityProvider` guards. Those guards are about being a signed-in onboarded member, not about Cockpit.

**Never pass an `AppDefinition` across the RSC boundary.** It contains a function (`description`) and may contain component references. React throws "Functions cannot be passed directly to Client Components". Cards, grid, and launcher are server components; client components receive `app.id`.

**Visibility is not an `Action`.** `evaluateAuth` denies every action to users whose status is not an active authority status — which includes `onboarding`. Onboarding members must still see the external tools, so `AppVisibility` is a composite over status *and* permissions, with `{ kind: "permission" }` as one leaf. Use `{ kind: "status" }` for anything onboarding members need.

**Enforcement has three layers, and the first does not cover the second.**

1. `(apps)/<slug>/layout.tsx` calls `requireAppAccess()` — gates page renders for the whole subtree.
2. Every server action calls `can()` itself. Server actions are independently addressable POST endpoints; a layout guard does **not** protect them.
3. `useCan()` and the launcher listing control affordances only.

Each internal app that needs gating adds one `GlobalAction` named `apps.<slug>.access` to `globalActions` plus a `case` in `evaluateGlobalAction` and tests, per the permission policy convention. External tools add no actions.

## Database

One Postgres database, one `public` schema, one `/drizzle` migration sequence. Apps own their table definitions inside their own folder; `drizzle.config.ts` picks them up:

```ts
schema: [
  "./src/db/schema",
  "./src/internal-apps/*/db/schema.ts",
  "./src/internal-apps/*/db/schema/**/*.ts",
],
```

- **Prefix every table `<slug>_`.** This is the only thing preventing collisions between apps in the shared namespace, and it makes deleting an app a one-grep job.
- **Import core tables from their defining file** (`@/db/schema/auth`), never from `@/db/schema` — the same sibling-import rule the core schema follows to avoid cycles.
- **Do not add an app's tables to the `schema` object in `src/db/schema/index.ts`.** That object is shared with the Better Auth Drizzle adapter. The cost is that `db.query.*` (the relational API) is unavailable for app tables; use the core builder with explicit joins. This is a deliberate trade-off, not an oversight.
- **Register the app's id prefixes in `src/lib/id.ts`.** `isPrefixedId()` is the shared test for "is this path segment an id"; keep the map complete.
- Workflow is unchanged and non-negotiable: edit schema → `npm run db:generate` → `npm run db:migrate`. Never hand-edit a migration, never apply schema changes with `psql`.

## Adding an app

1. `src/internal-apps/<slug>/app.ts` — the `InternalAppDefinition` (`category: "internal"`, a `basePath` that does not collide with a reserved route, and a `visibility`).
2. Add `"apps.<slug>.access"` to `globalActions` + a `switch` case + tests.
3. Register the app in `src/lib/apps/registry.ts` and add its icon to `app-icons.tsx`.
4. Tables in `db/schema.ts` (or `db/schema/`), prefix `<slug>_`, id prefixes into `src/lib/id.ts`, then `db:generate` + `db:migrate`.
5. Routes under `(authenticated)/(apps)/<slug>/` with a `layout.tsx` that calls `requireAppAccess` and renders `<AppShell appId="<slug>">`, plus a `loading.tsx` matching the page layout. Declare `nav.items` in the definition to populate the app's own sidebar.
6. Inngest functions (if any) spread into `src/inngest/index.ts`; events into the typed registry in `src/lib/inngest.ts`, namespaced `<slug>/thing.happened`. Emails stay in `src/emails/` with a `<slug>-` filename prefix — `npm run email:dev` only reads `src/emails`.

`registry.test.ts` enforces unique ids, unique analytics ids, unique base paths, and no collision with reserved routes.

## Gotchas

- A schema glob that misses files looks exactly like "no schema change" — `db:generate` simply emits nothing. All three globs were verified against both schema layouts; if you change them, verify with a scratch table rather than assuming.
- Route groups do not affect URLs. An app in `(authenticated)/(apps)/example/` is served at `/example`.
- Nesting an app under `(app)` instead would silently give it Cockpit's sidebar and breadcrumbs back.
- `loading.tsx` renders before any await and cannot know the user's authority. The launcher skeleton uses registry totals as an upper bound.
- The launcher's `analyticsId` values are the historic `data-ph-capture-attribute-service` slugs. Renaming one silently breaks existing PostHog insights.
