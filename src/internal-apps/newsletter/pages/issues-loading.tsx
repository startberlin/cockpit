import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "../components/page-container";

export default function IssuesLoading() {
  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-4 pb-6">
        <div className="flex max-w-full flex-col gap-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-8 w-28" />
      </div>

      <Skeleton className="mb-6 h-20 w-full" />

      <div className="flex flex-col gap-4">
        <div className="flex min-w-0 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-8 min-w-0 flex-1 sm:w-20 sm:flex-none"
            />
          ))}
        </div>
        <div className="overflow-hidden rounded-md border">
          <Skeleton className="h-10 w-full rounded-none" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-none border-t" />
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
