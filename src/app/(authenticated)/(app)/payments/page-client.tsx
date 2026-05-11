"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useQueryState } from "nuqs";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MembershipPaymentCycleWithUser } from "@/db/membership-payments";
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

function formatAmount(amountCents: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amountCents / 100);
}

function formatDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString("de-DE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function coveragePeriod(activationDate: string): string {
  const start = new Date(`${activationDate}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  end.setUTCDate(end.getUTCDate() - 1);
  return `${formatDate(activationDate)} – ${formatDate(end.toISOString().slice(0, 10))}`;
}

function StatusBadge({ status }: { status: MembershipPaymentCycleStatus }) {
  return (
    <Badge variant={STATUS_BADGE_VARIANT[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

interface Props {
  rows: MembershipPaymentCycleWithUser[];
  gcHistoryMap: Record<string, GcPaymentRecord[]>;
}

export default function PaymentsPageClient({ rows, gcHistoryMap }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useQueryState("selected");
  const [showAll, setShowAll] = React.useState(false);

  const proposed = rows.filter((r) => r.status === "proposed");
  const approved = rows.filter(
    (r) => r.status === "pending" || r.status === "submitted",
  );
  const confirmed = rows.filter(
    (r) => r.status === "confirmed" || r.status === "paid_out",
  );

  const visibleRows = showAll ? rows : proposed;
  const selectedRow = selectedId
    ? (rows.find((r) => r.id === selectedId) ?? null)
    : null;

  const gcHistory = selectedRow?.gocardlessCustomerId
    ? (gcHistoryMap[selectedRow.gocardlessCustomerId] ?? [])
    : [];

  return (
    <>
      <div className="pb-6">
        <h1 className="text-xl font-semibold">Payments</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Review and approve member payment proposals.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 pb-6">
        <Card>
          <CardHeader>
            <CardTitle>Proposed</CardTitle>
            <CardDescription className="text-3xl font-bold tabular-nums">
              {proposed.length}
            </CardDescription>
            <CardAction>
              <Badge variant="outline">
                {formatAmount(proposed.length * 4000)}
              </Badge>
            </CardAction>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Approved</CardTitle>
            <CardDescription className="text-3xl font-bold tabular-nums">
              {approved.length}
            </CardDescription>
            <CardAction>
              <Badge variant="outline">
                {formatAmount(approved.length * 4000)}
              </Badge>
            </CardAction>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Confirmed</CardTitle>
            <CardDescription className="text-3xl font-bold tabular-nums">
              {confirmed.length}
            </CardDescription>
            <CardAction>
              <Badge variant="outline">
                {formatAmount(confirmed.length * 4000)}
              </Badge>
            </CardAction>
          </CardHeader>
        </Card>
      </div>

      {/* Filter toggle */}
      <div className="flex items-center gap-2 pb-4">
        <Switch id="show-all" checked={showAll} onCheckedChange={setShowAll} />
        <Label htmlFor="show-all">Show all statuses</Label>
      </div>

      {/* Table */}
      {visibleRows.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          {showAll ? "No payments to show." : "No proposed payments."}
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Coverage period</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(row.id)}
                >
                  <TableCell>
                    <div className="font-medium">{row.userName}</div>
                    <div className="text-muted-foreground text-xs">
                      {row.userEmail}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {coveragePeriod(row.activationDate)}
                  </TableCell>
                  <TableCell>{formatAmount(row.amount)}</TableCell>
                  <TableCell>
                    <StatusBadge
                      status={row.status as MembershipPaymentCycleStatus}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail drawer */}
      <Sheet
        open={selectedRow !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg overflow-y-auto"
        >
          {selectedRow && (
            <PaymentDrawer
              row={selectedRow}
              gcHistory={gcHistory}
              onSuccess={() => {
                setSelectedId(null);
                router.refresh();
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function PaymentDrawer({
  row,
  gcHistory,
  onSuccess,
}: {
  row: MembershipPaymentCycleWithUser;
  gcHistory: GcPaymentRecord[];
  onSuccess: () => void;
}) {
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
  const isProposed = row.status === "proposed";

  return (
    <>
      <SheetHeader>
        <SheetTitle>{row.userName}</SheetTitle>
        <SheetDescription>{row.userEmail}</SheetDescription>
      </SheetHeader>

      <div className="mt-6 space-y-6">
        {/* Status + coverage */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status</span>
            <StatusBadge status={row.status as MembershipPaymentCycleStatus} />
          </div>
          <div className="text-sm">
            <span className="font-medium">Coverage period: </span>
            {coveragePeriod(row.activationDate)}
          </div>
          <div className="text-sm">
            <span className="font-medium">Amount: </span>
            {formatAmount(row.amount)}
          </div>
        </div>

        {/* GC payment history */}
        <div>
          <h3 className="text-sm font-semibold mb-2">
            GoCardless payment history
          </h3>
          {gcHistory.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No payment history yet.
            </p>
          ) : (
            <div className="space-y-2">
              {gcHistory.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between text-sm border rounded px-3 py-2"
                >
                  <div>
                    <span className="font-mono text-xs text-muted-foreground">
                      {p.id}
                    </span>
                    <div>{p.chargeDate ? formatDate(p.chargeDate) : "—"}</div>
                  </div>
                  <div className="text-right">
                    <div>{formatAmount(p.amount)}</div>
                    <Badge variant="outline" className="text-xs">
                      {p.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        {isProposed && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => decline({ id: row.id })}
                disabled={isAnyPending}
                className="flex-1"
              >
                {isDeclining ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Decline"
                )}
              </Button>
              <Button
                onClick={() => charge({ id: row.id })}
                disabled={isAnyPending}
                className="flex-1"
              >
                {isCharging ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  `Charge ${formatAmount(row.amount)}`
                )}
              </Button>
            </div>
            {actionError && (
              <p className="text-destructive text-sm">{actionError}</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
