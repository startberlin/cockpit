import { Skeleton } from "@/components/ui/skeleton";

export default function MembershipLoading() {
  return (
    <div className="flex flex-col gap-10">
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
