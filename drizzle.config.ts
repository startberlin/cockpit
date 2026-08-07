import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL must be set");

export default defineConfig({
  out: "./drizzle",
  // Core schema plus each internal app's own tables. Apps own their table
  // definitions inside their module folder and may use either a single
  // db/schema.ts or a db/schema/ directory — both are picked up here.
  // Everything still lands in one Postgres schema and one migration sequence;
  // per-app table names are prefixed `<slug>_` to avoid collisions.
  schema: [
    "./src/db/schema",
    "./src/modules/*/db/schema.ts",
    "./src/modules/*/db/schema/**/*.ts",
  ],
  dialect: "postgresql",
  dbCredentials: { url },
});
