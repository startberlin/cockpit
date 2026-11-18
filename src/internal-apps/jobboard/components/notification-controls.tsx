"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellIcon, CheckIcon } from "lucide-react";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { Button } from "@/components/ui/button";
import {
  getUnreadNotificationCount,
  markNotificationRead,
} from "../actions/notification";

const countKey = (viewerId: string) => [
  "jobboard-notification-count",
  viewerId,
];

export function NotificationBell({ viewerId }: { viewerId: string }) {
  const { data: count } = useQuery({
    queryKey: countKey(viewerId),
    queryFn: () => getUnreadNotificationCount(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: "always",
    retry: false,
  });
  const label = count ? `Notifications, ${count} unread` : "Notifications";
  return (
    <Button asChild size="icon" variant="ghost" className="relative">
      <Link href="/notifications" aria-label={label} title={label}>
        <BellIcon aria-hidden="true" />
        {count !== undefined && count > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-1 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 font-semibold tabular-nums text-primary-foreground"
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Link>
    </Button>
  );
}

export function NotificationReadControl({
  viewerId,
  isRead,
  submissionId,
}: {
  viewerId: string;
  isRead: boolean;
  submissionId: string;
}) {
  const queryClient = useQueryClient();
  const action = useAction(markNotificationRead, {
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: countKey(viewerId) });
    },
  });

  if (isRead)
    return <span className="text-sm text-muted-foreground">Read</span>;
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={action.isPending}
        onClick={() => action.execute({ id: submissionId })}
      >
        <CheckIcon aria-hidden="true" />
        {action.isPending ? "Marking as read" : "Mark as read"}
      </Button>
      {action.hasErrored && (
        <p role="alert" className="text-sm text-destructive">
          {action.result.serverError ??
            "Unable to mark this notification as read. Try again."}
        </p>
      )}
    </div>
  );
}
