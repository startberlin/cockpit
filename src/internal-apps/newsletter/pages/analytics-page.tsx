import { BarChart3, EyeOff } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createMetadata } from "@/lib/metadata";
import { PageContainer, PageHeader } from "../components/page-container";
import { getAnalyticsOverview, rate } from "../lib/analytics";
import { formatPercent } from "../lib/format";

export const metadata = createMetadata({
  title: "Newsletter analytics",
  description: "How each issue performed.",
});

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Berlin",
});

export default async function AnalyticsPage() {
  const { reports, totals, tracking, error, metricReportCount } =
    await getAnalyticsOverview();

  const openTrackingOff = tracking.some(
    (domain) => domain.status === "verified" && !domain.openTracking,
  );

  return (
    <PageContainer>
      <PageHeader
        title="Analytics"
        description="Every broadcast on the Resend account, including ones sent before this app existed."
      />

      {error ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Some analytics data is unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {openTrackingOff ? (
        <Alert className="mb-6" role="status">
          <EyeOff />
          <AlertTitle>Open tracking is off for this domain</AlertTitle>
          <AlertDescription>
            Broadcasts sent without open tracking have no recorded opens.
            Tracking can be enabled in the domain settings in Resend.
          </AlertDescription>
        </Alert>
      ) : null}

      <p className="mb-4 text-xs text-muted-foreground">
        Opens depend on tracking at the time of sending. Enabling it now does
        not add data to older broadcasts. Privacy features and automated image
        loads can affect open counts.
      </p>

      {reports.length === 0 ? (
        <Empty className="border bg-muted/30">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BarChart3 />
            </EmptyMedia>
            <EmptyTitle>
              {error ? "No broadcasts to display" : "Nothing sent yet"}
            </EmptyTitle>
            <EmptyDescription>
              {error
                ? "Reload the page to retry any unavailable data from Resend."
                : "Once an issue goes out, its delivery and engagement numbers appear here."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <p className="pb-3 text-xs text-muted-foreground">
            Metrics available for {metricReportCount} of {reports.length}{" "}
            broadcasts.
            {metricReportCount < reports.length
              ? " Totals include only the available metrics."
              : ""}
          </p>
          <div className="grid grid-cols-2 gap-3 pb-6 sm:grid-cols-4 *:data-[slot=card]:shadow-xs">
            <Card>
              <CardHeader>
                <CardDescription>Delivered</CardDescription>
                <CardTitle className="text-3xl font-bold tabular-nums">
                  {totals.delivered ?? "-"}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Unique clicks</CardDescription>
                <CardTitle className="text-3xl font-bold tabular-nums">
                  {totals.unique_clicked ?? "-"}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Click rate</CardDescription>
                <CardTitle className="text-3xl font-bold tabular-nums">
                  {formatPercent(rate(totals.unique_clicked, totals.delivered))}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Unsubscribes</CardDescription>
                <CardTitle className="text-3xl font-bold tabular-nums">
                  {totals.unsubscribed ?? "-"}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Broadcast</TableHead>
                  <TableHead className="text-right">Delivered</TableHead>
                  <TableHead className="text-right">Opens</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Click rate</TableHead>
                  <TableHead className="text-right">Bounced</TableHead>
                  <TableHead className="text-right">Unsub.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id} className="relative cursor-pointer">
                    <TableCell className="max-w-[240px]">
                      {/* `after:absolute after:inset-0` stretches the anchor
                          across the whole row, so any cell is a click target
                          while this stays a real link, so middle-click, cmd-click
                          and screen readers all keep working, and no client
                          component is needed to route it. */}
                      <Link
                        href={`/newsletter/analytics/${report.id}`}
                        className="font-medium after:absolute after:inset-0 hover:underline"
                      >
                        {report.issueName ?? report.name ?? "Untitled"}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {report.sentAt
                          ? dateFormat.format(new Date(report.sentAt))
                          : "-"}
                        {report.issueId ? null : " · sent outside Cockpit"}
                      </p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {report.totals?.delivered ?? "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {report.totals?.unique_opened ?? "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {report.totals?.unique_clicked ?? "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPercent(
                        rate(
                          report.totals?.unique_clicked,
                          report.totals?.delivered,
                        ),
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {report.totals?.bounced ?? "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {report.totals?.unsubscribed ?? "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </PageContainer>
  );
}
