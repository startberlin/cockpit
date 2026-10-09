import { and, count, desc, eq, gt, inArray, isNull, lte } from "drizzle-orm";
import type db from "@/db";
import { user } from "@/db/schema/auth";
import { activeAuthorityStatuses } from "@/lib/authority/model";
import { nanoid, newId } from "@/lib/id";
import { applicationUrl } from "../lib/links";
import { type CompletedSubmission, hiddenValue } from "../lib/tally";
import {
  type AttributionStatus,
  referralsCampaign,
  referralsLink,
  referralsSubmission,
} from "./schema";

type ReferralDatabase = Pick<typeof db, "select" | "insert">;

export function createReferralStore(database: ReferralDatabase) {
  async function ensureLink(userId: string) {
    const [member] = await database
      .select({ id: user.id })
      .from(user)
      .where(
        and(eq(user.id, userId), inArray(user.status, activeAuthorityStatuses)),
      )
      .limit(1);
    if (!member) throw new Error("Referral links require an active member");
    for (let attempt = 0; attempt < 3; attempt++) {
      const [existing] = await database
        .select()
        .from(referralsLink)
        .where(eq(referralsLink.userId, userId))
        .limit(1);
      if (existing) return existing;
      const [created] = await database
        .insert(referralsLink)
        .values({ id: newId("referralLink"), userId, code: nanoid(16) })
        .onConflictDoNothing()
        .returning();
      if (created) return created;
    }
    const [existing] = await database
      .select()
      .from(referralsLink)
      .where(eq(referralsLink.userId, userId))
      .limit(1);
    if (!existing) throw new Error("Could not provision referral link");
    return existing;
  }

  async function provisionMembers() {
    const missing = await database
      .select({ id: user.id })
      .from(user)
      .leftJoin(referralsLink, eq(referralsLink.userId, user.id))
      .where(
        and(
          inArray(user.status, activeAuthorityStatuses),
          isNull(referralsLink.id),
        ),
      );
    for (const member of missing) await ensureLink(member.id);
    return { provisioned: missing.length };
  }

  async function displayedCampaign(now = new Date()) {
    const [campaign] = await database
      .select()
      .from(referralsCampaign)
      .where(
        and(
          eq(referralsCampaign.enabled, true),
          lte(referralsCampaign.opensAt, now),
        ),
      )
      .orderBy(desc(referralsCampaign.opensAt))
      .limit(1);
    return campaign ?? null;
  }

  async function activeCampaign(now = new Date()) {
    const [campaign] = await database
      .select()
      .from(referralsCampaign)
      .where(
        and(
          eq(referralsCampaign.enabled, true),
          lte(referralsCampaign.opensAt, now),
          gt(referralsCampaign.closesAt, now),
        ),
      )
      .orderBy(desc(referralsCampaign.opensAt))
      .limit(1);
    return campaign ?? null;
  }

  async function ingest(submission: CompletedSubmission) {
    const [campaign] = await database
      .select()
      .from(referralsCampaign)
      .where(eq(referralsCampaign.formId, submission.formId))
      .limit(1);
    if (!campaign) return { status: "unknown_form" as const, inserted: false };
    const code = hiddenValue(submission.fields, campaign.refFieldKey);
    const campaignValue = hiddenValue(
      submission.fields,
      campaign.campaignFieldKey,
    );
    let status: AttributionStatus = "matched";
    let linkId: string | null = null;
    if (code === undefined || campaignValue === undefined)
      status = "invalid_fields";
    else if (
      submission.submittedAt < campaign.opensAt ||
      submission.submittedAt >= campaign.closesAt
    )
      status = "outside_window";
    else if (!code) status = "missing_code";
    // The signed form ID identifies the campaign. Permanent links only need ref.
    else if (campaignValue && campaignValue !== campaign.id)
      status = "wrong_campaign";
    else {
      // Keep issued-code attribution after departure, including delayed delivery.
      const [link] = await database
        .select({ id: referralsLink.id })
        .from(referralsLink)
        .where(eq(referralsLink.code, code))
        .limit(1);
      if (link) linkId = link.id;
      else status = "unknown_code";
    }
    const inserted = await database
      .insert(referralsSubmission)
      .values({
        id: newId("referralSubmission"),
        campaignId: campaign.id,
        linkId,
        formId: submission.formId,
        submissionId: submission.submissionId,
        submittedAt: submission.submittedAt,
        status,
      })
      .onConflictDoNothing({
        target: [referralsSubmission.formId, referralsSubmission.submissionId],
      })
      .returning({ id: referralsSubmission.id });
    return { status, inserted: inserted.length > 0 };
  }

  async function myDashboard(userId: string, now = new Date()) {
    const [link, campaign] = await Promise.all([
      ensureLink(userId),
      displayedCampaign(now),
    ]);
    const rows = await database
      .select({ campaignId: referralsSubmission.campaignId, count: count() })
      .from(referralsSubmission)
      .where(
        and(
          eq(referralsSubmission.linkId, link.id),
          eq(referralsSubmission.status, "matched"),
        ),
      )
      .groupBy(referralsSubmission.campaignId);
    return {
      code: link.code,
      campaign: campaign
        ? {
            name: campaign.name,
            closesAt: campaign.closesAt.toISOString(),
            isOpen: now < campaign.closesAt,
          }
        : null,
      currentCount:
        rows.find((row) => row.campaignId === campaign?.id)?.count ?? 0,
      totalCount: rows.reduce((total, row) => total + row.count, 0),
    };
  }

  async function resolveLink(code: string, now = new Date()) {
    const [link] = await database
      .select({ code: referralsLink.code })
      .from(referralsLink)
      .innerJoin(user, eq(user.id, referralsLink.userId))
      .where(
        and(
          eq(referralsLink.code, code),
          inArray(user.status, activeAuthorityStatuses),
        ),
      )
      .limit(1);
    if (!link) return { status: "unknown_link" as const };
    const campaign = await activeCampaign(now);
    if (!campaign) return { status: "closed" as const };
    return {
      status: "open" as const,
      url: applicationUrl(campaign.applicationUrl, link.code, campaign.id),
    };
  }

  async function overview() {
    const campaign = await displayedCampaign();
    if (!campaign) return { campaign: null, members: [], statuses: [] };
    const [members, statuses] = await Promise.all([
      database
        .select({
          name: user.name,
          code: referralsLink.code,
          applications: count(referralsSubmission.id),
        })
        .from(referralsLink)
        .innerJoin(user, eq(user.id, referralsLink.userId))
        .leftJoin(
          referralsSubmission,
          and(
            eq(referralsSubmission.linkId, referralsLink.id),
            eq(referralsSubmission.campaignId, campaign.id),
            eq(referralsSubmission.status, "matched"),
          ),
        )
        .where(inArray(user.status, activeAuthorityStatuses))
        .groupBy(user.id, user.name, referralsLink.code)
        .orderBy(desc(count(referralsSubmission.id)), user.name),
      database
        .select({ status: referralsSubmission.status, count: count() })
        .from(referralsSubmission)
        .where(eq(referralsSubmission.campaignId, campaign.id))
        .groupBy(referralsSubmission.status),
    ]);
    return { campaign: { name: campaign.name }, members, statuses };
  }

  return {
    ensureLink,
    provisionMembers,
    displayedCampaign,
    activeCampaign,
    ingest,
    myDashboard,
    resolveLink,
    overview,
  };
}
