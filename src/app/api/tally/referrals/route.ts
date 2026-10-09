import { env } from "@/env";
import { referralsStore } from "@/internal-apps/referrals/db/server";
import { tallyWebhookSecret } from "@/internal-apps/referrals/lib/tally";
import { createReferralWebhookHandler } from "@/internal-apps/referrals/lib/webhook-handler";

export const runtime = "nodejs";
export const POST = createReferralWebhookHandler({
  secret: tallyWebhookSecret(
    env.TALLY_API_KEY,
    env.TALLY_REFERRALS_WEBHOOK_SECRET,
  ),
  ingest: referralsStore.ingest,
});
