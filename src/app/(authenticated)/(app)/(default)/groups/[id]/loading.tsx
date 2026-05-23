import { Skeleton } from "@/components/ui/skeleton";

export default function GroupDetailLoading() {
  return (
    <div className="w-full space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-[76px] rounded-xl" />
        <Skeleton className="h-[76px] rounded-xl" />
      </div>

      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[52px] w-full" />
        ))}
      </div>
    </div>
  );
}
