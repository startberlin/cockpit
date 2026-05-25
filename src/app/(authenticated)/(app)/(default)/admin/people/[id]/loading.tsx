import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="w-full space-y-6">
      <Skeleton className="h-8 w-20" />

      {/* header: avatar + name + badges */}
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-4">
        <Skeleton className="h-16 w-16 rounded-full sm:h-14 sm:w-14" />
        <div className="flex flex-col items-center gap-2 sm:items-start">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-5 w-64" />
        </div>
      </div>

      {/* summary strip */}
      <div className="grid grid-cols-2 overflow-hidden rounded-lg border sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="px-4 py-3">
            <Skeleton className="mb-1.5 h-3 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>

      {/* membership card */}
      <Skeleton className="h-64 w-full rounded-xl" />

      {/* contact card */}
      <Skeleton className="h-48 w-full rounded-xl" />

      {/* payment section */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-28 w-full rounded-md" />
      </div>

      {/* groups section */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-3 w-56" />
        <Skeleton className="h-24 w-full rounded-md" />
      </div>

      {/* roles & permissions section */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-24 w-full rounded-md" />
      </div>
    </div>
  );
}
