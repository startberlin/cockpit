"use client";

import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { proposeMembershipAction } from "@/app/(authenticated)/(app)/people/propose-membership-action";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { DEPARTMENTS } from "@/lib/enums";
import { USER_STATUS_INFO } from "@/lib/user-status";
import { Can, useCan } from "./can";
import { Badge } from "./ui/badge";

interface PeopleTableProps {
  data: PublicUser[];
  pendingActions?: PendingBoardAction[];
}

function ProposeMembershipMenuItem({ user }: { user: PublicUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { execute, isPending } = useAction(proposeMembershipAction, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
      toast.success("Membership proposed", {
        description:
          "The board admission workflow has been started for this member.",
      });
    },
    onError: () => {
      toast.error(
        "Could not propose membership. Please try again. If this keeps happening, email operations@start-berlin.com.",
      );
    },
  });

  return (
    <Fragment key={user.id}>
      <DropdownMenuItem
        disabled={isPending}
        onSelect={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
      >
        Propose for membership
      </DropdownMenuItem>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Propose {user.firstName} {user.lastName} for membership?
            </DialogTitle>
            <DialogDescription>
              This starts the board admission workflow for this member. The
              board will be asked to vote on their admission.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={() => execute({ userId: user.id })}
            >
              {isPending ? "Proposing..." : "Propose for membership"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Fragment>
  );
}

export function PeopleTable({ data, pendingActions = [] }: PeopleTableProps) {
  const router = useRouter();
  const can = useCan();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});

  const pendingActionsMap = useMemo(
    () => new Map(pendingActions.map((a) => [a.subjectUserId, a])),
    [pendingActions],
  );

  const sortedData = useMemo(() => {
    if (pendingActionsMap.size === 0) return data;
    return [
      ...data.filter((u) => pendingActionsMap.has(u.id)),
      ...data.filter((u) => !pendingActionsMap.has(u.id)),
    ];
  }, [data, pendingActionsMap]);

  const columns = useMemo<ColumnDef<PublicUser>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => `${row.firstName} ${row.lastName}`,
        header: "Name",
        cell: ({ row }) => (
          <div className="font-medium">
            {row.original.firstName} {row.original.lastName}
          </div>
        ),
      },
      {
        accessorKey: "department",
        header: "Department",
        cell: ({ row }) =>
          row.original.department ? (
            <Badge variant="outline">
              {DEPARTMENTS[row.original.department]}
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
                    href={`/people/resolutions/${pendingAction.resolutionId}`}
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
                    onClick={() => navigator.clipboard.writeText(user.email)}
                  >
                    Copy email
                  </DropdownMenuItem>
                  {user.status === "onboarding" &&
                    user.isEligibleForMembershipProposal && (
                      <Can
                        permission="membership.propose"
                        context={{ targetDepartment: user.department }}
                      >
                        <ProposeMembershipMenuItem user={user} />
                      </Can>
                    )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [pendingActionsMap],
  );

  const table = useReactTable({
    data: sortedData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  const canOpenMemberProfile = (member: PublicUser) =>
    can("users.view_details", { targetDepartment: member.department });

  const visibleRows = table.getRowModel().rows;

  // Only show the separator when no column sort is active (default view).
  // Under an active sort, pending users may scatter through the list and the
  // separator would no longer reliably mark the "vote needed" boundary.
  const lastPendingIndex =
    sorting.length === 0
      ? visibleRows.findLastIndex((row) =>
          pendingActionsMap.has(row.original.id),
        )
      : -1;

  return (
    <div className="w-full">
      <div className="flex items-center pb-4">
        <Input
          placeholder="Find users..."
          value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("name")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
      </div>
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
                const canOpenProfile = canOpenMemberProfile(row.original);

                return (
                  <Fragment key={row.id}>
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className={
                        canOpenProfile
                          ? "cursor-pointer"
                          : "hover:bg-transparent"
                      }
                      onClick={
                        canOpenProfile
                          ? () =>
                              router.push(
                                `/people/directory/${row.original.id}`,
                              )
                          : undefined
                      }
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          onClick={(e) => {
                            if (cell.column.id === "actions") {
                              e.stopPropagation();
                            }
                          }}
                        >
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
    </div>
  );
}
