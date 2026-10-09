import { CalendarDays, Link2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ShareLink } from "./share-link";

export interface ReferralDashboardProps {
  url: string;
  campaign: { name: string; closesAt: string; isOpen: boolean } | null;
  currentCount: number;
  totalCount: number;
}

export function ReferralDashboard({
  url,
  campaign,
  currentCount,
  totalCount,
}: ReferralDashboardProps) {
  const deadline = campaign
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        timeZone: "Europe/Berlin",
      }).format(new Date(campaign.closesAt).getTime() - 1)
    : null;

  return (
    <Card className="gap-0 overflow-hidden">
      <CardHeader className="gap-0 pb-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {campaign?.name ?? "My referrals"}
          </span>
          <span className="inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs text-muted-foreground">
            <span
              className={`size-1.5 rounded-full ${campaign?.isOpen ? "bg-success" : "bg-muted-foreground"}`}
            />
            {campaign?.isOpen ? "Applications open" : "Applications closed"}
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <span className="text-7xl font-black leading-none tracking-tight tabular-nums sm:text-8xl">
            {campaign ? currentCount : totalCount}
          </span>
          <div className="pb-1">
            <p className="text-lg font-bold">
              {(campaign ? currentCount : totalCount) === 1
                ? "application"
                : "applications"}
            </p>
            <p className="text-sm text-muted-foreground">via your link</p>
          </div>
        </div>
        {campaign ? (
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            {totalCount > currentCount ? (
              <span>{totalCount} all time</span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              {campaign.isOpen ? "Closes" : "Closed"} {deadline}
            </span>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="border-t pt-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Link2 className="size-4 text-muted-foreground" aria-hidden="true" />
          Your personal link
        </h2>
        <ShareLink url={url} />
        <p className="mt-1 text-xs text-muted-foreground">
          Only submitted applications count.
        </p>
      </CardContent>
    </Card>
  );
}
