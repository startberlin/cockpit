import { Skeleton } from "@/components/ui/skeleton";

export default function MyGroupsLoading() {
  return (
    <div className="w-full space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <div className="grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[60px] rounded-lg" />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <div className="grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-[60px] rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
