"use client";

import {
  CheckIcon,
  ChevronDownIcon,
  LayoutGridIcon,
  ListIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  useQueryState,
} from "nuqs";
import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import type { PaginatedUsers, PublicUser } from "@/db/people";
import type { Department, UserStatus } from "@/db/schema";
import { DEPARTMENT_IDS, DEPARTMENT_NAMES } from "@/lib/departments";
import { cn } from "@/lib/utils";
import {
  departmentParser,
  statusParser,
  viewModeParser,
} from "./search-params";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEPARTMENT_OPTIONS = DEPARTMENT_IDS.map((id) => ({
  value: id,
  label: DEPARTMENT_NAMES[id],
}));

const STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
  { value: "onboarding", label: "Onboarding" },
  { value: "member", label: "Member" },
  { value: "supporting_alumni", label: "Supporting Alumni" },
];

const SHOW_STATUS_BADGE = new Set<UserStatus>([
  "onboarding",
  "supporting_alumni",
]);

// ─── FilterMenu ───────────────────────────────────────────────────────────────

interface FilterMenuOption<T> {
  value: T;
  label: string;
}

interface FilterMenuProps<T extends string | number> {
  label: string;
  options: FilterMenuOption<T>[];
  selected: T[];
  onChange: (next: T[]) => void;
}

function FilterMenu<T extends string | number>({
  label,
  options,
  selected,
  onChange,
}: FilterMenuProps<T>) {
  const count = selected.length;

  const toggle = (val: T) => {
    const next = selected.includes(val)
      ? selected.filter((v) => v !== val)
      : [...selected, val];
    onChange(next);
  };

  const displayLabel =
    count === 0
      ? "All"
      : count === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? "")
        : `${count} selected`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "h-9 px-2.5 inline-flex shrink-0 items-center gap-1.5 border rounded-md bg-background transition-colors text-xs",
            count > 0
              ? "border-foreground bg-muted font-medium"
              : "border-input text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <span className="uppercase tracking-widest font-semibold opacity-60">
            {label}
          </span>
          <span className="text-foreground font-medium">{displayLabel}</span>
          <ChevronDownIcon className="size-3 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto min-w-44 p-1">
        {options.map((opt) => {
          const active = selected.includes(opt.value);
          return (
            <div
              key={String(opt.value)}
              role="option"
              aria-selected={active}
              tabIndex={0}
              onClick={() => toggle(opt.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggle(opt.value);
                }
              }}
              className="w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 hover:bg-accent rounded-sm cursor-pointer"
            >
              <span
                className={cn(
                  "size-4 shrink-0 rounded-sm border border-input flex items-center justify-center transition-colors",
                  active && "bg-primary border-primary",
                )}
              >
                {active && (
                  <CheckIcon className="size-3 text-primary-foreground" />
                )}
              </span>
              <span className="flex-1">{opt.label}</span>
            </div>
          );
        })}
        {count > 0 && (
          <>
            <div className="h-px bg-border my-1" />
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent rounded-sm cursor-pointer"
            >
              Clear
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── FilterChip ───────────────────────────────────────────────────────────────

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 h-6 pl-2.5 pr-1 text-xs font-medium bg-muted border border-border rounded-full">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className="size-4 inline-flex items-center justify-center text-muted-foreground hover:text-foreground rounded-full"
      >
        <XIcon className="size-3" />
      </button>
    </span>
  );
}

// ─── PersonCard ───────────────────────────────────────────────────────────────

function PersonCard({ user }: { user: PublicUser }) {
  const initials = (user.firstName[0] ?? "") + (user.lastName[0] ?? "");
  const showBadge = SHOW_STATUS_BADGE.has(user.status);
  const statusLabel = STATUS_OPTIONS.find(
    (s) => s.value === user.status,
  )?.label;

  const subtitle = [
    user.positionLabel ??
      (user.department ? DEPARTMENT_NAMES[user.department] : null),
    user.batchNumber != null ? `Batch #${user.batchNumber}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-lg border bg-card p-4 flex items-start gap-3">
      <Avatar size="lg">
        <AvatarImage
          src={user.image ?? undefined}
          alt={`${user.firstName} ${user.lastName}`}
        />
        <AvatarFallback>{initials.toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 flex flex-col gap-1">
        <p className="font-medium text-sm leading-tight line-clamp-2">
          {user.firstName} {user.lastName}
        </p>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
        {showBadge && statusLabel && (
          <div className="mt-1.5">
            <Badge variant="outline">{statusLabel}</Badge>
          </div>
        )}
      </div>
    </div>
  );
}

function CardGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

// ─── Pagination controls ──────────────────────────────────────────────────────

function PaginationControls({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between pt-3">
      <span className="text-xs text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => onChange(Math.max(1, page - 1))}
              aria-disabled={page <= 1}
              className={
                page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"
              }
            />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              onClick={() => onChange(Math.min(totalPages, page + 1))}
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
  );
}

// ─── Results section (inside Suspense) ───────────────────────────────────────

function ResultsSection({
  usersPromise,
  page,
  setPage,
  viewMode,
}: {
  usersPromise: Promise<PaginatedUsers>;
  page: number;
  setPage: (p: number) => void;
  viewMode: "grid" | "list";
}) {
  const { users, total, pageCount } = React.use(usersPromise);

  if (total === 0 || users.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center">
        <p className="text-sm font-semibold">No members match this search.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Try removing a filter or clearing the search.
        </p>
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "grid grid-cols-1 gap-3",
          viewMode === "grid" && "sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {users.map((user) => (
          <PersonCard key={user.id} user={user} />
        ))}
      </div>
      {pageCount > 1 && (
        <PaginationControls
          page={page}
          totalPages={pageCount}
          onChange={setPage}
        />
      )}
    </>
  );
}

// ─── Main page client ─────────────────────────────────────────────────────────

interface DirectoryPageClientProps {
  usersPromise: Promise<PaginatedUsers>;
  batches: { number: number }[];
}

export default function DirectoryPageClient({
  usersPromise,
  batches,
}: DirectoryPageClientProps) {
  const [search, setSearch] = useQueryState(
    "q",
    parseAsString
      .withDefault("")
      .withOptions({ throttleMs: 300, clearOnDefault: true, shallow: false }),
  );

  const [department, setDepartment] = useQueryState(
    "department",
    parseAsArrayOf(departmentParser).withOptions({ shallow: false }),
  );

  const [batchNumber, setBatchNumber] = useQueryState(
    "batchNumber",
    parseAsArrayOf(parseAsInteger).withOptions({ shallow: false }),
  );

  const [status, setStatus] = useQueryState(
    "status",
    parseAsArrayOf(statusParser).withOptions({ shallow: false }),
  );

  const [viewMode, setViewMode] = useQueryState(
    "view",
    viewModeParser.withOptions({ shallow: true, clearOnDefault: true }),
  );

  const [page, setPage] = useQueryState(
    "page",
    parseAsInteger
      .withDefault(1)
      .withOptions({ shallow: false, clearOnDefault: true }),
  );

  const handleDepartmentChange = (next: Department[]) => {
    setDepartment(next.length ? next : null);
    setPage(1);
  };

  const handleBatchChange = (next: number[]) => {
    setBatchNumber(next.length ? next : null);
    setPage(1);
  };

  const handleStatusChange = (next: UserStatus[]) => {
    setStatus(next.length ? next : null);
    setPage(1);
  };

  const handleReset = () => {
    setSearch("");
    setDepartment(null);
    setBatchNumber(null);
    setStatus(null);
    setPage(1);
  };

  const activeDept = department ?? [];
  const activeBatch = batchNumber ?? [];
  const activeStatus = status ?? [];
  const hasFilters =
    !!search ||
    activeDept.length > 0 ||
    activeBatch.length > 0 ||
    activeStatus.length > 0;

  const chips = [
    ...activeDept.map((d) => ({
      key: `d-${d}`,
      label: DEPARTMENT_NAMES[d],
      onRemove: () => handleDepartmentChange(activeDept.filter((x) => x !== d)),
    })),
    ...activeBatch.map((b) => ({
      key: `b-${b}`,
      label: `Batch #${b}`,
      onRemove: () => handleBatchChange(activeBatch.filter((x) => x !== b)),
    })),
    ...activeStatus.map((s) => ({
      key: `s-${s}`,
      label: STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s,
      onRemove: () => handleStatusChange(activeStatus.filter((x) => x !== s)),
    })),
  ];

  const batchOptions = batches.map((b) => ({
    value: b.number,
    label: `Batch #${b.number}`,
  }));

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative shrink-0">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            className="h-9 w-full sm:w-64 pl-8"
            placeholder="Find someone by name…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          <FilterMenu
            label="Department"
            options={DEPARTMENT_OPTIONS}
            selected={activeDept}
            onChange={handleDepartmentChange}
          />
          <FilterMenu
            label="Batch"
            options={batchOptions}
            selected={activeBatch}
            onChange={handleBatchChange}
          />
          <FilterMenu
            label="Status"
            options={STATUS_OPTIONS}
            selected={activeStatus}
            onChange={handleStatusChange}
          />
          {hasFilters && (
            <button
              type="button"
              onClick={handleReset}
              className="h-9 px-2.5 shrink-0 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <XIcon className="size-3.5" />
              Reset
            </button>
          )}
        </div>
        <div className="hidden sm:flex ml-auto shrink-0">
          <ButtonGroup aria-label="View mode">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
              aria-pressed={viewMode === "grid"}
              className={cn(
                "h-9 w-9 border inline-flex items-center justify-center rounded-md bg-background transition-colors",
                viewMode === "grid"
                  ? "bg-muted border-input text-foreground"
                  : "border-input text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <LayoutGridIcon className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-label="List view"
              aria-pressed={viewMode === "list"}
              className={cn(
                "h-9 w-9 border inline-flex items-center justify-center rounded-md bg-background transition-colors",
                viewMode === "list"
                  ? "bg-muted border-input text-foreground"
                  : "border-input text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <ListIcon className="size-3.5" />
            </button>
          </ButtonGroup>
        </div>
      </div>

      {/* Active filter chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          {chips.map((chip) => (
            <FilterChip
              key={chip.key}
              label={chip.label}
              onRemove={chip.onRemove}
            />
          ))}
        </div>
      )}

      {/* Results */}
      <React.Suspense fallback={<CardGridSkeleton />}>
        <ResultsSection
          usersPromise={usersPromise}
          page={Math.max(1, page ?? 1)}
          setPage={setPage}
          viewMode={viewMode}
        />
      </React.Suspense>
    </div>
  );
}
