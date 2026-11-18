import { Skeleton } from "@/components/ui/skeleton";

export default function JobboardLoading() {
  return (
    <div
      className="mx-auto w-full min-w-0 max-w-7xl space-y-7"
      role="status"
      aria-label="Loading jobboard"
      aria-busy="true"
    >
      <span className="sr-only">Loading jobboard management</span>
      <div className="flex items-start justify-between gap-4">
        <div className="w-full max-w-lg space-y-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <Skeleton className="hidden h-11 w-28 sm:block" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {["published", "drafts", "review", "companies"].map((key) => (
          <Skeleton key={key} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="space-y-4">
        <Skeleton className="h-5 w-40" />
        <div className="divide-y rounded-xl border">
          {[1, 2, 3].map((row) => (
            <div key={row} className="space-y-3 p-5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
