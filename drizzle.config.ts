import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const url = process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("MIGRATE_DATABASE_URL or DATABASE_URL must be set");

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema",
  dialect: "postgresql",
  dbCredentials: { url },
});
