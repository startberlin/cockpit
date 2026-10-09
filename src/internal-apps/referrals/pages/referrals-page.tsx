import { createMetadata } from "@/lib/metadata";
import { ReferralDashboard } from "../components/referral-dashboard";
import { RefreshStats } from "../components/refresh-stats";
import { getMyReferrals } from "../db/queries";
import { referralUrl } from "../lib/links";

export const metadata = createMetadata({
  title: "Referrals",
  description: "Your personal START Berlin application link.",
});

export default async function ReferralsPage() {
  const data = await getMyReferrals();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">
          My referrals
        </h1>
        <RefreshStats />
      </div>
      <ReferralDashboard
        url={referralUrl(data.code)}
        campaign={data.campaign}
        currentCount={data.currentCount}
        totalCount={data.totalCount}
      />
    </div>
  );
}
