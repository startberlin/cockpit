import { PauseIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getPeopleStatusInfo, type PeopleStatus } from "@/lib/user-status";
import { cn } from "@/lib/utils";

export function PeopleStatusBadge({
  status,
  className,
}: {
  status: PeopleStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        status === "paused" &&
          "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
        className,
      )}
    >
      {status === "paused" && <PauseIcon aria-hidden="true" />}
      {getPeopleStatusInfo(status).label}
    </Badge>
  );
}
