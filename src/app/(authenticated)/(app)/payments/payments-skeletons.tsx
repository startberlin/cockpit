import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function PaymentStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-6">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border bg-card p-4 shadow-xs">
          <Skeleton className="h-3.5 w-20 mb-3" />
          <Skeleton className="h-9 w-16 mb-2" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function ProposedPaymentsSkeleton() {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-4 pb-3">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-4 w-20" />
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
            {[0, 1, 2].map((i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3 w-36" />
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3.5 w-48" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="h-3.5 w-16 ml-auto" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-4" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
