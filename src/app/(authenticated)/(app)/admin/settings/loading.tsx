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
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="p-6 space-y-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="space-y-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, j) => (
                  <Skeleton key={j} className="h-12 rounded-md" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
