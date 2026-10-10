import { cn } from "@/lib/utils";

/**
 * Cockpit's standard reading column, plus the page's scroll container.
 *
 * The app shell bounds its own height so the composer can split into two
 * independently scrolling panes; every other page therefore has to provide its
 * own vertical scroll rather than relying on the document.
 */
export function PageContainer({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full min-h-0 min-w-0 overflow-y-auto">
      <div className={cn("mx-auto w-full max-w-4xl p-6", className)}>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 pb-6">
      <div className="min-w-0 basis-64 flex-1">
        <h1 className="text-xl font-semibold">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="max-w-full">{action}</div> : null}
    </div>
  );
}
