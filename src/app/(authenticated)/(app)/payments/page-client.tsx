"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  FilterIcon,
  InfoIcon,
  Loader2,
  SearchIcon,
  XIcon,
  ZapIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  useQueryState,
} from "nuqs";
import * as React from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  MembershipPaymentCycleWithUser,
  PaymentStats,
} from "@/db/membership-payments";
import type { GcPaymentRecord } from "@/lib/gocardless/payments";
import { chargeAction } from "./charge-action";
import { declineAction } from "./decline-action";
import {
  GcPaymentStatusBadge,
  type PaymentStatus,
  PaymentStatusBadge,
} from "./payment-status-badge";

const DEFAULT_HISTORY_STATUSES = [
  "pending",
  "submitted",
  "confirmed",
  "paid_out",
  "failed",
  "cancelled",
  "charged_back",
] as const satisfies string[];

const ALL_HISTORY_STATUSES = [
  ...DEFAULT_HISTORY_STATUSES,
  "declined",
] as const satisfies string[];

const HISTORY_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  submitted: "Submitted",
  confirmed: "Confirmed",
  paid_out: "Paid out",
  failed: "Failed",
  cancelled: "Cancelled",
  charged_back: "Charged back",
  declined: "Declined",
};

function formatAmount(amountCents: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amountCents / 100);
}

function formatDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function coveragePeriod(activationDate: string): string {
  const start = new Date(`${activationDate}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  end.setUTCDate(end.getUTCDate() - 1);
  return `${formatDate(activationDate)} – ${formatDate(end.toISOString().slice(0, 10))}`;
}

function daysSince(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${isoDate}T00:00:00Z`);
  return Math.round((today.getTime() - d.getTime()) / 86400000);
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function isDefaultStatuses(statuses: string[]): boolean {
  return (
    statuses.length === DEFAULT_HISTORY_STATUSES.length &&
    DEFAULT_HISTORY_STATUSES.every((s) => statuses.includes(s))
  );
}

interface Props {
  proposed: MembershipPaymentCycleWithUser[];
  history: { rows: MembershipPaymentCycleWithUser[]; total: number };
  stats: PaymentStats;
  selectedRow: MembershipPaymentCycleWithUser | null;
  gcHistoryPromise: Promise<GcPaymentRecord[]>;
  pageSize: number;
}

export default function PaymentsPageClient({
  proposed,
  history,
  stats,
  selectedRow,
  gcHistoryPromise,
  pageSize,
}: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useQueryState("selected", {
    shallow: false,
  });
  const [page, setPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({ shallow: false }),
  );
  const [q, setQ] = useQueryState(
    "q",
    parseAsString.withDefault("").withOptions({ shallow: false }),
  );
  const [statuses, setStatuses] = useQueryState(
    "statuses",
    parseAsArrayOf(parseAsString)
      .withDefault([...DEFAULT_HISTORY_STATUSES])
      .withOptions({ shallow: false }),
  );
  const [inputValue, setInputValue] = React.useState(q);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue !== q) {
        setQ(inputValue);
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue, q, setPage, setQ]);

  const historyTotalPages = Math.max(1, Math.ceil(history.total / pageSize));
  const isFiltered = !isDefaultStatuses(statuses);

  const toggleStatus = React.useCallback(
    (status: string) => {
      const next = statuses.includes(status)
        ? statuses.filter((s) => s !== status)
        : [...statuses, status];
      setStatuses(next.length === 0 ? [...DEFAULT_HISTORY_STATUSES] : next);
      setPage(1);
    },
    [statuses, setStatuses, setPage],
  );

  const columns = React.useMemo<ColumnDef<MembershipPaymentCycleWithUser>[]>(
    () => [
      {
        id: "member",
        header: "Member",
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <Avatar className="h-8 w-8 text-xs">
              <AvatarFallback>
                {getInitials(row.original.userName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium text-sm">{row.original.userName}</div>
              <div className="text-muted-foreground text-xs">
                {row.original.userEmail}
              </div>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "activationDate",
        header: "Coverage period",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">
            {coveragePeriod(getValue() as string)}
          </span>
        ),
      },
      {
        accessorKey: "amount",
        header: () => <div className="text-right">Amount</div>,
        cell: ({ getValue }) => (
          <div className="text-right font-semibold text-sm">
            {formatAmount(getValue() as number)}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: () => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-8 gap-1 font-normal data-[state=open]:bg-accent"
              >
                Status
                {isFiltered && (
                  <FilterIcon className="h-2.5 w-2.5 text-primary" />
                )}
                <ChevronDownIcon className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              {ALL_HISTORY_STATUSES.map((status) => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={statuses.includes(status)}
                  onCheckedChange={() => toggleStatus(status)}
                >
                  {HISTORY_STATUS_LABELS[status]}
                </DropdownMenuCheckboxItem>
              ))}
              {isFiltered && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="justify-center text-xs text-muted-foreground"
                    onClick={() => {
                      setStatuses([...DEFAULT_HISTORY_STATUSES]);
                      setPage(1);
                    }}
                  >
                    Reset to default
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        cell: ({ getValue }) => (
          <PaymentStatusBadge status={getValue() as PaymentStatus} />
        ),
      },
    ],
    [statuses, isFiltered, toggleStatus, setStatuses, setPage],
  );

  const table = useReactTable({
    data: history.rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      <div className="pb-6">
        <h1 className="text-xl font-semibold">Payments</h1>
        <p className="text-muted-foreground text-sm mt-1">
          When a member's annual fee comes due, START Cockpit proposes a charge
          here. Review their mandate and payment history, then approve to
          collect the payment.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-6 *:data-[slot=card]:shadow-xs">
        <Card>
          <CardHeader className="max-sm:has-data-[slot=card-action]:grid-cols-1">
            <CardDescription>Proposed</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums">
              {stats.proposedCount}
            </CardTitle>
            <CardAction className="max-sm:[grid-area:auto] max-sm:justify-self-start">
              <Badge variant="outline">
                {formatAmount(stats.proposedAmount)}
              </Badge>
            </CardAction>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="max-sm:has-data-[slot=card-action]:grid-cols-1">
            <CardDescription>Processing</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums">
              {stats.inFlightCount}
            </CardTitle>
            <CardAction className="max-sm:[grid-area:auto] max-sm:justify-self-start">
              <Badge variant="outline">
                {formatAmount(stats.inFlightAmount)}
              </Badge>
            </CardAction>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="max-sm:has-data-[slot=card-action]:grid-cols-1">
            <CardDescription>Confirmed</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums">
              {formatAmount(stats.confirmedAmount)}
            </CardTitle>
            <CardDescription className="text-xs sm:hidden">
              Payout confirmed
            </CardDescription>
            <CardAction className="max-sm:hidden">
              <Tooltip>
                <TooltipTrigger>
                  <InfoIcon className="size-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Payments confirmed by the member's bank that will be
                    received soon.
                  </p>
                </TooltipContent>
              </Tooltip>
            </CardAction>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="max-sm:has-data-[slot=card-action]:grid-cols-1">
            <CardDescription>Collected</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums">
              {formatAmount(stats.collectedAmount)}
            </CardTitle>
            <CardDescription className="text-xs sm:hidden">
              Payments collected within the last 365 days.
            </CardDescription>
            <CardAction className="max-sm:hidden">
              <Tooltip>
                <TooltipTrigger>
                  <InfoIcon className="size-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Payments collected within the last 365 days.</p>
                </TooltipContent>
              </Tooltip>
            </CardAction>
          </CardHeader>
        </Card>
      </div>

      {/* ── Proposed ─────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 pb-3">
          <h2 className="text-sm font-semibold">Proposed payments</h2>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {proposed.length} proposal{proposed.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Coverage period</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Mandate</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {proposed.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-muted-foreground text-sm"
                  >
                    No payments are waiting for review.
                  </TableCell>
                </TableRow>
              ) : (
                proposed.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={selectedId === row.id ? "selected" : undefined}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(row.id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8 text-xs">
                          <AvatarFallback>
                            {getInitials(row.userName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm">
                            {row.userName}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {row.userEmail}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {coveragePeriod(row.activationDate)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-sm">
                      {formatAmount(row.amount)}
                    </TableCell>
                    <TableCell>
                      {row.gocardlessMandateId ? (
                        <Badge
                          variant="outline"
                          className="text-green-700 border-green-200 bg-green-50"
                        >
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="destructive">No mandate</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Payment history ───────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <h2 className="text-sm font-semibold">Payment history</h2>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:flex-none">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                className="h-8 text-sm pl-8 w-full sm:w-48"
                placeholder="Search by name or email"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
            </div>
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {history.total} payment{history.total === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="py-10 text-center text-muted-foreground text-sm"
                  >
                    {q || isFiltered
                      ? "No payments match your filters."
                      : "No payments have been approved yet."}
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="opacity-75">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between pt-3">
          <span className="text-xs text-muted-foreground">
            Page {page} of {historyTotalPages}
          </span>
          <Pagination className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage(Math.max(1, page - 1))}
                  aria-disabled={page <= 1}
                  className={
                    page <= 1
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  onClick={() => setPage(Math.min(historyTotalPages, page + 1))}
                  aria-disabled={page >= historyTotalPages}
                  className={
                    page >= historyTotalPages
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>

      {/* ── Drawer ──────────────────────────────────────────── */}
      <Sheet
        open={selectedRow !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg overflow-y-auto flex flex-col"
        >
          {selectedRow && (
            <ProposedDrawer
              row={selectedRow}
              gcHistoryPromise={gcHistoryPromise}
              onSuccess={() => {
                setSelectedId(null);
                router.refresh();
              }}
              onClose={() => setSelectedId(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

// ── GC History (for proposed drawer) ────────────────────────

function GcHistoryTable({ promise }: { promise: Promise<GcPaymentRecord[]> }) {
  const gcHistory = React.use(promise);
  return (
    <div className="rounded-lg border overflow-hidden">
      {gcHistory.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">
          No previous charges on record.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gcHistory.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-sm">
                  {p.chargeDate ? formatDate(p.chargeDate) : "—"}
                </TableCell>
                <TableCell className="text-right text-sm font-medium">
                  {formatAmount(p.amount)}
                </TableCell>
                <TableCell>
                  <GcPaymentStatusBadge status={p.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function GcHistorySkeleton() {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[0, 1].map((i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="h-4 w-14 ml-auto" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-16 rounded-full" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Proposed drawer ──────────────────────────────────────────

function ProposedDrawer({
  row,
  gcHistoryPromise,
  onSuccess,
  onClose,
}: {
  row: MembershipPaymentCycleWithUser;
  gcHistoryPromise: Promise<GcPaymentRecord[]>;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [declineReason, setDeclineReason] = React.useState("");
  const [actionError, setActionError] = React.useState<string | null>(null);

  const { execute: charge, isPending: isCharging } = useAction(chargeAction, {
    onSuccess: () => {
      setActionError(null);
      onSuccess();
    },
    onError: ({ error }) => {
      setActionError(error.serverError ?? "Something went wrong.");
    },
  });

  const { execute: decline, isPending: isDeclining } = useAction(
    declineAction,
    {
      onSuccess: () => {
        setActionError(null);
        onSuccess();
      },
      onError: ({ error }) => {
        setActionError(error.serverError ?? "Something went wrong.");
      },
    },
  );

  const isAnyPending = isCharging || isDeclining;
  const mandateInactive = !row.gocardlessMandateId;
  const days = daysSince(row.activationDate);

  return (
    <>
      <SheetHeader className="border-b pb-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback>{getInitials(row.userName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-base leading-tight">
              {row.userName}
            </SheetTitle>
            <SheetDescription className="text-sm leading-snug">
              {row.userEmail}
            </SheetDescription>
            <div className="mt-1.5">
              {row.gocardlessMandateId ? (
                <Badge
                  variant="outline"
                  className="text-green-700 border-green-200 bg-green-50"
                >
                  Active member
                </Badge>
              ) : (
                <Badge variant="destructive">No mandate</Badge>
              )}
            </div>
          </div>
        </div>
      </SheetHeader>

      <div className="flex flex-col gap-5 pt-5 flex-1">
        <div className="rounded-lg border divide-y text-sm">
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-muted-foreground">Membership year</span>
            <span className="font-medium">
              {coveragePeriod(row.activationDate)}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-medium">{formatAmount(row.amount)}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-muted-foreground">Status</span>
            <PaymentStatusBadge status="proposed" />
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-muted-foreground">Starts</span>
            <span className="text-muted-foreground">
              {days === 0
                ? "Today"
                : days > 0
                  ? `${days} day${days === 1 ? "" : "s"} ago`
                  : `In ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`}
            </span>
          </div>
        </div>

        {row.gocardlessCustomerId && (
          <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">GoCardless customer</span>
            <Button variant="ghost" size="sm" asChild>
              <a
                href={`https://manage.gocardless.com/customers/${row.gocardlessCustomerId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLinkIcon className="size-3.5" />
                Open in GoCardless
              </a>
            </Button>
          </div>
        )}

        {mandateInactive && (
          <div className="flex gap-3 rounded-lg border border-destructive/25 bg-destructive/5 p-3">
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm leading-relaxed">
              <strong>No active mandate.</strong> This member's Direct Debit
              mandate has been cancelled. Re-establish it before charging.
            </p>
          </div>
        )}

        <div>
          <h3 className="text-sm font-medium mb-2">Payment history</h3>
          <React.Suspense fallback={<GcHistorySkeleton />}>
            <GcHistoryTable promise={gcHistoryPromise} />
          </React.Suspense>
        </div>
      </div>

      <div className="mt-auto border-t pt-4 space-y-3">
        <div className="space-y-1.5">
          <label
            htmlFor="decline-reason"
            className="text-xs font-medium text-muted-foreground"
          >
            Reason for declining
          </label>
          <Textarea
            id="decline-reason"
            placeholder="e.g. Member moved to alumni status"
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            disabled={isAnyPending}
            className="text-sm resize-none min-h-[64px]"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isAnyPending}>
            Cancel
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            onClick={() => decline({ id: row.id, reason: declineReason })}
            disabled={isAnyPending || declineReason.trim().length === 0}
          >
            {isDeclining ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <XIcon className="h-4 w-4" />
                Decline
              </>
            )}
          </Button>
          <Button
            onClick={() => charge({ id: row.id })}
            disabled={isAnyPending || mandateInactive}
          >
            {isCharging ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <ZapIcon className="h-4 w-4" />
                Charge {formatAmount(row.amount)}
              </>
            )}
          </Button>
        </div>
        {actionError && (
          <p className="text-destructive text-sm">{actionError}</p>
        )}
        <p className="text-xs text-muted-foreground leading-relaxed">
          Charging executes a GoCardless Direct Debit. No further proposals
          appear until 1 year after the activation date.
        </p>
      </div>
    </>
  );
}
