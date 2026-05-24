import { Skeleton } from "@/components/ui/skeleton";

export default function AdminGroupsLoading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-7 w-24" />
      </div>

      {/* System groups skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <div className="rounded-md border">
          <div className="flex border-b px-4 py-3 gap-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-48" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex border-b last:border-b-0 px-4 py-3 gap-4 items-center"
            >
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-48" />
            </div>
          ))}
        </div>
      </div>

      {/* Manual groups skeleton */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="rounded-md border">
          <div className="flex border-b px-4 py-3 gap-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex border-b last:border-b-0 px-4 py-3 gap-4 items-center"
            >
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
