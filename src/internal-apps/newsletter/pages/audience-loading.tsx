import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "../components/page-container";

export default function AudienceLoading() {
  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-4 pb-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex max-w-full flex-wrap gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-36" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pb-6 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-3 pb-6 sm:grid-cols-2">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
      <Skeleton className="mb-4 h-9 w-64" />
      <div className="overflow-hidden rounded-md border">
        <Skeleton className="h-10 w-full rounded-none" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-none border-t" />
        ))}
      </div>
    </PageContainer>
  );
}
