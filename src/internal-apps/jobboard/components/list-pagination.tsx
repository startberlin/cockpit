"use client";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  MANAGEMENT_PAGE_SIZE,
  type ListPagination as Pagination,
} from "../lib/list-params";
export function ListCount({
  page,
  matched,
  total,
  singular,
  plural,
}: Pick<Pagination, "page" | "matched"> & {
  total: number;
  singular: string;
  plural: string;
}) {
  const first = (page - 1) * MANAGEMENT_PAGE_SIZE + 1;
  const range =
    matched > MANAGEMENT_PAGE_SIZE
      ? `${first}–${Math.min(first + MANAGEMENT_PAGE_SIZE - 1, matched)} of ${matched}`
      : matched;
  return (
    <p aria-live="polite" className="text-sm text-muted-foreground">
      Showing{" "}
      <span className="font-medium tabular-nums text-foreground">{range}</span>{" "}
      {matched === 1 ? singular : plural}
      {total !== matched ? ` (${total} total)` : ""}
    </p>
  );
}

export function ListPagination({
  page,
  pageCount,
  hrefForPage,
}: Pick<Pagination, "page" | "pageCount"> & {
  hrefForPage: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  const linkClass = buttonVariants({
    variant: "outline",
    className: "min-h-11",
  });
  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-2"
    >
      {page > 1 ? (
        <Link href={hrefForPage(page - 1)} className={linkClass} scroll={false}>
          <ChevronLeftIcon aria-hidden="true" /> Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm tabular-nums" aria-live="polite">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={hrefForPage(page + 1)} className={linkClass} scroll={false}>
          Next <ChevronRightIcon aria-hidden="true" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
