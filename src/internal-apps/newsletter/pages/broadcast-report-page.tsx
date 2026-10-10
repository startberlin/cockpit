import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createMetadata } from "@/lib/metadata";
import { PageContainer } from "../components/page-container";
import { rate } from "../lib/analytics";
import { parseError } from "../lib/error";
import { formatPercent } from "../lib/format";
import {
  getClickedLinks,
  getRecipients,
  getSingleBroadcastMetrics,
  listBroadcasts,
} from "../lib/resend";

export const metadata = createMetadata({
  title: "Broadcast report",
  description: "Delivery and engagement for a single send.",
});

export default async function BroadcastReportPage({
  params,
}: {
  params: Promise<{ broadcastId: string }>;
}) {
  const { broadcastId } = await params;

  const broadcasts = await listBroadcasts();
  const broadcast = broadcasts.find((b) => b.id === broadcastId);
  if (!broadcast) notFound();

  const sentAt = broadcast.sentAt ? new Date(broadcast.sentAt) : new Date();
  const startDate = new Date(sentAt.getTime() - 86_400_000)
    .toISOString()
    .slice(0, 10);
  const endDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  // Bounces are pulled alongside the engagement numbers because they are the
  // most actionable thing on this page: a permanent bounce is an address to
  // remove, and typos are easy to spot once they are listed.
  const [metricResult, linkResult, bounceResult] = await Promise.allSettled([
    getSingleBroadcastMetrics(broadcastId, { startDate, endDate }),
    getClickedLinks(broadcastId),
    getRecipients(broadcastId, "bounced", 25),
  ]);
  const totals =
    metricResult.status === "fulfilled" ? metricResult.value : null;
  const links = linkResult.status === "fulfilled" ? linkResult.value : [];
  const bounced = bounceResult.status === "fulfilled" ? bounceResult.value : [];
  const errors = [
    metricResult.status === "rejected" &&
      `Metrics: ${parseError(metricResult.reason)}`,
    linkResult.status === "rejected" &&
      `Clicked links: ${parseError(linkResult.reason)}`,
    bounceResult.status === "rejected" &&
      `Bounced addresses: ${parseError(bounceResult.reason)}`,
  ].filter(Boolean);

  return (
    <PageContainer>
      <div className="flex flex-col gap-1 pb-6">
        <Link
          href="/newsletter/analytics"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Analytics
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {broadcast.name ?? "Untitled"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Sent{" "}
          {broadcast.sentAt
            ? new Intl.DateTimeFormat("en-GB", {
                dateStyle: "long",
                timeStyle: "short",
                timeZone: "Europe/Berlin",
              }).format(new Date(broadcast.sentAt))
            : "-"}
        </p>
      </div>

      {errors.length ? (
        <Alert className="mb-6" variant="destructive">
          <AlertTitle>Some report data is unavailable</AlertTitle>
          <AlertDescription>{errors.join(" ")}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 pb-6 sm:grid-cols-4 *:data-[slot=card]:shadow-xs">
        <Card>
          <CardHeader>
            <CardDescription>Delivered</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums">
              {totals?.delivered ?? "-"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Unique clicks</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums">
              {totals?.unique_clicked ?? "-"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Click rate</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums">
              {formatPercent(rate(totals?.unique_clicked, totals?.delivered))}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Bounced</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums">
              {totals?.bounced ?? "-"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <h2 className="pb-3 text-sm font-semibold">What people clicked</h2>
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Link</TableHead>
              <TableHead className="text-right">Clicks</TableHead>
              <TableHead className="text-right">Unique</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.length ? (
              links.map((link) => (
                <TableRow key={link.url}>
                  <TableCell className="max-w-[420px] truncate font-medium">
                    {link.url}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {link.clicks}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {link.unique_clicks}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="h-20 text-center">
                  {linkResult.status === "rejected"
                    ? "Clicked links could not be loaded."
                    : "No clicks recorded."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {bounced.length ? (
        <>
          <h2 className="pt-8 pb-1 text-sm font-semibold">Bounced addresses</h2>
          <p className="pb-3 text-sm text-muted-foreground">
            Permanent bounces are worth removing at the source. Typos show up
            here first. Showing up to 25 addresses.
          </p>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(bounced as { email: string; bounce_type?: string }[]).map(
                  (recipient) => (
                    <TableRow key={recipient.email}>
                      <TableCell className="font-medium">
                        {recipient.email}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {recipient.bounce_type ?? "-"}
                      </TableCell>
                    </TableRow>
                  ),
                )}
              </TableBody>
            </Table>
          </div>
        </>
      ) : null}
    </PageContainer>
  );
}
