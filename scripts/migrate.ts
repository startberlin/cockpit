import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const rawUrl =
  process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL ?? "";

if (!rawUrl) {
  console.error(
    "error: neither MIGRATE_DATABASE_URL nor DATABASE_URL is set\n" +
      "  For migrations, set MIGRATE_DATABASE_URL to a direct (non-pooler) connection string.",
  );
  process.exit(1);
}

function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    u.password = u.password ? "***" : "";
    return u.toString();
  } catch {
    return "(could not parse URL)";
  }
}

const usingVar = process.env.MIGRATE_DATABASE_URL
  ? "MIGRATE_DATABASE_URL"
  : "DATABASE_URL";
console.log(`db:migrate  url=${maskUrl(rawUrl)}  (from ${usingVar})`);

const pool = new Pool({
  connectionString: rawUrl,
  connectionTimeoutMillis: 10_000,
  max: 1,
});

async function main() {
  console.log("db:migrate  connecting...");
  const client = await pool.connect();
  client.release();
  console.log("db:migrate  connected");

  console.log("db:migrate  applying migrations...");
  const db = drizzle({ client: pool });
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("db:migrate  done");
}

main()
  .catch((err: Error) => {
    console.error("db:migrate  failed:", err.message);
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
