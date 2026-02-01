# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Setup
npm install
cp .env.example .env  # Add Slack, Google, Resend credentials
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
- **Email**: React Email + Resend
- **Styling**: Tailwind CSS 4
- **Code Quality**: Biome (linter + formatter)

## Architecture

### App Router Structure

Routes use Next.js 15+ App Router with route groups:

- `(authenticated)/(app)/*` - Main app routes (groups, people, membership)
- `(authenticated)/(onboarding)/*` - Onboarding flow for new users
- `auth/*` - Public auth pages
- `api/auth/[...all]` - Better Auth handler
- `api/inngest` - Inngest event webhook
- `api/slack/events` - Slack event webhook

### Authentication Flow

Uses Better Auth (`src/lib/auth.ts`) with Google OAuth only:
- Social provider: Google Workspace (signup disabled, must pre-exist in system)
- User schema extended with custom fields (firstName, lastName, roles, address, phone, status)
- Drizzle adapter connects auth to PostgreSQL
- Session managed via cookies with `nextCookies()` plugin

### Database Patterns

Drizzle ORM (`src/db/`) with schema-first approach:
- Schema defined in `src/db/schema/*` (auth, groups, users, etc.)
- Migrations generated via `npm run db:generate`
- Applied via `npm run db:migrate`
- Custom ID prefixes using `newId()` from `src/lib/id.ts` (e.g., `usr_`, `grp_`)
- Relations defined in schema for type-safe queries

### Server Actions

Server-side mutations use `next-safe-action`:
- Server actions typically colocated with components or in dedicated files
- React Hook Form integration via `@next-safe-action/adapter-react-hook-form`
- Form validation with Zod schemas (converted from Drizzle schema via `drizzle-zod`)

### Background Jobs (Inngest)

Inngest workflows in `src/inngest/`:
- `new-user-workflow.ts` - Creates Google Workspace account, database user, sends welcome email
- `create-group.ts` - Creates Google Group via Admin SDK
- `slack-user-joined.ts` - Handles Slack workspace join events
- Idempotency keys prevent duplicate processing
- Multi-step workflows with automatic retries

Each workflow uses `step.run()` for automatic retries and observability.

### Email System

React Email components in `src/emails/`:
- Preview templates via `npm run email:dev`
- Sent via Resend API (`src/lib/resend.ts`)
- Typically triggered from Inngest workflows

### External Integrations

- **Google Workspace**: Admin SDK for user/group management (requires service account with domain-wide delegation)
- **Slack**: Web API for channel/user operations, webhook for events
- **Resend**: Transactional email delivery

Service credentials configured in `.env` file.

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

Prefixes: `usr_`, `grp_`, `bat_`, `ses_`, `acc_`, `ver_`
