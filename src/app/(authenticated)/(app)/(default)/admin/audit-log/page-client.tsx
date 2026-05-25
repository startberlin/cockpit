"use client";

import { ChevronDownIcon, FilterIcon, SearchIcon } from "lucide-react";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuditLogEntry } from "@/db/audit-log";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "membership",
  "email",
  "payment",
  "group",
  "authority",
  "user",
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  membership: "Membership",
  email: "Email",
  payment: "Payment",
  group: "Group",
  authority: "Authority",
  user: "User",
};

function formatEventLabel(eventType: string): string {
  const parts = eventType.split(".");
  const name = (parts.length > 1 ? parts.slice(1).join(" ") : parts[0]).replace(
    /_/g,
    " ",
  );
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface Props {
  rows: AuditLogEntry[];
  total: number;
  pageSize: number;
}

export default function AuditLogPageClient({ rows, total, pageSize }: Props) {
  const [page, setPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({ shallow: false }),
  );
  const [q, setQ] = useQueryState(
    "q",
    parseAsString
      .withDefault("")
      .withOptions({ shallow: false, throttleMs: 300 }),
  );
  const [category, setCategory] = useQueryState(
    "category",
    parseAsString.withDefault("").withOptions({ shallow: false }),
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const isFiltered = !!category;

  return (
    <div className="mb-6">
      <div className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-none">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="h-8 text-sm pl-8 w-full sm:w-56"
              placeholder="Search by name or event"
              value={q}
              onChange={(e) => {
                setQ(e.target.value || null);
                setPage(1);
              }}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1">
                Category
                {isFiltered && (
                  <FilterIcon className="h-2.5 w-2.5 text-primary" />
                )}
                <ChevronDownIcon className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              {CATEGORIES.map((cat) => (
                <DropdownMenuCheckboxItem
                  key={cat}
                  checked={category === cat}
                  onCheckedChange={(checked) => {
                    setCategory(checked ? cat : null);
                    setPage(1);
                  }}
                >
                  {CATEGORY_LABELS[cat]}
                </DropdownMenuCheckboxItem>
              ))}
              {isFiltered && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="justify-center text-xs text-muted-foreground"
                    onClick={() => {
                      setCategory(null);
                      setPage(1);
                    }}
                  >
                    Show all
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {total} event{total === 1 ? "" : "s"}
        </span>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead className="w-40">Subject</TableHead>
              <TableHead className="w-40">Actor</TableHead>
              <TableHead className="w-24 text-right">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-10 text-center text-muted-foreground text-sm"
                >
                  {q || isFiltered
                    ? "No events match your filters."
                    : "No audit events recorded yet."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-xs shrink-0 w-[82px] justify-center"
                      >
                        {CATEGORY_LABELS[row.category] ?? row.category}
                      </Badge>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm">
                          {formatEventLabel(row.eventType)}
                        </span>
                        {row.description && (
                          <span className="text-xs text-muted-foreground truncate">
                            {row.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.subjectName ? (
                      <span className="text-sm font-medium truncate block">
                        {row.subjectName}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "text-sm truncate block",
                        !row.actorName && "text-muted-foreground",
                      )}
                    >
                      {row.actorName ?? "System"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(row.createdAt)}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between pt-3">
        <span className="text-xs text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setPage(Math.max(1, page - 1))}
                aria-disabled={page <= 1}
                className={
                  page <= 1
                    ? "pointer-events-none opacity-50"
                    : "cursor-pointer"
                }
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                aria-disabled={page >= totalPages}
                className={
                  page >= totalPages
                    ? "pointer-events-none opacity-50"
                    : "cursor-pointer"
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
