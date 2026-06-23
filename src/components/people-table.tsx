"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { Fragment, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PublicUser } from "@/db/people";
import type { PendingBoardAction } from "@/db/people-actions";
import type { LegalMembershipState } from "@/db/schema/auth";
import { ACTION_ITEM_INFO } from "@/lib/action-items";
import { DEPARTMENT_NAMES } from "@/lib/departments";
import { USER_STATUS_INFO } from "@/lib/user-status";
import { useCan } from "./can";
import { Badge } from "./ui/badge";

const LEGAL_MEMBERSHIP_STATE_INFO: Record<
  LegalMembershipState,
  { label: string; tooltip: string; active: boolean }
> = {
  not_member: {
    label: "Not member",
    tooltip: "This person has not yet completed the legal membership process.",
    active: false,
  },
  active_member: {
    label: "Legal member",
    tooltip: "This person is a legally registered member of START Berlin e.V.",
    active: true,
  },
  former_member: {
    label: "Former member",
    tooltip:
      "This person was previously a legal member but is no longer active.",
    active: false,
  },
};

interface PeopleTableProps {
  data: PublicUser[];
  total: number;
  pageCount: number;
  pendingActions?: PendingBoardAction[];
  initialSearch: string;
  hideSearch?: boolean;
  showActionItems?: boolean;
}

export function PeopleTable({
  data,
  total,
  pageCount,
  pendingActions = [],
  initialSearch,
  hideSearch = false,
  showActionItems = false,
}: PeopleTableProps) {
  const can = useCan();
  const [page, setPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({ shallow: false }),
  );
  const [search, setSearch] = useQueryState(
    "q",
    parseAsString
      .withDefault(initialSearch)
      .withOptions({ throttleMs: 300, clearOnDefault: true, shallow: false }),
  );

  const pendingActionsMap = useMemo(
    () => new Map(pendingActions.map((a) => [a.subjectUserId, a])),
    [pendingActions],
  );

  const columns = useMemo<ColumnDef<PublicUser>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => `${row.firstName} ${row.lastName}`,
        header: "Name",
        cell: ({ row }) => {
          const { id, firstName, lastName, image } = row.original;
          const initials =
            `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
          const canOpen = can("user.view_details", row.original);
          const content = (
            <>
              <Avatar className="h-7 w-7 text-xs">
                <AvatarImage
                  src={image ?? undefined}
                  alt={`${firstName} ${lastName}`}
                />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <span className="font-medium">
                {firstName} {lastName}
              </span>
            </>
          );
          return canOpen ? (
            <Link
              href={`/admin/people/${id}`}
              className="flex items-center gap-2.5 hover:underline"
            >
              {content}
            </Link>
          ) : (
            <div className="flex items-center gap-2.5">{content}</div>
          );
        },
      },
      {
        accessorKey: "department",
        header: "Department",
        cell: ({ row }) =>
          row.original.department ? (
            <Badge variant="outline">
              {DEPARTMENT_NAMES[row.original.department]}
            </Badge>
          ) : (
            <p>—</p>
          ),
      },
      {
        accessorKey: "batch",
        header: "Batch",
        cell: ({ row }) => (
          <div>
            {row.original.batchNumber != null
              ? `#${row.original.batchNumber}`
              : "—"}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const info = USER_STATUS_INFO[row.original.status];

          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="capitalize">
                  {info.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top">{info.description}</TooltipContent>
            </Tooltip>
          );
        },
      },
      {
        id: "legalMembership",
        header: "Legal Membership",
        cell: ({ row }) => {
          const state = row.original.legalMembershipState;
          if (!state) return <span className="text-muted-foreground">—</span>;
          const info = LEGAL_MEMBERSHIP_STATE_INFO[state];
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline">{info.label}</Badge>
              </TooltipTrigger>
              <TooltipContent side="top">{info.tooltip}</TooltipContent>
            </Tooltip>
          );
        },
      },
      ...(showActionItems
        ? [
            {
              id: "actionItems",
              header: "Action needed",
              cell: ({ row }) => {
                const items = row.original.actionItems ?? [];
                if (items.length === 0)
                  return <span className="text-muted-foreground">—</span>;
                return (
                  <div className="flex flex-wrap gap-1">
                    {items.map((item) => (
                      <Tooltip key={item}>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="outline"
                            className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400"
                          >
                            {ACTION_ITEM_INFO[item].label}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          {ACTION_ITEM_INFO[item].description}
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                );
              },
            } satisfies ColumnDef<PublicUser>,
          ]
        : []),
      {
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => {
          const user = row.original;
          const pendingAction = pendingActionsMap.get(user.id);

          return (
            <div className="flex items-center justify-end gap-2">
              {pendingAction && (
                <Button asChild size="sm">
                  <Link
                    href={`/admin/tasks/vote-admission/${pendingAction.legalMembershipId}`}
                    aria-label={`Vote on ${user.firstName} ${user.lastName}`}
                  >
                    Vote
                  </Link>
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      navigator.clipboard.writeText(user.email ?? "")
                    }
                  >
                    Copy email
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [can, pendingActionsMap, showActionItems],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount,
  });

  const visibleRows = table.getRowModel().rows;

  const lastPendingIndex = visibleRows.findLastIndex((row) =>
    pendingActionsMap.has(row.original.id),
  );

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <div className="w-full">
      {!hideSearch && (
        <div className="flex items-center pb-4">
          <Input
            placeholder="Find users..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="max-w-sm"
          />
        </div>
      )}
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {visibleRows.length ? (
              visibleRows.map((row, idx) => {
                return (
                  <Fragment key={row.id}>
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                    {idx === lastPendingIndex &&
                      idx < visibleRows.length - 1 && (
                        <TableRow
                          key="pending-separator"
                          className="pointer-events-none hover:bg-transparent"
                        >
                          <TableCell
                            colSpan={columns.length}
                            className="p-0"
                            aria-hidden="true"
                          >
                            <div className="border-t border-border" />
                          </TableCell>
                        </TableRow>
                      )}
                  </Fragment>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No members match this search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-between py-3">
          <span className="text-sm text-muted-foreground">
            {total} member{total === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              {page} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= pageCount}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
