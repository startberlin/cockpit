import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const rawUrl = process.env.DATABASE_URL;

if (!rawUrl) {
  console.error("DATABASE_URL must be set");
  process.exit(1);
}

console.log(`Running migrations`);

const pool = new Pool({
  connectionString: rawUrl,
  connectionTimeoutMillis: 10_000,
  max: 1,
});

async function main() {
  console.log("Connecting to database...");
  const client = await pool.connect();
  client.release();
  console.log("Connected to database");

  console.log("Applying migrations...");
  const db = drizzle({ client: pool });
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Applied migrations");
}

main()
  .catch((err: Error) => {
    console.error("Migragtions failed:", err.message);
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
