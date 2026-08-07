# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Setup
npm install
cp .env.example .env  # Add Slack, Google, AWS SES credentials
npm run db:up         # Start PostgreSQL container
npm run db:migrate    # Run database migrations

# Development
npm run dev           # Runs Next.js + Inngest dev server at localhost:3000

# Database
npm run db:studio     # Open Drizzle Studio (allow local connections in browser)
npm run db:generate   # Generate new migration from schema changes
npm run db:dump       # Export database to supabase.sql
npm run db:restore    # Import database from supabase.sql

# Code Quality
npm run lint          # Run Biome linter
npm run format        # Format code with Biome

# Email Development
npm run email:dev     # Preview React Email templates
```

## Tech Stack

- **Framework**: Next.js 16 with Turbopack, React 19, App Router
- **Language**: TypeScript
- **Authentication**: Better Auth with Google OAuth (no email/password)
- **Database**: PostgreSQL with Drizzle ORM
- **Background Jobs**: Inngest for async workflows
- **Email**: React Email + AWS SES v2
- **Styling**: Tailwind CSS 4
- **Code Quality**: Biome (linter + formatter)

## Architecture

### App Router Structure

Routes use Next.js 15+ App Router with route groups:

- `(authenticated)/(app)/(default)/*` - Main app routes (groups, people, membership), `max-w-4xl` column
- `(authenticated)/(apps)/*` - Internal apps, own shell (see Internal Apps below)
- `(authenticated)/(onboarding)/*` - Onboarding flow for new users
- `auth/*` - Public auth pages
- `api/auth/[...all]` - Better Auth handler
- `api/inngest` - Inngest event webhook

### Internal Apps

Cockpit hosts multiple applications. External SaaS (Slack, Notion, ...) and internal apps built here are both entries in one registry, surfaced by the launcher at `/tools`.

An internal app is a **separate product**: it opens in a new tab and renders its own sidebar (its name, its nav items, a "Back to Cockpit" link), not Cockpit's. That is why apps live in `(authenticated)/(apps)/` — a sibling of `(app)`, not nested inside it. `/tools` is the only entry point; the Cockpit sidebar has no Apps group.

- Registry and access model: `src/lib/apps/*`
- Launcher/sidebar components: `src/components/apps/*`
- Per-app code: `src/modules/<slug>/*` (own `app.ts`, tables, actions, components)
- Per-app routes: `src/app/(authenticated)/(apps)/<slug>/*`

Five rules that are easy to get wrong:

1. The registry holds **data only** — no icons, no components, no JSX. SVG and `lucide-react` imports break `node --test`. Icons live in `app-icons.tsx`, dialogs in `launchers.tsx`, keyed by app id.
2. **Never pass an `AppDefinition` to a client component** — it contains functions. Pass `app.id`.
3. App visibility is **not** a plain permission: `evaluateAuth` denies everything to `onboarding` users, who must still see the external tools. Use `AppVisibility` (`src/lib/apps/visibility.ts`).
4. `requireAppAccess()` in the app's `layout.tsx` guards **page renders only**. Every server action must call `can()` itself.
5. Nesting an app under `(app)` would silently hand it Cockpit's sidebar and breadcrumbs back.

`src/modules/example` is a working reference with a deletion checklist. Full convention: `docs/solutions/conventions/internal-app-module-convention-2026-08-03.md`.

### Authentication Flow

Uses Better Auth (`src/lib/auth.ts`) with Google OAuth only:

- Social provider: Google Workspace (signup disabled, must pre-exist in system)
- User schema extended with custom fields (firstName, lastName, address, phone, status)
- Drizzle adapter connects auth to PostgreSQL
- Session managed via cookies with `nextCookies()` plugin

### Database Patterns

Drizzle ORM (`src/db/`) with schema-first approach:

- Schema defined in `src/db/schema/*` (auth, groups, users, etc.)
- Migrations generated via `npm run db:generate`
- Applied via `npm run db:migrate`
- Custom ID prefixes using `newId()` from `src/lib/id.ts` (e.g., `usr_`, `gr_`)
- Relations defined in schema for type-safe queries

**CRITICAL: Migration rules — never violate these:**

1. **Never manually edit migration files** in `drizzle/`. They are auto-generated and must not be touched by hand.
2. **Always modify schema files** in `src/db/schema/*` (core) or `src/modules/<slug>/db/schema*` (app-owned) to make database changes.
3. **Always run `npm run db:generate`** after schema changes to generate the migration file.
4. **Always run `npm run db:migrate`** after generating to apply migrations to the database.
5. The correct workflow is always: edit schema → `npm run db:generate` → `npm run db:migrate`.
6. **Never use `psql` or raw SQL clients to apply schema changes.** All database changes must go through Drizzle migrations so that production deployments (which run `npm run db:migrate`) stay in sync.

### Server Actions

Server-side mutations use `next-safe-action`:

- Server actions typically colocated with components or in dedicated files
- React Hook Form integration via `@next-safe-action/adapter-react-hook-form`
- Form validation with Zod schemas (converted from Drizzle schema via `drizzle-zod`)

### Background Jobs (Inngest)

Inngest workflows in `src/inngest/`:

- `new-user-workflow.ts` - Creates Google Workspace account, database user, sends welcome email
- Membership lifecycle workflows (admission, cancellation, transition, reconfirmation, anniversary)
- Payment/mandate reminders and system-group sync, plus several crons
- All functions are registered in `src/inngest/index.ts` and served at `api/inngest`
- Idempotency keys prevent duplicate processing
- Multi-step workflows with automatic retries

App modules may add their own functions under `src/modules/<slug>/inngest/` and spread them into `src/inngest/index.ts`; events go in the typed registry in `src/lib/inngest.ts`, namespaced `<slug>/thing.happened`.

Each workflow uses `step.run()` for automatic retries and observability.

### Email System

React Email components in `src/emails/`:

- Preview templates via `npm run email:dev`
- Sent via AWS SES v2 (`src/lib/email.ts`)
- Typically triggered from Inngest workflows

### External Integrations

- **Google Workspace**: Admin SDK for user/group management (requires service account with domain-wide delegation)
- **Slack**: Web API for channel/user operations, webhook for events
- **AWS SES v2**: Transactional email delivery (`src/lib/email.ts`)

Service credentials configured in `.env` file.

### Documented Solutions

`docs/solutions/` — documented solutions to past problems (bugs, best practices, workflow patterns, architecture decisions), organized by category with YAML frontmatter (`module`, `tags`, `problem_type`). Relevant when implementing or debugging in documented areas.

## Key Patterns

### Route Organization

- Pages use `page.tsx` for server components
- Client interactivity split into `*-client.tsx` files
- Server actions often in separate files or colocated
- Use `"use server"` directive for server actions

### Component Structure

- UI components in `src/components/ui/*` (shadcn/ui style)
- Feature components colocated with routes
- Client components marked with `"use client"`
- Forms use React Hook Form + Zod validation

### Database Queries

Always import db and schema:

```typescript
import db from "@/db";
import { user, group } from "@/db/schema";
```

Use Drizzle's query API for type-safe operations with relations.

### ID Generation

Use custom ID generator for prefixed IDs:

```typescript
import { newId } from "@/lib/id";
const id = newId("user"); // generates "usr_xxxxxxxxxxxxx"
```

Prefixes are declared in `src/lib/id.ts` — currently `usr_`, `gr_`, `lm_`, `ma_`, `mc_`, `mtr_`, `ppd_`, `aud_`, `exn_`.
App modules register their own prefixes in the same map (required: `nav-breadcrumb` uses `isPrefixedId()` to decide whether a path segment is an id).

### Query State / URL Params

Always use **Nuqs** for reading and writing URL query parameters. Never use `useSearchParams` directly, `router.push` with manual query string construction, or `URLSearchParams` for state that belongs in the URL.

```typescript
import { useQueryState, parseAsString } from "nuqs";

const [tab, setTab] = useQueryState("tab", parseAsString.withDefault("overview"));
```

For server components, use `createSearchParamsCache` to read params server-side.

### Forms

Whenever you have a form, use React Hook Form with Zod validation. When using server actions, integrate with `@next-safe-action/adapter-react-hook-form` for seamless server-side handling. See here for an example: https://next-safe-action.dev/docs/integrations/react-hook-form

### Loading Skeletons

Whenever you change the structure of a page or component — adding, removing, or reorganising sections — update the corresponding `loading.tsx` and any component-level skeleton files to match. Skeletons must always reflect the actual layout of the loaded page. This applies to direct page changes and to component changes that affect a page's structure.
