import { Skeleton } from "@/components/ui/skeleton";

export default function ToolsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid md:grid-cols-3 grid-cols-1 sm:grid-cols-2 gap-2">
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
      </div>
    </div>
  );
}
