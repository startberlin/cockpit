import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { env } from "@/env";
import { createMetadata } from "@/lib/metadata";
import { can } from "@/lib/permissions/server";
import { ReferralDashboard } from "../components/referral-dashboard";
import { RefreshStats } from "../components/refresh-stats";
import { getMyReferrals } from "../db/queries";
import { referralUrl } from "../lib/links";

export const metadata = createMetadata({
  title: "Referrals",
  description: "Your personal START Berlin application link.",
});

export default async function ReferralsPage() {
  const [data, canViewOverview] = await Promise.all([
    getMyReferrals(),
    can("apps.referrals.overview"),
  ]);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">
          My referrals
        </h1>
        <div className="flex items-center gap-1">
          <RefreshStats />
          {canViewOverview ? (
            <Button asChild variant="ghost" className="min-h-11">
              <Link href="/referrals/overview">
                Overview <ArrowUpRight aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
      <ReferralDashboard
        url={referralUrl(env.NEXT_PUBLIC_COCKPIT_URL, data.code)}
        campaign={data.campaign}
        currentCount={data.currentCount}
        totalCount={data.totalCount}
      />
    </div>
  );
}
