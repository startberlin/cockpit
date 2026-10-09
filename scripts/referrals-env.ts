import { config } from "dotenv";

// Match the local app's credentials while preserving externally supplied env.
config({ path: [".env.local", ".env"], quiet: true });
