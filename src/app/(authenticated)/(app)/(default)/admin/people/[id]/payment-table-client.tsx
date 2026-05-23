"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { GcPaymentRecord } from "@/lib/gocardless/payments";

const PAYMENT_EVENT_LABELS: Record<string, string> = {
  paid: "Payment received",
  confirmed: "Payment received",
  paid_out: "Payment received",
  failed: "Payment failed",
  charged_back: "Payment failed",
  pending_submission: "Payment pending",
  submitted: "Payment pending",
  cancelled: "Payment cancelled",
};

function formatAmount(amountCents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amountCents / 100);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const columnHelper = createColumnHelper<GcPaymentRecord>();

const columns = [
  columnHelper.accessor("chargeDate", {
    header: "Date",
    cell: (info) => formatDate(info.getValue()),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => (
      <Badge variant="outline">
        {PAYMENT_EVENT_LABELS[info.getValue()] ?? info.getValue()}
      </Badge>
    ),
  }),
  columnHelper.accessor("amount", {
    header: () => <span className="block text-right">Amount</span>,
    cell: (info) => (
      <span className="block text-right font-semibold">
        {formatAmount(info.getValue())}
      </span>
    ),
  }),
];

interface PaymentTableClientProps {
  payments: GcPaymentRecord[];
}

export function PaymentTableClient({ payments }: PaymentTableClientProps) {
  const table = useReactTable({
    data: payments,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id} className="first:pl-6 last:pr-6">
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
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id} className="text-sm first:pl-6 last:pr-6">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
