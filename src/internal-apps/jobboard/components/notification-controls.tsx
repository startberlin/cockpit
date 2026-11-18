"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellIcon, CheckIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { getUnreadNotificationCount } from "../actions/notification";

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

function MarkReadButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      <CheckIcon aria-hidden="true" />
      {pending ? "Marking as read" : "Mark as read"}
    </Button>
  );
}

export function NotificationReadControl({
  viewerId,
  isRead,
  markRead,
}: {
  viewerId: string;
  isRead: boolean;
  markRead: () => Promise<void>;
}) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (isRead)
      void queryClient.invalidateQueries({ queryKey: countKey(viewerId) });
  }, [isRead, viewerId, queryClient]);

  if (isRead)
    return <span className="text-sm text-muted-foreground">Read</span>;
  return (
    <form action={markRead}>
      <MarkReadButton />
    </form>
  );
}
