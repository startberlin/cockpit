import { Skeleton } from "@/components/ui/skeleton";

export default function AdminGroupsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-24" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-10 w-64" />
      </div>
      <div className="rounded-md border">
        <div className="flex border-b px-4 py-3 gap-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-32" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex border-b last:border-b-0 px-4 py-3 gap-4 items-center"
          >
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}
