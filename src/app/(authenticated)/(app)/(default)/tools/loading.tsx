import { Skeleton } from "@/components/ui/skeleton";

function SectionSkeleton({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-28" />
      <div className="grid md:grid-cols-3 grid-cols-1 sm:grid-cols-2 gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function ToolsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="flex flex-col gap-10">
        <SectionSkeleton count={3} />
        <SectionSkeleton count={4} />
        <SectionSkeleton count={1} />
      </div>
    </div>
  );
}
