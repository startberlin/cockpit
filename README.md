# Start Berlin Cockpit

Internal membership management platform.

## Setup

### Prerequisites

- Node.js 20+
- Docker

### Installation

```bash
npm install
```

### Environment

```bash
cp .env.example .env
```

Add required credentials to `.env` (Slack, Google, Resend, etc.).

### Database

```bash
# Start PostgreSQL
npm run db:up

# Run migrations
npm run db:migrate
```

### Development

```bash
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000). This runs both Next.js and Inngest dev server.

## First-time system setup

After running migrations on a fresh database, the following records must exist before anyone can log in. Use `npm run db:studio` or run the SQL directly against your database.

### 1. Create a batch

Every user requires a batch. Create at least one before creating any users.

```sql
INSERT INTO batch (number, start_date) VALUES (1, '2024-01-01');
```

Add more rows for additional cohort years as needed.

### 2. Create the admin user

Create the user record manually (via Drizzle Studio or SQL). The following field values are required for a clean setup — the user will see the full member dashboard with no payment prompts:

| Field | Value |
|-------|-------|
| `status` | `member` |
| `legal_membership_state` | `active_member` |
| `batch_number` | `1` (or whichever batch you created) |
| `personal_email` | a real email address |
| `phone` | a phone number |
| `street`, `city`, `state`, `zip`, `country` | any valid address |

> **Why:** `status = member` + `legal_membership_state = active_member` are required for the permissions system. The address and contact fields are required for the profile to read as complete, which gates payment setup visibility.

### 3. Grant admin access

Replace `<user_id>` with the ID of the user created above. (`grant` is a reserved word, so it must be quoted.)

```sql
INSERT INTO user_access_grant (user_id, "grant", created_at, updated_at)
VALUES ('<user_id>', 'admin', NOW(), NOW());
```

Valid `grant` values: `super_admin`, `admin`, `finance_admin`, `people_admin`, `members_group_exporter`. The primary key is the `(user_id, grant)` pair.

### 4. Suppress the "Set up payment" prompt

Without this the home screen shows a "Set up payment" prompt that leads to a GoCardless checkout the admin user should not need. The prompt is gated solely on whether the user has a GoCardless mandate — set any non-null `gocardless_mandate_id` on the user to mark payment as active and hide the prompt. No `membership_payments` row is required.

```sql
UPDATE "user" SET gocardless_mandate_id = 'manual-setup' WHERE id = '<user_id>';
```

> **Why:** the home-screen payment view resolves to `active` (no prompt) as soon as `gocardless_mandate_id` is set; otherwise it shows "not started" for any non-alumni/cancelled member. The value is never sent to GoCardless for a manual setup, so any placeholder works.

The admin user can now log in and will see a clean member dashboard.

## Useful Commands

| Command | Description |
|---------|-------------|
| `npm run db:studio` | Open Drizzle Studio (allow local connections in browser if prompted) |
| `npm run db:generate` | Generate migrations |
| `npm run db:dump` | Dump database to `supabase.sql` |
| `npm run db:restore` | Restore database from `supabase.sql` |
| `npm run email:dev` | Preview emails |
| `npm run lint` | Run Biome linter |
| `npm run format` | Format code |
