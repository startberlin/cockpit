"use client";

import {
  AlertTriangleIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  InfoIcon,
  Loader2,
  SearchIcon,
  XIcon,
  ZapIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { parseAsInteger, useQueryState } from "nuqs";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

type MembershipPaymentCycleStatus =
  | "proposed"
  | "declined"
  | "pending"
  | "submitted"
  | "confirmed"
  | "paid_out"
  | "failed"
  | "cancelled"
  | "charged_back";

const STATUS_LABELS: Record<MembershipPaymentCycleStatus, string> = {
  proposed: "Proposed",
  declined: "Declined",
  pending: "Pending",
  submitted: "Submitted",
  confirmed: "Confirmed",
  paid_out: "Paid out",
  failed: "Failed",
  cancelled: "Cancelled",
  charged_back: "Charged back",
};

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const STATUS_BADGE_VARIANT: Record<MembershipPaymentCycleStatus, BadgeVariant> =
  {
    proposed: "outline",
    declined: "secondary",
    pending: "secondary",
    submitted: "secondary",
    confirmed: "default",
    paid_out: "default",
    failed: "destructive",
    cancelled: "destructive",
    charged_back: "destructive",
  };

const GC_STATUS_LABELS: Record<string, string> = {
  pending_customer_approval: "Pending approval",
  pending_submission: "Pending",
  submitted: "Submitted",
  confirmed: "Confirmed",
  paid_out: "Paid out",
  cancelled: "Cancelled",
  customer_approval_denied: "Approval denied",
  failed: "Failed",
  charged_back: "Charged back",
};

const GC_STATUS_BADGE_VARIANT: Record<string, BadgeVariant> = {
  pending_customer_approval: "secondary",
  pending_submission: "secondary",
  submitted: "secondary",
  confirmed: "default",
  paid_out: "default",
  cancelled: "secondary",
  customer_approval_denied: "destructive",
  failed: "destructive",
  charged_back: "destructive",
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

function formatDateTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-GB", {
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

interface Props {
  proposed: MembershipPaymentCycleWithUser[];
  approved: { rows: MembershipPaymentCycleWithUser[]; total: number };
  declined: { rows: MembershipPaymentCycleWithUser[]; total: number };
  stats: PaymentStats;
  selectedRow: MembershipPaymentCycleWithUser | null;
  gcHistoryPromise: Promise<GcPaymentRecord[]>;
  pageSize: number;
}

export default function PaymentsPageClient({
  proposed,
  approved,
  declined,
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
  const [dpage, setDpage] = useQueryState(
    "dpage",
    parseAsInteger.withDefault(1).withOptions({ shallow: false }),
  );
  const [q, setQ] = React.useState("");

  const approvedTotalPages = Math.max(1, Math.ceil(approved.total / pageSize));
  const declinedTotalPages = Math.max(1, Math.ceil(declined.total / pageSize));

  const filteredProposed = q
    ? proposed.filter((r) => {
        const lower = q.toLowerCase();
        return (
          r.userName.toLowerCase().includes(lower) ||
          (r.userEmail ?? "").toLowerCase().includes(lower)
        );
      })
    : proposed;

  return (
    <>
      <div className="pb-6">
        <h1 className="text-xl font-semibold">Payments</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Proposed yearly charges ready to be collected via GoCardless Direct
          Debit.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3 pb-6 *:data-[slot=card]:shadow-xs">
        <Card>
          <CardHeader>
            <CardDescription>Proposed</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums">
              {stats.proposedCount}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                {formatAmount(stats.proposedAmount)}
              </Badge>
            </CardAction>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Processing</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums">
              {stats.inFlightCount}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                {formatAmount(stats.inFlightAmount)}
              </Badge>
            </CardAction>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Confirmed</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums">
              {formatAmount(stats.confirmedAmount)}
            </CardTitle>
            <CardAction>
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
          <CardHeader>
            <CardDescription>Collected</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums">
              {formatAmount(stats.collectedAmount)}
            </CardTitle>
            <CardAction>
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
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by name or email"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {filteredProposed.length} proposal
              {filteredProposed.length === 1 ? "" : "s"}
            </span>
          </div>
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
              {filteredProposed.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-muted-foreground text-sm"
                  >
                    {q
                      ? "No proposed payments match this search."
                      : "No proposed payments. All members are covered or in-flight."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredProposed.map((row) => (
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

      {/* ── Approved / historical ────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between pb-3">
          <h2 className="text-sm font-semibold">Payment history</h2>
          <span className="text-sm text-muted-foreground">
            {approved.total} payment{approved.total === 1 ? "" : "s"}
          </span>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Coverage period</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approved.rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-10 text-center text-muted-foreground text-sm"
                  >
                    No payments have been approved yet.
                  </TableCell>
                </TableRow>
              ) : (
                approved.rows.map((row) => (
                  <TableRow key={row.id} className="opacity-75">
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
                      <Badge
                        variant={
                          STATUS_BADGE_VARIANT[
                            row.status as MembershipPaymentCycleStatus
                          ]
                        }
                      >
                        {
                          STATUS_LABELS[
                            row.status as MembershipPaymentCycleStatus
                          ]
                        }
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {approvedTotalPages > 1 && (
          <div className="flex items-center justify-between pt-3">
            <span className="text-xs text-muted-foreground">
              Page {page} of {approvedTotalPages}
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
                    onClick={() =>
                      setPage(Math.min(approvedTotalPages, page + 1))
                    }
                    aria-disabled={page >= approvedTotalPages}
                    className={
                      page >= approvedTotalPages
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      {/* ── Declined (collapsible) ───────────────────────────── */}
      <Collapsible>
        <div className="rounded-md border">
          <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors">
            <div className="flex items-center gap-2">
              <ChevronRightIcon className="h-4 w-4 text-muted-foreground transition-transform duration-150 [[data-state=open]_&]:rotate-90" />
              <span className="text-sm font-semibold">Declined</span>
              <Badge variant="secondary" className="text-xs">
                {declined.total}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              Audit trail — not re-proposed
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Coverage period</TableHead>
                    <TableHead>Declined on</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {declined.rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-10 text-center text-muted-foreground text-sm"
                      >
                        No declined payments.
                      </TableCell>
                    </TableRow>
                  ) : (
                    declined.rows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={
                          selectedId === row.id ? "selected" : undefined
                        }
                        className="cursor-pointer opacity-75"
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
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateTime(row.updatedAt)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {row.declineReason ?? "—"}
                        </TableCell>
                        <TableCell>
                          <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {declinedTotalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <span className="text-xs text-muted-foreground">
                    Page {dpage} of {declinedTotalPages}
                  </span>
                  <Pagination className="mx-0 w-auto">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setDpage(Math.max(1, dpage - 1))}
                          aria-disabled={dpage <= 1}
                          className={
                            dpage <= 1
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          onClick={() =>
                            setDpage(Math.min(declinedTotalPages, dpage + 1))
                          }
                          aria-disabled={dpage >= declinedTotalPages}
                          className={
                            dpage >= declinedTotalPages
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

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
          {selectedRow &&
            (selectedRow.status === "declined" ? (
              <DeclinedDrawer
                row={selectedRow}
                onClose={() => setSelectedId(null)}
              />
            ) : (
              <ProposedDrawer
                row={selectedRow}
                gcHistoryPromise={gcHistoryPromise}
                onSuccess={() => {
                  setSelectedId(null);
                  router.refresh();
                }}
                onClose={() => setSelectedId(null)}
              />
            ))}
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
                  <Badge
                    variant={GC_STATUS_BADGE_VARIANT[p.status] ?? "outline"}
                  >
                    {GC_STATUS_LABELS[p.status] ?? p.status}
                  </Badge>
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
            <Badge variant={STATUS_BADGE_VARIANT.proposed}>Proposed</Badge>
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

// ── Declined drawer ──────────────────────────────────────────

function DeclinedDrawer({
  row,
  onClose,
}: {
  row: MembershipPaymentCycleWithUser;
  onClose: () => void;
}) {
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
              <Badge variant="secondary">Declined</Badge>
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
            <Badge variant="secondary">Declined</Badge>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-muted-foreground">Declined on</span>
            <span className="text-muted-foreground">
              {formatDateTime(row.updatedAt)}
            </span>
          </div>
        </div>

        {row.declineReason && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Reason
            </p>
            <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
              {row.declineReason}
            </div>
          </div>
        )}
      </div>

      <div className="mt-auto border-t pt-4">
        <Button variant="outline" onClick={onClose} className="w-full">
          Close
        </Button>
      </div>
    </>
  );
}
