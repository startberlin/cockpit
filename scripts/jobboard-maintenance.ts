import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { createJobboardService } from "../src/internal-apps/jobboard/db/service";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const service = createJobboardService(drizzle(pool));
service
  .runMaintenance()
  .then((result) => console.log(result))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
