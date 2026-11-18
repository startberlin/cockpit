import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  createSearchParamsCache,
  createSerializer,
  parseAsInteger,
  type SearchParams,
} from "nuqs/server";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/internal-apps/jobboard/components/status-badge";
import {
  getNotificationViewer,
  notifications,
} from "@/internal-apps/jobboard/lib/notifications";
import { createMetadata } from "@/lib/metadata";
import { cn } from "@/lib/utils";

export const metadata = createMetadata({
  title: "Notifications",
  description: "Your Jobboard submission notifications.",
});

const params = { page: parseAsInteger.withDefault(1) };
const search = createSearchParamsCache(params);
const inboxUrl = createSerializer(params);

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await getNotificationViewer();
  if (!viewer) notFound();
  const { page } = await search.parse(searchParams);
  if (!Number.isSafeInteger(page) || page < 1) redirect("/notifications");
  const { items, hasNext } = await notifications.list(viewer.id, page);
  if (!items.length && page > 1) redirect("/notifications");

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Jobboard submissions shared with you.
        </p>
      </header>
      {items.length ? (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {items.map((item) => (
            <li key={item.submissionId}>
              <Link
                href={`/notifications/jobboard/${encodeURIComponent(item.submissionId)}`}
                className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-4 hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-5"
              >
                <div className="min-w-0 flex-1 basis-44 space-y-1">
                  <p
                    className={cn(
                      "wrap-anywhere text-sm",
                      !item.readAt && "font-semibold",
                    )}
                  >
                    {item.title}
                  </p>
                  <p className="wrap-anywhere text-sm text-muted-foreground">
                    {item.company}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <time dateTime={item.createdAt.toISOString()}>
                    {formatDate(item.createdAt)}
                  </time>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5",
                      !item.readAt && "font-medium text-foreground",
                    )}
                  >
                    {!item.readAt && (
                      <span
                        aria-hidden="true"
                        className="size-1.5 rounded-full bg-primary"
                      />
                    )}
                    {item.readAt ? "Read" : "Unread"}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border px-5 py-8 text-sm text-muted-foreground">
          You have no Jobboard notifications yet.
        </p>
      )}
      {(page > 1 || hasNext) && (
        <nav
          aria-label="Notification pages"
          className="flex flex-wrap items-center gap-3"
        >
          {page > 1 && (
            <Button asChild variant="outline" size="sm">
              <Link href={inboxUrl("/notifications", { page: page - 1 })}>
                <ChevronLeftIcon aria-hidden="true" />
                Previous
              </Link>
            </Button>
          )}
          <span className="text-sm text-muted-foreground">Page {page}</span>
          {hasNext && (
            <Button asChild variant="outline" size="sm">
              <Link href={inboxUrl("/notifications", { page: page + 1 })}>
                Next
                <ChevronRightIcon aria-hidden="true" />
              </Link>
            </Button>
          )}
        </nav>
      )}
    </div>
  );
}
