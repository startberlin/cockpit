import { Skeleton } from "@/components/ui/skeleton";

export default function AuditLogLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="rounded-md border">
        <div className="flex h-10 items-center border-b px-4 gap-4">
          {["Event", "Subject", "Actor", "Time"].map((h) => (
            <Skeleton key={h} className="h-4 w-20" />
          ))}
        </div>
        <div className="flex flex-col">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3 border-b last:border-0"
            >
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
