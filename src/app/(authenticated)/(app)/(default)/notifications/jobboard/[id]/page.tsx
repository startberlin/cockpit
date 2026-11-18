import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BreadcrumbCrumb } from "@/components/breadcrumb-bridge";
import { Button } from "@/components/ui/button";
import { JobPreview } from "@/internal-apps/jobboard/components/job-preview";
import { NotificationReadControl } from "@/internal-apps/jobboard/components/notification-controls";
import {
  formatDate,
  StatusBadge,
} from "@/internal-apps/jobboard/components/status-badge";
import {
  getNotificationViewer,
  notifications,
} from "@/internal-apps/jobboard/lib/notifications";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Jobboard submission",
  description: "Your submission notification.",
});

export default async function NotificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await getNotificationViewer();
  if (!viewer) notFound();
  const { id } = await params;
  const item = await notifications.detail(viewer.id, id);
  if (!item) notFound();
  return (
    <div className="space-y-5">
      <BreadcrumbCrumb
        crumbs={[
          { label: "Notifications", href: "/notifications" },
          { label: "Jobboard submission" },
        ]}
      />
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/notifications">
          <ArrowLeftIcon aria-hidden="true" />
          Back to notifications
        </Link>
      </Button>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Jobboard submission</h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <time dateTime={item.createdAt.toISOString()}>
              Received {formatDate(item.createdAt)}
            </time>
            <StatusBadge status={item.status} />
          </div>
        </div>
        <NotificationReadControl
          viewerId={viewer.id}
          isRead={item.readAt !== null}
          submissionId={item.submissionId}
        />
      </header>
      <section
        aria-label="Submitted job"
        className="rounded-xl border bg-card p-5 sm:p-7"
      >
        <JobPreview content={item.job} company={item.company.name} />
      </section>
    </div>
  );
}
