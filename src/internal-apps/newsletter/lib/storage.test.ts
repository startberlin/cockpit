import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { it } from "node:test";

it("refuses a misconfigured Blob upload instead of storing an ephemeral local URL", () => {
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
    import storage from "./src/internal-apps/newsletter/lib/storage.ts";
    globalThis.fetch = async () => { throw new Error("Unexpected provider request"); };
    await assert.rejects(storage.storeAsset(new File(["image"], "logo.png", {type:"image/png"}), {baseUrl:"http://localhost:3000"}), /BLOB_READ_WRITE_TOKEN is required/);
  `,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "test",
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
        NEWSLETTER_STORAGE: "blob",
        BLOB_READ_WRITE_TOKEN: "",
        RESEND_NEWSLETTER_SEGMENT_ID: "",
        RESEND_NEWSLETTER_TOPIC_ID: "",
      },
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
