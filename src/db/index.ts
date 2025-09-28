import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "@/env";

import "dotenv/config";
import { schema } from "./schema";

const db = drizzle(env.DATABASE_URL, { schema });

export default db;
