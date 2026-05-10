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

Replace `<user_id>` with the ID of the user created above.

```sql
INSERT INTO user_access_grant (id, user_id, grant, scope, department, created_at, updated_at)
VALUES ('aug_setup', '<user_id>', 'admin', 'global', NULL, NOW(), NOW());
```

### 4. Set up manual membership payment coverage

Without this record the home screen shows a "Set up payment" prompt that leads to a GoCardless checkout the admin user should not need. This creates a permanently-covered manual payment with no GoCardless integration.

```sql
INSERT INTO membership_payment (id, user_id, status, provider, paid_through_at, activated_at, created_at, updated_at)
VALUES ('mp_setup', '<user_id>', 'active', 'gocardless', '2099-12-31', NOW(), NOW(), NOW());
```

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
