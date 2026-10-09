import { and, eq, gt, lt, ne, sql } from "drizzle-orm";
import type { z } from "zod";
import type db from "@/db";
import { campaignConfigSchema } from "../lib/campaign-config";
import { referralsCampaign } from "./schema";

export async function configureReferralCampaign(
  database: Pick<typeof db, "transaction">,
  input: z.infer<typeof campaignConfigSchema>,
  { dryRun = false }: { dryRun?: boolean } = {},
) {
  const config = campaignConfigSchema.parse(input);
  const values = {
    ...config,
    opensAt: new Date(config.opensAt),
    closesAt: new Date(config.closesAt),
    enabled: true,
  };
  return database.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('referrals-campaign-setup'))`,
    );
    const [overlap] = await tx
      .select({ id: referralsCampaign.id })
      .from(referralsCampaign)
      .where(
        and(
          ne(referralsCampaign.id, config.id),
          eq(referralsCampaign.enabled, true),
          lt(referralsCampaign.opensAt, values.closesAt),
          gt(referralsCampaign.closesAt, values.opensAt),
        ),
      )
      .limit(1);
    if (overlap) throw new Error(`Campaign overlaps ${overlap.id}`);
    const [existing] = await tx
      .select()
      .from(referralsCampaign)
      .where(eq(referralsCampaign.id, config.id))
      .limit(1);
    if (existing) {
      if (
        existing.formId !== values.formId ||
        existing.refFieldKey !== values.refFieldKey ||
        existing.campaignFieldKey !== values.campaignFieldKey ||
        existing.opensAt.getTime() !== values.opensAt.getTime() ||
        existing.closesAt.getTime() !== values.closesAt.getTime() ||
        existing.applicationUrl !== values.applicationUrl ||
        existing.batchNumber !== values.batchNumber ||
        existing.name !== values.name ||
        !existing.enabled
      ) {
        throw new Error("Existing campaign configuration is immutable");
      }
      return { created: false };
    }
    if (dryRun) return { created: false };
    await tx.insert(referralsCampaign).values(values);
    return { created: true };
  });
}
