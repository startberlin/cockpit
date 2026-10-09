import "./referrals-env";
import { readFile } from "node:fs/promises";
import db from "@/db";
import { env } from "@/env";
import { setupReferralCampaign } from "@/internal-apps/referrals/lib/setup";

async function main() {
  const path = process.argv[2];
  if (!path)
    throw new Error(
      "Usage: npm run referrals:setup -- <campaign.json> [--dry-run] [--connect-webhook]",
    );
  const config = JSON.parse(await readFile(path, "utf8"));
  const dryRun = process.argv.includes("--dry-run");
  const result = await setupReferralCampaign(db, config, {
    apiKey: env.TALLY_API_KEY,
    cockpitUrl: env.NEXT_PUBLIC_COCKPIT_URL,
    signingSecret: env.TALLY_REFERRALS_WEBHOOK_SECRET,
    dryRun,
    connectWebhook: process.argv.includes("--connect-webhook"),
  });
  if (dryRun) {
    console.log(`Validated campaign ${config.id}. No data changed.`);
    return;
  }
  if (result.webhookConnected) {
    console.log(
      "Connected the signed referral webhook. Signing secret was not printed.",
    );
  }
  console.log(
    `Configured ${config.id}; provisioned ${result.provisioned} member links.`,
  );
}

main()
  .catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
