import {
  createSearchParamsCache,
  parseAsInteger,
  type SearchParams,
} from "nuqs/server";
import { requireAppAccess } from "@/lib/apps/server";
import { createMetadata } from "@/lib/metadata";
import { AnalyticsDashboard } from "../components/analytics-dashboard";
import { AnalyticsRange } from "../components/analytics-range";
import { PageHeader } from "../components/page-header";
import { formatDate } from "../components/status-badge";
import { service } from "../lib/service";

export const metadata = createMetadata({
  title: "Jobboard analytics",
  description: "Aggregate distribution and application-link metrics.",
});
const query = createSearchParamsCache({ days: parseAsInteger.withDefault(30) });

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAppAccess("jobboard");
  const parsed = await query.parse(searchParams);
  const days = [7, 30, 90].includes(parsed.days) ? parsed.days : 30;
  const today = new Date();
  const from = new Date(today.getTime() - (days - 1) * 86400000)
    .toISOString()
    .slice(0, 10);
  const to = today.toISOString().slice(0, 10);
  const analytics = await service.getAnalytics({ from, to });
  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6">
      <PageHeader title="Analytics">
        <AnalyticsRange />
      </PageHeader>
      <p className="text-xs text-muted-foreground">
        {formatDate(`${from}T00:00:00Z`, "UTC")} to{" "}
        {formatDate(`${to}T00:00:00Z`, "UTC")} · UTC
      </p>
      <AnalyticsDashboard analytics={analytics} days={days} />
    </div>
  );
}
