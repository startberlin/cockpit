import { Skeleton } from "@/components/ui/skeleton";

export default function TasksLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-14" />
      </div>
      <div className="rounded-md border overflow-hidden">
        <Skeleton className="h-10 w-full rounded-none" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-none border-t" />
        ))}
      </div>
      <div className="flex items-center justify-between mt-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-14" />
      </div>
      <div className="rounded-md border overflow-hidden">
        <Skeleton className="h-10 w-full rounded-none" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-none border-t" />
        ))}
      </div>
    </div>
  );
}
