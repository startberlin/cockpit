import { Skeleton } from "@/components/ui/skeleton";

export default function GroupDetailSkeleton() {
  return (
    <div className="w-full space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between pb-1">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-28" />
        </div>
        <Skeleton className="h-10 w-full rounded-t-md" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[52px] w-full" />
        ))}
      </div>
    </div>
  );
}
