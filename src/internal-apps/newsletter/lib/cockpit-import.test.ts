import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { it } from "node:test";

it("imports only distinct usable human addresses and safely quotes CSV fields", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      `
      import assert from "node:assert/strict";
      import api from "./src/internal-apps/newsletter/lib/cockpit-import.ts";
      globalThis.fetch = async () => { throw new Error("Unexpected network request"); };
      const member = { id: "member", email: null, personalEmail: null, firstName: "First", lastName: "Last", status: "active", department: "growth", batchNumber: 15 };
      const result = api.buildImportCandidates([
        { ...member, id: "fallback", email: "  ", personalEmail: " Person@Example.com " },
        { ...member, id: "invalid", email: "bad-address", personalEmail: "Other@Example.com" },
        { ...member, id: "duplicate", email: "PERSON@example.com" },
        { ...member, id: "no-address", email: "broken", personalEmail: "also broken" },
        { ...member, id: "system", email: "cockpit-system-user@start-berlin.com", personalEmail: "system-personal@example.com" },
      ]);
      assert.deepEqual(result.candidates.map((contact) => [contact.userId, contact.email]), [["fallback", "person@example.com"], ["invalid", "other@example.com"]]);
      assert.equal(result.withoutEmail, 1);
      const csv = api.buildImportCsv([{ ...result.candidates[0], firstName: '=HYPERLINK("https://example.com")', lastName: 'Name, quoted' }], { groupSlug: "growth", importedAt: "2026-09-29" });
      assert.equal(csv.split("\\n").length, 2);
      assert.match(csv, /"'=HYPERLINK\\(""https:\\/\\/example.com""\\)"/);
      assert.match(csv, /"Name, quoted"/);
      assert.match(csv, /"cockpit:growth:2026-09-29"/);
    `,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "test",
        SKIP_ENV_VALIDATION: "true",
        DATABASE_URL: "postgresql://localhost/audit_unused",
        BETTER_AUTH_SECRET: "audit-unused-secret",
        GOOGLE_CLIENT_ID: "audit-unused-id",
        GOOGLE_CLIENT_SECRET: "audit-unused-secret",
        AWS_REGION: "eu-central-1",
        AWS_ACCESS_KEY_ID: "audit-unused",
        AWS_SECRET_ACCESS_KEY: "audit-unused",
        AWS_SES_SNS_TOPIC_ARN: "audit-unused",
        DISABLE_GOOGLE_WORKSPACE: "true",
        NEXT_PUBLIC_COCKPIT_URL: "http://localhost:3000",
      },
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
