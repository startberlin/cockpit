import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "../components/page-container";

export default function AnalyticsLoading() {
  return (
    <PageContainer>
      <div className="pb-6">
        <Skeleton className="h-7 w-20" />
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
