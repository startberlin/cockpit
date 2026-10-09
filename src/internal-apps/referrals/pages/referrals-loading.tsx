import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ReferralsLoading() {
  return (
    <div
      className="mx-auto max-w-2xl space-y-6"
      role="status"
      aria-label="Loading referrals"
    >
      <Skeleton className="h-8 w-48" />
      <Card>
        <CardContent className="space-y-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-24 w-36" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-11 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
