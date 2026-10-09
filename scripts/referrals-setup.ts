import "./referrals-env";
import { readFile } from "node:fs/promises";
import db from "@/db";
import { env } from "@/env";
import { configureReferralCampaign } from "@/internal-apps/referrals/db/configure-campaign";
import { createReferralStore } from "@/internal-apps/referrals/db/store";
import { campaignConfigSchema } from "@/internal-apps/referrals/lib/campaign-config";
import { tallyWebhookSecret } from "@/internal-apps/referrals/lib/tally";
import {
  createTallyReader,
  hiddenFieldKeys,
} from "@/internal-apps/referrals/lib/tally-api";

async function main() {
  const path = process.argv[2];
  if (!path)
    throw new Error(
      "Usage: npm run referrals:setup -- <campaign.json> [--dry-run] [--connect-webhook]",
    );
  const secret = tallyWebhookSecret(
    env.TALLY_API_KEY,
    env.TALLY_REFERRALS_WEBHOOK_SECRET,
  );
  if (!secret)
    throw new Error("Configure TALLY_API_KEY before enabling referrals");
  const config = campaignConfigSchema.parse(
    JSON.parse(await readFile(path, "utf8")),
  );
  const reader = createTallyReader(env.TALLY_API_KEY ?? "");
  const keys = hiddenFieldKeys(await reader.questions(config.formId));
  if (
    keys.get(config.refFieldKey) !== "ref" ||
    keys.get(config.campaignFieldKey) !== "campaign"
  ) {
    throw new Error(
      "Configured keys must match the published Tally hidden fields ref and campaign",
    );
  }
  const dryRun = process.argv.includes("--dry-run");
  await configureReferralCampaign(db, config, { dryRun });
  if (dryRun) {
    console.log(`Validated campaign ${config.id}. No data changed.`);
    return;
  }
  const result = await createReferralStore(db).provisionMembers();
  if (process.argv.includes("--connect-webhook")) {
    await reader.connectWebhook(
      config.formId,
      env.NEXT_PUBLIC_COCKPIT_URL,
      secret,
    );
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
