import { Skeleton } from "@/components/ui/skeleton";

export default function PermissionsLoading() {
  return (
    <div className="w-full max-w-2xl space-y-6">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-8 w-24" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-md" />
        <Skeleton className="h-16 w-full rounded-md" />
        <Skeleton className="h-16 w-full rounded-md" />
        <Skeleton className="h-16 w-full rounded-md" />
      </div>
    </div>
  );
}
