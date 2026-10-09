import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function OverviewLoading() {
  return (
    <div
      className="space-y-6"
      role="status"
      aria-label="Loading referral overview"
    >
      <Skeleton className="h-11 w-32" />
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-5 w-48" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-6">
        {["referred", "unattributed"].map((metric) => (
          <Card key={metric}>
            <CardContent>
              <Skeleton className="h-10 w-12" />
              <Skeleton className="mt-2 h-5 w-full max-w-36" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="gap-0 py-0">
        <CardContent className="px-3 sm:px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Skeleton className="h-4 w-16" />
                </TableHead>
                <TableHead>
                  <Skeleton className="ml-auto h-4 w-24" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {["first", "second", "third", "fourth", "fifth"].map((row) => (
                <TableRow key={row}>
                  <TableCell className="py-3">
                    <Skeleton className="h-5 w-full max-w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="ml-auto h-5 w-8" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
