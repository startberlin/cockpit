import "server-only";

import { isNotNull } from "drizzle-orm";
import db from "@/db";
import { newsletterIssue } from "../db/schema";
import {
  type BroadcastTotals,
  getBroadcastMetrics,
  getDomainTracking,
  listBroadcasts,
  type RemoteBroadcast,
} from "./resend";

export interface BroadcastReport extends RemoteBroadcast {
  /** Set when the broadcast was created by this app rather than the dashboard. */
  issueId: string | null;
  issueName: string | null;
  totals: BroadcastTotals | null;
}

export interface AnalyticsOverview {
  reports: BroadcastReport[];
  totals: BroadcastTotals;
  metricReportCount: number;
  tracking: Awaited<ReturnType<typeof getDomainTracking>>;
  error: string | null;
}

const SUM_METRICS = [
  "sent",
  "delivered",
  "opened",
  "unique_opened",
  "clicked",
  "unique_clicked",
  "bounced",
  "complained",
  "unsubscribed",
] as const;

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  const empty: AnalyticsOverview = {
    reports: [],
    totals: {},
    metricReportCount: 0,
    tracking: [],
    error: null,
  };

  const [broadcastResult, trackingResult] = await Promise.allSettled([
    listBroadcasts(),
    getDomainTracking(),
  ]);
  const tracking =
    trackingResult.status === "fulfilled" ? trackingResult.value : [];
  if (broadcastResult.status === "rejected") {
    return {
      ...empty,
      tracking,
      error:
        broadcastResult.reason instanceof Error
          ? broadcastResult.reason.message
          : String(broadcastResult.reason),
    };
  }
  const broadcasts = broadcastResult.value;
  let error: string | null =
    trackingResult.status === "rejected"
      ? `Domain tracking could not be checked: ${trackingResult.reason instanceof Error ? trackingResult.reason.message : String(trackingResult.reason)}`
      : null;

  const sent = broadcasts.filter((b) => b.sentAt);
  if (!sent.length) return { ...empty, tracking, error };

  // Widen the window to cover the oldest send. Resend's metrics endpoint
  // rejects ranges outside the account's retention when it is not filtered by
  // id, so a wide default range is only safe because we always pass ids.
  const earliest = sent.reduce(
    (min, b) => (b.sentAt && b.sentAt < min ? b.sentAt : min),
    sent[0].sentAt as string,
  );
  const startDate = isoDay(new Date(new Date(earliest).getTime() - 86_400_000));
  const endDate = isoDay(new Date(Date.now() + 86_400_000));

  let metrics = new Map<string, BroadcastTotals>();
  try {
    metrics = await getBroadcastMetrics(
      sent.map((b) => b.id),
      { startDate, endDate },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    error = error ? `${error} ${message}` : message;
  }

  const localIssues = await db
    .select({
      id: newsletterIssue.id,
      name: newsletterIssue.name,
      resendBroadcastId: newsletterIssue.resendBroadcastId,
    })
    .from(newsletterIssue)
    .where(isNotNull(newsletterIssue.resendBroadcastId));

  const byBroadcast = new Map(
    localIssues.map((i) => [i.resendBroadcastId as string, i]),
  );

  const reports: BroadcastReport[] = sent
    .map((broadcast) => {
      const local = byBroadcast.get(broadcast.id);
      return {
        ...broadcast,
        issueId: local?.id ?? null,
        issueName: local?.name ?? null,
        totals: metrics.get(broadcast.id) ?? null,
      };
    })
    .sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""));

  const totals: BroadcastTotals = {};
  for (const key of SUM_METRICS) {
    const values = reports.flatMap((report) => {
      const value = report.totals?.[key];
      return value === undefined ? [] : [value];
    });
    if (values.length)
      totals[key] = values.reduce((sum, value) => sum + value, 0);
  }

  return {
    reports,
    totals,
    metricReportCount: reports.filter((report) => report.totals !== null)
      .length,
    tracking,
    error,
  };
}

/** Percentage of `part` in `whole`, or null when there is nothing to divide. */
export function rate(part: number | undefined, whole: number | undefined) {
  if (part === undefined || !whole) return null;
  return (part / whole) * 100;
}
