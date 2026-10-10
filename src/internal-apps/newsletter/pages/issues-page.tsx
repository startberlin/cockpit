import { Mail } from "lucide-react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { createMetadata } from "@/lib/metadata";
import type { IssueMetrics, IssueRow } from "../components/issues-table";
import { IssuesTable } from "../components/issues-table";
import { NewIssueDialog } from "../components/new-issue-dialog";
import { PageContainer, PageHeader } from "../components/page-container";
import { SandboxBanner } from "../components/sandbox-banner";
import { type IssueListItem, listIssues } from "../db/queries";
import { rate } from "../lib/analytics";
import { getBroadcastMetrics, sendMode } from "../lib/resend";
import { syncIssueStatuses } from "../lib/sync-status";

export const metadata = createMetadata({
  title: "Newsletter",
  description: "Write, schedule and measure the START Berlin newsletter.",
});

async function loadIssueMetrics(
  issues: IssueListItem[],
): Promise<IssueMetrics> {
  // One metrics request for the whole page. Resend only breaks results down by
  // broadcast when the ids are passed explicitly, and the filter takes a list,
  // so the entire index costs a single call rather than one per row.
  const sentBroadcastIds = issues
    .filter(
      (issue) =>
        issue.status === "sent" &&
        issue.resendBroadcastId &&
        !issue.resendBroadcastId.startsWith("sandbox_"),
    )
    .map((issue) => issue.resendBroadcastId as string);

  let metrics = new Map<
    string,
    { delivered?: number; unique_clicked?: number }
  >();
  if (sentBroadcastIds.length) {
    const earliest = issues
      .filter((issue) => issue.sentAt)
      .reduce<Date | null>(
        (min, issue) =>
          !min || (issue.sentAt as Date) < min ? (issue.sentAt as Date) : min,
        null,
      );

    try {
      metrics = await getBroadcastMetrics(sentBroadcastIds, {
        startDate: new Date((earliest ?? new Date()).getTime() - 86_400_000)
          .toISOString()
          .slice(0, 10),
        endDate: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
      });
    } catch {
      // Numbers are a bonus on this page; the list itself must always render.
    }
  }

  return Object.fromEntries(
    [...metrics].map(([id, totals]) => [
      id,
      {
        delivered: totals.delivered ?? null,
        uniqueClicked: totals.unique_clicked ?? null,
        clickRate: rate(totals.unique_clicked, totals.delivered),
      },
    ]),
  );
}

export default async function IssuesPage() {
  await syncIssueStatuses();
  const issues = await listIssues();
  const mode = sendMode();
  // Only the metric cells suspend. Slow Resend analytics must not delay writing
  // or replace an open row menu when their response arrives.
  const metrics = loadIssueMetrics(issues);

  const rows: IssueRow[] = issues.map((issue) => ({
    id: issue.id,
    name: issue.name,
    subject: issue.subject,
    status: issue.status,
    blockCount: issue.blockCount,
    updatedAt: issue.updatedAt.toISOString(),
    scheduledAt: issue.scheduledAt?.toISOString() ?? null,
    sentAt: issue.sentAt?.toISOString() ?? null,
    resendBroadcastId: issue.resendBroadcastId,
  }));

  return (
    <PageContainer>
      <PageHeader
        title="Issues"
        description="Every edition, newest first."
        action={<NewIssueDialog />}
      />

      <SandboxBanner mode={mode} />

      {issues.length === 0 ? (
        <Empty className="border bg-muted/30">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Mail />
            </EmptyMedia>
            <EmptyTitle>No issues yet</EmptyTitle>
            <EmptyDescription>
              An issue is built from blocks: a hero, some sections, three
              startups, whatever the month calls for. Start one and the composer
              takes it from there.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <NewIssueDialog />
          </EmptyContent>
        </Empty>
      ) : (
        <IssuesTable rows={rows} metrics={metrics} />
      )}
    </PageContainer>
  );
}
