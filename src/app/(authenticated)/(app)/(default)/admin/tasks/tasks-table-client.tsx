"use client";

import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";
import Link from "next/link";
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from "nuqs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type AdminTaskKind =
  | "admission"
  | "alumni_request"
  | "supporting_alumni_request"
  | "cancellation";

type AdminTaskStatus = "open" | "completed";

type AdminTaskCompletedStatus =
  | "admitted"
  | "cancelled"
  | "manual_followup"
  | "executed"
  | "retracted"
  | "expired"
  | "acknowledged";

interface AdminTaskRow {
  kind: AdminTaskKind;
  legalMembershipId: string | null;
  transitionRequestId: string | null;
  userId: string;
  userName: string;
  department: string | null;
  createdAt: Date;
  deadline: Date;
  taskStatus: AdminTaskStatus;
  completedStatus: AdminTaskCompletedStatus | null;
  canAct: boolean;
  currentUserHasActed: boolean;
}

interface TaskMember {
  id: string;
  name: string;
}

interface TasksPageClientProps {
  rows: AdminTaskRow[];
  total: number;
  pageCount: number;
  allMembers: TaskMember[];
  viewableKinds: AdminTaskKind[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_KINDS = [
  "admission",
  "alumni_request",
  "supporting_alumni_request",
  "cancellation",
] as const satisfies readonly AdminTaskKind[];

const KIND_LABELS: Record<AdminTaskKind, string> = {
  admission: "Board resolution",
  alumni_request: "Alumni transition approval",
  supporting_alumni_request: "Alumni transition approval",
  cancellation: "Cancellation acknowledgement",
};

const kindParser = parseAsStringLiteral(ALL_KINDS as unknown as string[]);

function getTaskHref(row: AdminTaskRow): string {
  if (row.kind === "admission") {
    return `/admin/tasks/vote-admission/${row.legalMembershipId}`;
  }
  if (
    row.kind === "alumni_request" ||
    row.kind === "supporting_alumni_request"
  ) {
    return `/admin/tasks/approve-alumni/${row.userId}`;
  }
  return `/admin/tasks/acknowledge-cancellation/${row.userId}`;
}

function getOpenCtaLabel(kind: AdminTaskKind): string {
  if (kind === "admission") return "Vote";
  if (kind === "cancellation") return "Acknowledge";
  return "Review";
}

function formatRelativeDeadline(deadline: Date): string {
  const diffDays = Math.floor(
    (deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays < 14) return `in ${diffDays} days`;
  if (diffDays < 60) {
    const weeks = Math.floor(diffDays / 7);
    return `in ${weeks} week${weeks !== 1 ? "s" : ""}`;
  }
  const months = Math.floor(diffDays / 30);
  return `in ${months} month${months !== 1 ? "s" : ""}`;
}

// ─── FilterMenu ───────────────────────────────────────────────────────────────

function FilterMenu<T extends string>({
  label,
  options,
  selected,
  onChange,
  disabled,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (next: T[]) => void;
  disabled?: boolean;
}) {
  const count = selected.length;
  const displayLabel =
    count === 0
      ? "All"
      : count === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? "")
        : `${count} selected`;

  const toggle = (val: T) => {
    onChange(
      selected.includes(val)
        ? selected.filter((v) => v !== val)
        : [...selected, val],
    );
  };

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        className="h-9 px-2.5 inline-flex shrink-0 items-center gap-1.5 border border-input rounded-md bg-background text-xs text-muted-foreground opacity-50 cursor-not-allowed"
      >
        <span className="uppercase tracking-widest font-semibold opacity-60">
          {label}
        </span>
        <span className="font-medium">All</span>
        <ChevronDownIcon className="size-3 opacity-50" />
      </button>
    );
  }

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
              key={opt.value}
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

// ─── Task table ───────────────────────────────────────────────────────────────

function OpenTasksTable({ rows }: { rows: AdminTaskRow[] }) {
  const firstActionableIndex = rows.findIndex((r) => r.canAct);

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Deadline</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="py-10 text-center text-muted-foreground text-sm"
              >
                No tasks are waiting for review.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, index) => {
              const href = getTaskHref(row);
              const label = row.canAct ? getOpenCtaLabel(row.kind) : "View";
              const buttonVariant =
                index === firstActionableIndex ? "default" : "outline";
              return (
                <TableRow
                  key={row.legalMembershipId ?? row.transitionRequestId}
                >
                  <TableCell className="font-medium">
                    <Link href={href} className="hover:underline">
                      {row.userName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {KIND_LABELS[row.kind]}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "tabular-nums",
                        row.canAct &&
                          Math.floor(
                            (row.deadline.getTime() - Date.now()) /
                              (1000 * 60 * 60 * 24),
                          ) < 7
                          ? "text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {formatRelativeDeadline(row.deadline)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant={buttonVariant} size="sm" asChild>
                      <Link href={href}>{label}</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function CompletedTasksTable({ rows }: { rows: AdminTaskRow[] }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Created</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="py-10 text-center text-muted-foreground text-sm"
              >
                No completed tasks.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const href = getTaskHref(row);
              const stillPending =
                row.taskStatus === "open" && row.currentUserHasActed;
              return (
                <TableRow
                  key={row.legalMembershipId ?? row.transitionRequestId}
                >
                  <TableCell className="font-medium">
                    <Link href={href} className="hover:underline">
                      {row.userName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <span>{KIND_LABELS[row.kind]}</span>
                    {stillPending && (
                      <Badge
                        variant="outline"
                        className="ml-2 text-xs font-normal"
                      >
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {row.createdAt.toLocaleDateString("en-GB", {
                      dateStyle: "medium",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={href}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TasksPageClient({
  rows,
  total,
  pageCount,
  allMembers,
  viewableKinds,
}: TasksPageClientProps) {
  const [page, setPage] = useQueryState(
    "page",
    parseAsInteger
      .withDefault(1)
      .withOptions({ shallow: false, clearOnDefault: true }),
  );
  const [typesParam, setTypesParam] = useQueryState(
    "types",
    parseAsArrayOf(kindParser).withOptions({ shallow: false }),
  );
  const [memberIdsParam, setMemberIdsParam] = useQueryState(
    "memberIds",
    parseAsArrayOf(parseAsString).withOptions({ shallow: false }),
  );

  const activeTypes = (typesParam ?? []) as AdminTaskKind[];
  const activeMemberIds = memberIdsParam ?? [];
  const hasFilters = activeTypes.length > 0 || activeMemberIds.length > 0;

  const handleReset = () => {
    setTypesParam(null);
    setMemberIdsParam(null);
    setPage(1);
  };

  const handleTypesChange = (next: AdminTaskKind[]) => {
    setTypesParam(next.length ? next : null);
    setPage(1);
  };

  const handleMembersChange = (next: string[]) => {
    setMemberIdsParam(next.length ? next : null);
    setPage(1);
  };

  const kindOptions = viewableKinds.map((k) => ({
    value: k,
    label: KIND_LABELS[k],
  }));

  const memberOptions = allMembers.map((m) => ({
    value: m.id,
    label: m.name,
  }));

  const openRows = rows.filter(
    (r) => r.taskStatus === "open" && !r.currentUserHasActed,
  );
  const completedRows = rows.filter(
    (r) => r.taskStatus === "completed" || r.currentUserHasActed,
  );

  return (
    <>
      <div className="pb-6">
        <h1 className="text-xl font-semibold">Tasks</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Open action items requiring your attention.
        </p>
      </div>

      <div className="flex items-center gap-2 pb-6 overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {kindOptions.length > 1 && (
          <FilterMenu
            label="Type"
            options={kindOptions}
            selected={activeTypes}
            onChange={handleTypesChange}
          />
        )}
        <FilterMenu
          label="Member"
          options={memberOptions}
          selected={activeMemberIds}
          onChange={handleMembersChange}
          disabled={memberOptions.length === 0}
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

      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 pb-3">
          <h2 className="text-sm font-semibold">Open tasks</h2>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {openRows.length} task{openRows.length !== 1 ? "s" : ""}
          </span>
        </div>
        <OpenTasksTable rows={openRows} />
      </div>

      <div>
        <div className="flex items-center justify-between gap-4 pb-3">
          <h2 className="text-sm font-semibold">Completed tasks</h2>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {completedRows.length} task{completedRows.length !== 1 ? "s" : ""}
          </span>
        </div>
        <CompletedTasksTable rows={completedRows} />
      </div>

      <div className="flex items-center justify-between pt-4">
        <p className="text-sm text-muted-foreground">
          {total} task{total !== 1 ? "s" : ""} total
        </p>
        {pageCount > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground tabular-nums">
              {page} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(pageCount, page + 1))}
              disabled={page >= pageCount}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
