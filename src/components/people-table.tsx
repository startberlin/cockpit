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
import { MoreHorizontal, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { completeUserOnboardingAction } from "@/app/(authenticated)/(app)/people/complete-onboarding-action";
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
import { DEPARTMENTS } from "@/lib/enums";
import { USER_STATUS_INFO } from "@/lib/user-status";
import { Can } from "./can";
import { Badge } from "./ui/badge";

interface PeopleTableProps {
  data: PublicUser[];
  onCreateUserClick?: () => void;
}

const columns: ColumnDef<PublicUser>[] = [
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
        <Badge variant="outline">{DEPARTMENTS[row.original.department]}</Badge>
      ) : (
        <p>—</p>
      ),
  },
  {
    accessorKey: "batch",
    header: "Batch",
    cell: ({ row }) => <div>#{row.original.batchNumber}</div>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const info = USER_STATUS_INFO[row.original.status];
      const isPaymentPending =
        row.original.membershipViewState === "payment_pending";
      const isPaymentProcessing =
        row.original.membershipViewState === "payment_processing";
      const label = isPaymentProcessing
        ? "Payment processing"
        : isPaymentPending
          ? "Payment pending"
          : info.label;
      const description = isPaymentProcessing
        ? "The member has started payment setup and GoCardless confirmation is pending."
        : isPaymentPending
          ? "Profile onboarding is complete, but the membership payment is still pending."
          : info.description;

      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="capitalize">
              {label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top">{description}</TooltipContent>
        </Tooltip>
      );
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const user = row.original;

      return (
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
              user.profileOnboardingComplete &&
              !user.hasMembershipPayment && (
                <Can permission="users.complete_onboarding">
                  <CompleteOnboardingMenuItem user={user} />
                </Can>
              )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

function CompleteOnboardingMenuItem({ user }: { user: PublicUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { execute, isPending } = useAction(completeUserOnboardingAction, {
    onSuccess: ({ data }) => {
      setOpen(false);
      router.refresh();
      toast.success(
        data?.alreadyCompleted
          ? "Onboarding was already completed"
          : "Onboarding completed",
        {
          description: data?.alreadyCompleted
            ? "The member can already set up their payment."
            : "The member has been emailed and can now set up payment.",
        },
      );
    },
    onError: () => {
      toast.error("Failed to complete onboarding");
    },
  });

  return (
    <>
      <DropdownMenuItem
        disabled={isPending}
        onSelect={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
      >
        Complete onboarding
      </DropdownMenuItem>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete onboarding?</DialogTitle>
            <DialogDescription>
              This will mark {user.firstName} {user.lastName}'s onboarding as
              complete and send an email to {user.email} so they can finalize
              their membership and set up the membership payment.
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
              {isPending ? "Completing..." : "Complete onboarding"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PeopleTable({ data, onCreateUserClick }: PeopleTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});

  const table = useReactTable({
    data,
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

  return (
    <div className="w-full">
      <div className="flex items-center py-4 gap-2">
        <Input
          placeholder="Find users..."
          value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("name")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
        <Can permission="users.create">
          <Button
            variant="outline"
            className="ml-auto"
            onClick={onCreateUserClick}
          >
            <Plus />
            Create user
          </Button>
        </Can>
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
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer"
                  onClick={() => router.push(`/people/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      onClick={(e) => {
                        // Prevent navigation when clicking on actions column
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
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
