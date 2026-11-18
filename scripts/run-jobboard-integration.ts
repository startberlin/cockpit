import "dotenv/config";
import { spawnSync } from "node:child_process";

if (!process.env.JOBBOARD_TEST_DATABASE_URL) {
  throw new Error(
    "Set JOBBOARD_TEST_DATABASE_URL to a local disposable jobboard_test database. Integration tests must not silently skip.",
  );
}
const result = spawnSync(
  process.execPath,
  [
    "--import",
    "tsx",
    "--test",
    "src/internal-apps/jobboard/db/service.integration.test.ts",
  ],
  { stdio: "inherit", env: process.env },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
