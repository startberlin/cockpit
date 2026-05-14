import { Skeleton } from "@/components/ui/skeleton";

export default function DirectoryLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 10 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
