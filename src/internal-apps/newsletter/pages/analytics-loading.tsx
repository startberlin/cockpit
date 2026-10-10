import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "../components/page-container";

export default function AnalyticsLoading() {
  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-4 pb-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-64" />
      </div>

      <div className="grid grid-cols-2 gap-3 pb-6 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="overflow-hidden rounded-md border">
        <Skeleton className="h-10 w-full rounded-none" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-none border-t" />
        ))}
      </div>
    </PageContainer>
  );
}
