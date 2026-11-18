import { ChevronDownIcon, HistoryIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "./status-badge";

export function ActivityLog({
  entries,
}: {
  entries: {
    id: string;
    actorName: string;
    description: string;
    createdAt: Date;
  }[];
}) {
  return (
    <details className="group min-w-0 rounded-xl border bg-card shadow-xs">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 p-5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <HistoryIcon
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />{" "}
          Activity history{" "}
          <Badge variant="secondary">
            {entries.length === 500 ? "Latest 500" : entries.length}
          </Badge>
        </span>
        <ChevronDownIcon
          className="size-4 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </summary>
      <div className="border-t px-5 py-2">
        {entries.length ? (
          <ol className="divide-y">
            {entries.map((entry) => (
              <li key={entry.id} className="space-y-2 py-4">
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {entry.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  {entry.actorName} · {formatDate(entry.createdAt)} at{" "}
                  {entry.createdAt.toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Europe/Berlin",
                  })}{" "}
                  (Berlin)
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="py-4 text-sm text-muted-foreground">
            No activity recorded yet.
          </p>
        )}
      </div>
    </details>
  );
}
