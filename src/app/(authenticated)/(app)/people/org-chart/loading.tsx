import { Skeleton } from "@/components/ui/skeleton";

export default function OrgChartLoading() {
  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-44" />
      </div>

      {/* Canvas area */}
      <div className="flex-1 min-h-0 rounded-lg border overflow-hidden p-8">
        {/* Officer row */}
        <div className="flex gap-5 mb-16">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] w-[200px] rounded-lg" />
          ))}
        </div>

        {/* Dept columns row */}
        <div className="flex gap-10">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-4">
              <Skeleton className="h-11 w-[200px] rounded-md" />
              <Skeleton className="h-[88px] w-[200px] rounded-lg" />
              <Skeleton className="h-[88px] w-[200px] rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
