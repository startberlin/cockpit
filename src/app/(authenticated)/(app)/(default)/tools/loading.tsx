import { Skeleton } from "@/components/ui/skeleton";
import { appSectionCounts } from "@/lib/apps/registry";

function SectionSkeleton({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-28" />
      <div className="grid md:grid-cols-3 grid-cols-1 sm:grid-cols-2 gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function ToolsLoading() {
  // Counts come from the registry, so the skeleton follows the launcher
  // automatically. loading.tsx renders before any await and cannot know the
  // user's authority, so registry totals are the correct upper bound.
  const sections = appSectionCounts();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="flex flex-col gap-10">
        {sections.map((section) => (
          <SectionSkeleton key={section.category} count={section.count} />
        ))}
      </div>
    </div>
  );
}
