import { Skeleton } from "@/components/ui/skeleton";

export default function AdminSettingsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="rounded-lg border">
        <div className="border-b p-6 space-y-1">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="p-6 space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-10 w-48" />
            </div>
          ))}
          <div className="flex justify-end pt-2">
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </div>
    </div>
  );
}
