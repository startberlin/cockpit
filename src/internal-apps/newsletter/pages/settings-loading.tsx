import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "../components/page-container";

export default function SettingsLoading() {
  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-4 pb-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      <Skeleton className="mb-6 h-20 w-full" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    </PageContainer>
  );
}
