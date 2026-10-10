"use client";

import { BarChart3, Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Suspense, use, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { deleteIssueAction, duplicateIssueAction } from "../actions/issues";
import { parseError } from "../lib/error";
import {
  formatCount,
  formatDateTime,
  formatPercent,
  formatRelative,
} from "../lib/format";
import { IssueStatusBadge } from "./issue-status-badge";

export interface IssueRow {
  id: string;
  name: string;
  subject: string;
  status: "draft" | "scheduled" | "sending" | "sent" | "canceled" | "failed";
  blockCount: number;
  updatedAt: string;
  scheduledAt: string | null;
  sentAt: string | null;
  resendBroadcastId: string | null;
}

interface IssueStats {
  delivered: number | null;
  uniqueClicked: number | null;
  clickRate: number | null;
}

export type IssueMetrics = Record<string, IssueStats>;

const FILTERS = ["all", "draft", "scheduled", "sent"] as const;
type Filter = (typeof FILTERS)[number];

const FILTER_LABELS: Record<Filter, string> = {
  all: "All",
  draft: "Drafts",
  scheduled: "Scheduled",
  sent: "Sent",
};

function matchesFilter(row: IssueRow, filter: Filter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "draft":
      return row.status === "draft" || row.status === "failed";
    case "scheduled":
      return row.status === "scheduled" || row.status === "sending";
    case "sent":
      return row.status === "sent";
  }
}

export function IssuesTable({
  rows,
  metrics,
}: {
  rows: IssueRow[];
  metrics: Promise<IssueMetrics>;
}) {
  const router = useRouter();
  const [filter, setFilter] = useQueryState(
    "status",
    parseAsStringLiteral(FILTERS).withDefault("all").withOptions({
      clearOnDefault: true,
    }),
  );
  const [pendingDelete, setPendingDelete] = useState<IssueRow | null>(null);

  const duplicate = useAction(duplicateIssueAction, {
    onSuccess: ({ data }) => {
      toast.success("Copied into a new draft.");
      if (data?.id) router.push(`/newsletter/issues/${data.id}`);
    },
    onError: ({ error }) => toast.error(parseError(error)),
  });

  const remove = useAction(deleteIssueAction, {
    onSuccess: () => {
      setPendingDelete(null);
      toast.success("Issue deleted.");
      router.refresh();
    },
    onError: ({ error }) => toast.error(parseError(error)),
  });

  const visible = rows.filter((row) => matchesFilter(row, filter));

  const counts = Object.fromEntries(
    FILTERS.map((f) => [f, rows.filter((row) => matchesFilter(row, f)).length]),
  ) as Record<Filter, number>;

  /** Sent issues open their report; everything else opens the composer. */
  const hrefFor = (row: IssueRow) =>
    row.status === "sent" &&
    row.resendBroadcastId &&
    !row.resendBroadcastId.startsWith("sandbox_")
      ? `/newsletter/analytics/${row.resendBroadcastId}`
      : `/newsletter/issues/${row.id}`;

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        value={filter}
        onValueChange={(value) => setFilter(value as Filter)}
        className="w-full min-w-0 sm:w-fit"
      >
        <TabsList variant="line" className="w-full">
          {FILTERS.map((value) => (
            <TabsTrigger
              key={value}
              value={value}
              className="min-w-0 px-1 text-xs sm:px-2 sm:text-sm"
            >
              {FILTER_LABELS[value]}
              <span className="ml-1.5 hidden text-xs text-muted-foreground tabular-nums min-[360px]:inline">
                {counts[value]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Issue</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>When</TableHead>
              <TableHead className="text-right">Delivered</TableHead>
              <TableHead className="text-right">Clicks</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  {filter === "all"
                    ? "No issues yet."
                    : `No ${FILTER_LABELS[filter].toLowerCase()}.`}
                </TableCell>
              </TableRow>
            ) : (
              visible.map((row) => (
                <TableRow key={row.id} className="relative cursor-pointer">
                  <TableCell className="max-w-[320px]">
                    {/* Stretch the real link across the row, preserving native
                        keyboard and modified-click navigation. */}
                    <Link
                      href={hrefFor(row)}
                      className="block font-medium after:absolute after:inset-0 hover:underline"
                      title={row.name}
                    >
                      <span className="block truncate">{row.name}</span>
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.subject || "No subject line yet"}
                      {row.blockCount === 0 ? " · empty" : null}
                    </p>
                  </TableCell>

                  <TableCell>
                    <IssueStatusBadge
                      status={row.status}
                      sandbox={row.resendBroadcastId?.startsWith("sandbox_")}
                    />
                  </TableCell>

                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    <WhenCell row={row} />
                  </TableCell>

                  {row.status === "sent" &&
                  row.resendBroadcastId &&
                  !row.resendBroadcastId.startsWith("sandbox_") ? (
                    <Suspense fallback={<MetricCells stats={null} />}>
                      <ResolvedMetricCells
                        broadcastId={row.resendBroadcastId}
                        metrics={metrics}
                      />
                    </Suspense>
                  ) : (
                    <MetricCells stats={null} />
                  )}

                  <TableCell>
                    <div className="relative z-10 flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for ${row.name}`}
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/newsletter/issues/${row.id}`}>
                              <Pencil />
                              {row.status === "draft" ? "Edit" : "Open"}
                            </Link>
                          </DropdownMenuItem>
                          {row.resendBroadcastId &&
                          !row.resendBroadcastId.startsWith("sandbox_") &&
                          row.status === "sent" ? (
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/newsletter/analytics/${row.resendBroadcastId}`}
                              >
                                <BarChart3 />
                                Report
                              </Link>
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem
                            disabled={duplicate.isPending}
                            onSelect={() => duplicate.execute({ id: row.id })}
                          >
                            <Copy />
                            Duplicate
                          </DropdownMenuItem>
                          {row.status === "sent" ||
                          row.status === "scheduled" ||
                          row.status === "sending" ? null : (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={remove.isPending}
                                onSelect={() => setPendingDelete(row)}
                              >
                                <Trash2 />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) =>
          !open && !remove.isPending && setPendingDelete(null)
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the issue and its blocks. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              Keep it
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (pendingDelete && !remove.isPending)
                  remove.execute({ id: pendingDelete.id });
              }}
            >
              {remove.isPending ? "Deleting" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ResolvedMetricCells({
  broadcastId,
  metrics,
}: {
  broadcastId: string;
  metrics: Promise<IssueMetrics>;
}) {
  return <MetricCells stats={use(metrics)[broadcastId] ?? null} />;
}

function MetricCells({ stats }: { stats: IssueStats | null }) {
  return (
    <>
      <TableCell className="text-right tabular-nums">
        {stats?.delivered != null ? formatCount(stats.delivered) : "-"}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {stats ? (
          <span>
            {stats.uniqueClicked != null
              ? formatCount(stats.uniqueClicked)
              : "-"}
            <span className="ml-1.5 text-xs text-muted-foreground">
              {formatPercent(stats.clickRate)}
            </span>
          </span>
        ) : (
          "-"
        )}
      </TableCell>
    </>
  );
}

function WhenCell({ row }: { row: IssueRow }) {
  const { label, value } =
    row.status === "scheduled" && row.scheduledAt
      ? { label: "Goes out", value: row.scheduledAt }
      : row.sentAt
        ? { label: "Sent", value: row.sentAt }
        : { label: "Edited", value: row.updatedAt };

  const date = new Date(value);

  return (
    <span title={`${label} ${formatDateTime(date)}`}>
      <span className="text-xs text-muted-foreground/70">{label} </span>
      {/* A minute can tick over between the server render and hydration. */}
      <span suppressHydrationWarning>{formatRelative(date)}</span>
    </span>
  );
}
