import type db from "@/db";
import { configureReferralCampaign } from "../db/configure-campaign";
import { createReferralStore } from "../db/store";
import { campaignConfigSchema } from "./campaign-config";
import { tallyWebhookSecret } from "./tally";
import { createTallyReader, hiddenFieldKeys } from "./tally-api";

interface SetupOptions {
  apiKey: string | undefined;
  cockpitUrl: string;
  signingSecret?: string;
  dryRun?: boolean;
  connectWebhook?: boolean;
  fetcher?: typeof fetch;
}

export function shouldInitializeReferralCampaign({
  eventName,
  environment,
  cockpitUrl,
}: {
  eventName: string;
  environment: string | undefined;
  cockpitUrl: string;
}): boolean {
  if (eventName !== "inngest/scheduled.timer" || environment !== "production")
    return false;
  try {
    const url = new URL(cockpitUrl);
    return (
      url.origin === "https://cockpit.start-berlin.com" &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export async function setupReferralCampaign(
  database: Pick<typeof db, "select" | "insert" | "transaction">,
  input: unknown,
  {
    apiKey,
    cockpitUrl,
    signingSecret,
    dryRun = false,
    connectWebhook = false,
    fetcher,
  }: SetupOptions,
) {
  const config = campaignConfigSchema.parse(input);
  const reader = createTallyReader(apiKey ?? "", fetcher);
  const keys = hiddenFieldKeys(await reader.questions(config.formId));
  if (
    keys.get(config.refFieldKey) !== "ref" ||
    keys.get(config.campaignFieldKey) !== "campaign"
  ) {
    throw new Error(
      "Configured keys must match the published Tally hidden fields ref and campaign",
    );
  }
  const { created } = await configureReferralCampaign(database, config, {
    dryRun,
  });
  if (dryRun) return { created, provisioned: 0, webhookConnected: false };

  const { provisioned } =
    await createReferralStore(database).provisionMembers();
  if (connectWebhook) {
    const secret = tallyWebhookSecret(apiKey, signingSecret);
    if (!secret)
      throw new Error("Configure TALLY_API_KEY before enabling referrals");
    await reader.connectWebhook(config.formId, cockpitUrl, secret);
  }
  return { created, provisioned, webhookConnected: connectWebhook };
}
