import {
  ArchiveIcon,
  CheckIcon,
  CircleCheckIcon,
  Clock3Icon,
  FilePenLineIcon,
  PauseIcon,
  XIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string }) {
  const definitions = {
    published: {
      label: "Published",
      icon: CircleCheckIcon,
      className: "border-brand/15 bg-brand text-brand-foreground",
    },
    draft: {
      label: "Draft",
      icon: FilePenLineIcon,
      className: "border-border bg-muted/60 text-muted-foreground",
    },
    pending_review: {
      label: "Needs review",
      icon: Clock3Icon,
      className: "border-brand-accent/30 bg-brand-accent/15 text-brand",
    },
    accepted: {
      label: "Draft created",
      icon: CheckIcon,
      className: "border-border bg-muted/60 text-foreground",
    },
    paused: {
      label: "Paused",
      icon: PauseIcon,
      className: "border-border bg-card text-muted-foreground",
    },
    closed: {
      label: "Closed",
      icon: ArchiveIcon,
      className: "border-border bg-muted/50 text-muted-foreground",
    },
    expired: {
      label: "Expired",
      icon: Clock3Icon,
      className: "border-border bg-muted/50 text-muted-foreground",
    },
    rejected: {
      label: "Rejected",
      icon: XIcon,
      className: "border-border bg-card text-muted-foreground",
    },
  };
  const definition = definitions[status as keyof typeof definitions];
  const Icon = definition?.icon;
  return (
    <Badge variant="outline" className={definition?.className}>
      {Icon ? <Icon aria-hidden="true" /> : null}
      {definition?.label ?? status.replaceAll("_", " ")}
    </Badge>
  );
}

export function formatDate(
  value: Date | string | null | undefined,
  timeZone = "Europe/Berlin",
) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  });
}
