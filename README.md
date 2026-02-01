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

## Useful Commands

| Command | Description |
|---------|-------------|
| `npm run db:studio` | Open Drizzle Studio (allow local connections in browser if prompted) |
| `npm run db:generate` | Generate migrations |
| `npm run email:dev` | Preview emails |
| `npm run lint` | Run Biome linter |
| `npm run format` | Format code |
