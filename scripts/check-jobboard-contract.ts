import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const publicProject =
  process.env.JOBBOARD_PUBLIC_PROJECT ??
  path.resolve(process.cwd(), "../start_jobboard_public");
const websiteProject =
  process.env.JOBBOARD_WEBSITE_PROJECT ??
  path.resolve(process.cwd(), "../start_website/website-v2");
const files = [
  path.resolve("src/internal-apps/jobboard/lib/contracts.ts"),
  path.join(publicProject, "src/lib/contracts.ts"),
  path.join(websiteProject, "src/lib/jobboard/contracts.ts"),
];
async function main() {
  const [internal, external, website] = await Promise.all(
    files.map((file) => readFile(file, "utf8")),
  );
  assert.equal(
    website,
    internal,
    "Website v2 Jobboard API contract differs. Update all three copies together.",
  );
  assert.equal(
    external,
    internal,
    "Jobboard API contracts differ. Update both projects together and run their contract tests.",
  );
  console.log(
    "Cockpit, standalone public and website v2 Jobboard API v1 contracts match exactly.",
  );
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Contract check failed.",
  );
  process.exitCode = 1;
});
