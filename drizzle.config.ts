import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// MIGRATE_DATABASE_URL must be a direct (non-pooler) connection — pgBouncer
// doesn't support the DDL transactions drizzle-kit uses for migrations.
// In production set both: DATABASE_URL (pooler) and MIGRATE_DATABASE_URL (direct).
const url = process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("MIGRATE_DATABASE_URL or DATABASE_URL must be set");

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema",
  dialect: "postgresql",
  dbCredentials: { url },
});
