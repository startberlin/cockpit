import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function MembershipDetailsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <span className="flex flex-col gap-1">
        <Skeleton className="h-4 w-32" />
      </span>
      <Card className="gap-0">
        <CardContent className="flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-48" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
