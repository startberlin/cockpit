"use client";

import { ChevronRightIcon } from "lucide-react";
import { useQueryState } from "nuqs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MembershipPaymentCycleWithUser } from "@/db/membership-payments";

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

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function ProposedPaymentsTable({
  proposed,
}: {
  proposed: MembershipPaymentCycleWithUser[];
}) {
  const [selectedId, setSelectedId] = useQueryState("selected", {
    shallow: false,
  });

  return (
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
                      <div className="font-medium text-sm">{row.userName}</div>
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
  );
}
