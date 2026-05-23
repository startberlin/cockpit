import { Skeleton } from "@/components/ui/skeleton";

export default function RemoveLoading() {
  return (
    <div className="w-full max-w-2xl space-y-6">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-8 w-24" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-32 w-full rounded-lg" />
      <div className="flex gap-3">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  );
}
