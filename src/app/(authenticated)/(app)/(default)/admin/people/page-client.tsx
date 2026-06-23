"use client";

import {
  CheckIcon,
  ChevronDownIcon,
  DownloadIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from "nuqs";
import * as React from "react";
import { PeopleTable } from "@/components/people-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { PaginatedUsers } from "@/db/people";
import type {
  Department,
  LegalMembershipState,
  UserStatus,
} from "@/db/schema/auth";
import {
  ACTION_ITEM_INFO,
  ACTION_ITEM_TYPES,
  type ActionItemType,
} from "@/lib/action-items";
import { DEPARTMENT_IDS, DEPARTMENT_NAMES } from "@/lib/departments";
import { cn } from "@/lib/utils";
import { CreateUserDialog } from "./create-user-dialog";
import { ImportGoogleUserDialog } from "./import-google-user-dialog";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEPARTMENT_OPTIONS = DEPARTMENT_IDS.map((id) => ({
  value: id,
  label: DEPARTMENT_NAMES[id],
}));

const LEGAL_MEMBERSHIP_OPTIONS: {
  label: string;
  value: LegalMembershipState;
}[] = [
  { label: "Not a member", value: "not_member" },
  { label: "Active member", value: "active_member" },
  { label: "Former member", value: "former_member" },
];

const ALWAYS_VISIBLE_STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
  { value: "onboarding", label: "Onboarding" },
  { value: "member", label: "Member" },
  { value: "supporting_alumni", label: "Supporting Alumni" },
];

const INACTIVE_STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
  { value: "alumni", label: "Alumni" },
  { value: "cancelled", label: "Cancelled / Former" },
];

const departmentParser = parseAsStringLiteral(
  DEPARTMENT_IDS as unknown as string[],
);

const statusParser = parseAsStringLiteral([
  "onboarding",
  "member",
  "supporting_alumni",
  "alumni",
  "cancelled",
] as UserStatus[]);

const legalMembershipParser = parseAsStringLiteral([
  "not_member",
  "active_member",
  "former_member",
] as LegalMembershipState[]);

const ACTION_ITEM_OPTIONS: { value: ActionItemType; label: string }[] =
  ACTION_ITEM_TYPES.map((value) => ({
    value,
    label: ACTION_ITEM_INFO[value].label,
  }));

const actionItemParser = parseAsStringLiteral(
  ACTION_ITEM_TYPES as unknown as string[],
);

// ─── FilterMenu (multi-select) ────────────────────────────────────────────────

function FilterMenu<T extends string | number>({
  label,
  options,
  selected,
  onChange,
  showSelectAll = false,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (next: T[]) => void;
  showSelectAll?: boolean;
}) {
  const count = selected.length;
  const allSelected = count === options.length;

  const toggle = (val: T) => {
    onChange(
      selected.includes(val)
        ? selected.filter((v) => v !== val)
        : [...selected, val],
    );
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
        {showSelectAll && (
          <>
            <button
              type="button"
              onClick={() =>
                onChange(allSelected ? [] : options.map((o) => o.value))
              }
              className="w-full text-left px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent rounded-sm cursor-pointer"
            >
              {allSelected ? "Deselect all" : "Select all"}
            </button>
            <div className="h-px bg-border my-1" />
          </>
        )}
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

// ─── UsersTableSection ────────────────────────────────────────────────────────

function UsersTableSection({
  usersPromise,
  initialSearch,
}: {
  usersPromise: Promise<PaginatedUsers>;
  initialSearch: string;
}) {
  const { users, total, pageCount } = React.use(usersPromise);

  return (
    <PeopleTable
      data={users}
      total={total}
      pageCount={pageCount}
      pendingActions={[]}
      initialSearch={initialSearch}
      hideSearch
      showActionItems
    />
  );
}

// ─── Main page client ─────────────────────────────────────────────────────────

interface AdminDirectoryPageClientProps {
  usersPromise: Promise<PaginatedUsers>;
  batches: { number: number }[];
  initialSearch: string;
  canViewInactive: boolean;
  isDeptHeadScoped: boolean;
  canCreate: boolean;
  canImport: boolean;
}

export default function AdminDirectoryPageClient({
  usersPromise,
  batches,
  initialSearch,
  canViewInactive,
  isDeptHeadScoped,
  canCreate,
  canImport,
}: AdminDirectoryPageClientProps) {
  const [createOpen, setCreateOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [search, setSearch] = useQueryState(
    "q",
    parseAsString
      .withDefault(initialSearch)
      .withOptions({ throttleMs: 300, clearOnDefault: true, shallow: false }),
  );
  const [status, setStatus] = useQueryState(
    "status",
    parseAsArrayOf(statusParser).withOptions({ shallow: false }),
  );
  const [legalMembership, setLegalMembership] = useQueryState(
    "legalMembership",
    parseAsArrayOf(legalMembershipParser).withOptions({ shallow: false }),
  );
  const [department, setDepartment] = useQueryState(
    "department",
    parseAsArrayOf(departmentParser).withOptions({ shallow: false }),
  );
  const [batchNumber, setBatchNumber] = useQueryState(
    "batchNumber",
    parseAsArrayOf(parseAsInteger).withOptions({ shallow: false }),
  );
  const [actionItem, setActionItem] = useQueryState(
    "actionItem",
    parseAsArrayOf(actionItemParser).withOptions({ shallow: false }),
  );
  const [, setPage] = useQueryState(
    "page",
    parseAsInteger
      .withDefault(1)
      .withOptions({ shallow: false, clearOnDefault: true }),
  );

  const statusOptions = canViewInactive
    ? [...ALWAYS_VISIBLE_STATUS_OPTIONS, ...INACTIVE_STATUS_OPTIONS]
    : ALWAYS_VISIBLE_STATUS_OPTIONS;

  const activeDept = (department ?? []) as Department[];
  const activeBatch = batchNumber ?? [];
  const activeStatus = status ?? [];
  const activeLegalMembership = legalMembership ?? [];
  const activeActionItem = (actionItem ?? []) as ActionItemType[];

  const hasFilters = !!(
    search ||
    activeStatus.length ||
    activeLegalMembership.length ||
    activeDept.length ||
    activeBatch.length ||
    activeActionItem.length
  );

  const handleReset = () => {
    setSearch("");
    setStatus(null);
    setLegalMembership(null);
    setDepartment(null);
    setBatchNumber(null);
    setActionItem(null);
    setPage(1);
  };

  const handleStatusChange = (next: UserStatus[]) => {
    setStatus(next.length ? next : null);
    setPage(1);
  };

  const handleLegalMembershipChange = (next: LegalMembershipState[]) => {
    setLegalMembership(next.length ? next : null);
    setPage(1);
  };

  const handleDepartmentChange = (next: string[]) => {
    setDepartment(next.length ? (next as Department[]) : null);
    setPage(1);
  };

  const handleBatchChange = (next: number[]) => {
    setBatchNumber(next.length ? next : null);
    setPage(1);
  };

  const handleActionItemChange = (next: ActionItemType[]) => {
    setActionItem(next.length ? next : null);
    setPage(1);
  };

  const batchOptions = batches.map((b) => ({
    value: b.number,
    label: `Batch #${b.number}`,
  }));

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-4">
        <div>
          <h1 className="text-xl font-semibold">Members</h1>
          <p className="text-muted-foreground text-sm mt-1">
            View all members that you can manage.
          </p>
        </div>
        {(canCreate || canImport) && (
          <div className="flex items-center gap-2 shrink-0">
            {canImport && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImportOpen(true)}
                aria-label="Import from Google Workspace"
              >
                <DownloadIcon className="size-3.5" />
                <span className="hidden sm:inline">Import</span>
              </Button>
            )}
            {canCreate && (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <PlusIcon className="size-3.5" />
                Add member
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Filter bar — single scrollable row */}
      <div className="flex items-center gap-2 pb-4 overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden ">
        <div className="relative shrink-0">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            className="h-9 w-full sm:w-56 pl-8"
            placeholder="Find by name…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <FilterMenu
          label="Status"
          options={statusOptions}
          selected={activeStatus}
          onChange={handleStatusChange}
        />
        <FilterMenu
          label="Membership"
          options={LEGAL_MEMBERSHIP_OPTIONS}
          selected={activeLegalMembership}
          onChange={handleLegalMembershipChange}
        />
        {!isDeptHeadScoped && (
          <FilterMenu
            label="Department"
            options={DEPARTMENT_OPTIONS}
            selected={activeDept}
            onChange={handleDepartmentChange}
          />
        )}
        <FilterMenu
          label="Batch"
          options={batchOptions}
          selected={activeBatch}
          onChange={handleBatchChange}
        />
        <FilterMenu
          label="Action needed"
          options={ACTION_ITEM_OPTIONS}
          selected={activeActionItem}
          onChange={handleActionItemChange}
          showSelectAll
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

      {/* Table */}
      <React.Suspense
        fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}
      >
        <UsersTableSection
          usersPromise={usersPromise}
          initialSearch={initialSearch}
        />
      </React.Suspense>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        batches={batches}
      />
      <ImportGoogleUserDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        batches={batches}
      />
    </>
  );
}
