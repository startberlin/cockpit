import { ArrowLeftIcon, InboxIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export function PageHeader({
  title,
  description,
  children,
  back,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="min-w-0 space-y-4">
      {back ? (
        <Link
          href={back.href}
          className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 className="break-words text-2xl font-semibold tracking-tight text-balance">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {children ? (
          <div className="flex shrink-0 flex-wrap gap-2 [&_a]:min-h-11 [&_button]:min-h-11">
            {children}
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function EmptyState({
  title,
  description,
  href,
  action,
  children,
  icon,
}: {
  title: string;
  description: string;
  href?: string;
  action?: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <Empty className="border bg-card py-10 md:py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {icon ?? <InboxIcon aria-hidden="true" />}
        </EmptyMedia>
        <EmptyTitle>
          <h2 className="text-base font-semibold">{title}</h2>
        </EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {href && action ? (
        <EmptyContent>
          <Button className="min-h-11" variant="outline" asChild>
            <Link href={href}>{action}</Link>
          </Button>
        </EmptyContent>
      ) : null}
      {children ? <EmptyContent>{children}</EmptyContent> : null}
    </Empty>
  );
}
