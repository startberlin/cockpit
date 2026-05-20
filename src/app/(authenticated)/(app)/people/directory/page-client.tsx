"use client";

import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { PaginatedUsers, PublicUser } from "@/db/people";
import { DEPARTMENT_IDS, DEPARTMENT_NAMES } from "@/lib/departments";

const DEPARTMENTS = DEPARTMENT_IDS.map((id) => ({
  value: id,
  label: DEPARTMENT_NAMES[id],
}));

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "onboarding", label: "Onboarding" },
  { value: "member", label: "Member" },
  { value: "supporting_alumni", label: "Alumni" },
] as const;

function statusLabel(status: string): string {
  switch (status) {
    case "onboarding":
      return "Onboarding";
    case "member":
      return "Member";
    case "supporting_alumni":
      return "Alumni";
    case "alumni":
      return "Alumni";
    default:
      return status;
  }
}

function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function UserCard({ user }: { user: PublicUser }) {
  const initials = (user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "");

  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar size="lg">
          <AvatarImage
            src={user.image ?? undefined}
            alt={`${user.firstName} ${user.lastName}`}
          />
          <AvatarFallback>{initials.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-medium leading-tight truncate">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>
      </div>
      <div className="flex flex-col gap-1 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Department</span>
          <span className="text-xs">
            {user.department ? capitalize(user.department) : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Batch</span>
          <span className="text-xs">
            {user.batchNumber != null ? `Batch #${user.batchNumber}` : "—"}
          </span>
        </div>
      </div>
      <div>
        <Badge variant="secondary">{statusLabel(user.status)}</Badge>
      </div>
    </div>
  );
}

function CardGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton key={i} className="h-36 rounded-xl" />
      ))}
    </div>
  );
}

function UserCardSection({
  usersPromise,
  pageCount,
  page,
  setPage,
}: {
  usersPromise: Promise<PaginatedUsers>;
  pageCount: number;
  page: number;
  setPage: (updater: number | ((prev: number) => number)) => void;
}) {
  const { users, total, pageCount: fetchedPageCount } = React.use(usersPromise);
  const resolvedPageCount = fetchedPageCount ?? pageCount;

  if (total === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center">
        No members found.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {users.map((user) => (
          <UserCard key={user.id} user={user} />
        ))}
      </div>
      {resolvedPageCount > 1 && (
        <div className="flex items-center justify-end gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {resolvedPageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(resolvedPageCount, p + 1))}
            disabled={page >= resolvedPageCount}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

interface DirectoryPageClientProps {
  usersPromise: Promise<PaginatedUsers>;
  batches: { number: number }[];
  pageCount: number;
  initialFilters: {
    search: string;
    department: string;
    batchNumber: number | null;
    status: string;
  };
}

export default function DirectoryPageClient({
  usersPromise,
  batches,
  pageCount,
}: DirectoryPageClientProps) {
  const [search, setSearch] = useQueryState(
    "q",
    parseAsString
      .withDefault("")
      .withOptions({ throttleMs: 300, clearOnDefault: true, shallow: false }),
  );

  const [department, setDepartment] = useQueryState(
    "department",
    parseAsString
      .withOptions({ shallow: false, clearOnDefault: true })
      .withDefault(""),
  );

  const [batchNumber, setBatchNumber] = useQueryState(
    "batchNumber",
    parseAsInteger.withOptions({ shallow: false, clearOnDefault: true }),
  );

  const [statusFilter, setStatusFilter] = useQueryState(
    "status",
    parseAsString
      .withOptions({ shallow: false, clearOnDefault: true })
      .withDefault(""),
  );

  const [page, setPage] = useQueryState(
    "page",
    parseAsInteger
      .withDefault(1)
      .withOptions({ shallow: false, clearOnDefault: true }),
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleDepartmentChange = (value: string) => {
    setDepartment(value);
    setPage(1);
  };

  const handleBatchChange = (value: string) => {
    setBatchNumber(value === "all" ? null : parseInt(value, 10));
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="h-9 w-48"
          placeholder="Search members..."
          value={search}
          onChange={handleSearchChange}
        />

        <div className="flex flex-wrap items-center gap-1">
          <Badge
            variant={department === "" ? "default" : "outline"}
            className="cursor-pointer select-none"
            onClick={() => handleDepartmentChange("")}
          >
            All
          </Badge>
          {DEPARTMENTS.map((dept) => (
            <Badge
              key={dept.value}
              variant={department === dept.value ? "default" : "outline"}
              className="cursor-pointer select-none"
              onClick={() =>
                handleDepartmentChange(
                  department === dept.value ? "" : dept.value,
                )
              }
            >
              {dept.label}
            </Badge>
          ))}
        </div>

        <Select
          value={batchNumber != null ? String(batchNumber) : "all"}
          onValueChange={handleBatchChange}
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="All batches" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All batches</SelectItem>
            {batches.map((b) => (
              <SelectItem key={b.number} value={String(b.number)}>
                Batch #{b.number}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ToggleGroup
          type="single"
          variant="outline"
          spacing={0}
          value={statusFilter}
          onValueChange={handleStatusChange}
        >
          {STATUS_OPTIONS.map((opt) => (
            <ToggleGroupItem key={opt.value} value={opt.value}>
              {opt.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <React.Suspense fallback={<CardGridSkeleton />}>
        <UserCardSection
          usersPromise={usersPromise}
          pageCount={pageCount}
          page={page ?? 1}
          setPage={setPage}
        />
      </React.Suspense>
    </div>
  );
}
