import { Skeleton } from "@/components/ui/skeleton";

export default function IssueEditorLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap gap-3 border-b p-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="ml-auto h-8 w-28" />
      </div>
      <Skeleton className="m-2 h-9 shrink-0 lg:hidden" />
      <div className="grid min-h-0 flex-1 gap-5 overflow-hidden p-4 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="hidden h-full w-full lg:block" />
      </div>
    </div>
  );
}
