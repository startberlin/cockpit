"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { MoreHorizontal, Plus } from "lucide-react";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
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
import type { PublicGroup } from "@/db/groups";
import { Can } from "./can";
import { Badge } from "./ui/badge";

interface GroupsTableProps {
  data: PublicGroup[];
  total: number;
  pageCount: number;
  initialSearch: string;
  onCreateGroupClick?: () => void;
}

const columns: ColumnDef<PublicGroup>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="font-medium">{row.original.name}</span>
        {row.original.isMember && (
          <Badge variant="secondary" className="w-fit">
            Member
          </Badge>
        )}
      </div>
    ),
  },
  {
    id: "email",
    header: "Email",
    cell: ({ row }) => (
      <span className="font-mono text-muted-foreground">
        {row.original.slug}@start-berlin.com
      </span>
    ),
  },
  {
    accessorKey: "memberCount",
    header: "Members",
    cell: ({ row }) => <div>{row.original.memberCount}</div>,
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const group = row.original;

      return (
        <div onClick={(e) => e.stopPropagation()}>
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
                  navigator.clipboard.writeText(
                    `${group.slug}@start-berlin.com`,
                  )
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
];

export function GroupsTable({
  data,
  total,
  pageCount,
  initialSearch,
  onCreateGroupClick,
}: GroupsTableProps) {
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

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount,
  });

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <div className="w-full">
      <div className="flex items-center pb-4 gap-2">
        <Input
          placeholder="Find groups..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="max-w-sm"
        />
        <Can permission="groups.create">
          <Button
            variant="outline"
            className="ml-auto"
            onClick={onCreateGroupClick}
          >
            <Plus />
            Create group
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
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    window.location.href = `/groups/${row.original.id}`;
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
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
                  No groups match this search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-between py-3">
          <span className="text-sm text-muted-foreground">
            {total} group{total === 1 ? "" : "s"}
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
