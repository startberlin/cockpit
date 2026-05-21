import { Skeleton } from "@/components/ui/skeleton";

export default function OrgChartLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Batch filter */}
      <Skeleton className="h-9 w-44" />

      {/* Officers row */}
      <div className="flex justify-center gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[68px] w-[200px]" />
        ))}
      </div>

      {/* Department columns */}
      <div className="grid grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="h-[68px] w-full" />
            <Skeleton className="h-[56px] w-full" />
            <Skeleton className="h-[56px] w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
