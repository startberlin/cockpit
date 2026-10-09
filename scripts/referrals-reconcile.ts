import "./referrals-env";
import { eq } from "drizzle-orm";
import db from "@/db";
import { env } from "@/env";
import { referralsCampaign } from "@/internal-apps/referrals/db/schema";
import { createReferralStore } from "@/internal-apps/referrals/db/store";
import { createTallyReader } from "@/internal-apps/referrals/lib/tally-api";

async function main() {
  const campaignId = process.argv[2];
  if (!campaignId)
    throw new Error("Usage: npm run referrals:reconcile -- <campaign-id>");
  const [campaign] = await db
    .select()
    .from(referralsCampaign)
    .where(eq(referralsCampaign.id, campaignId))
    .limit(1);
  if (!campaign) throw new Error("Campaign not found");
  const result = await createTallyReader(env.TALLY_API_KEY ?? "").reconcile(
    campaign.formId,
    createReferralStore(db).ingest,
  );
  console.log(JSON.stringify(result));
}

main()
  .catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
