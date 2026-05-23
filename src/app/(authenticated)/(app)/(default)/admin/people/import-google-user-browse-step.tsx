"use client";

import { useQuery } from "@tanstack/react-query";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { AlertCircleIcon } from "lucide-react";
import * as React from "react";
import { useDebounce } from "use-debounce";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { fetchWorkspaceUsersPageAction } from "./import-google-user-action";
import type { WorkspaceCandidate } from "./import-google-user-types";

const EMPTY_CANDIDATES: WorkspaceCandidate[] = [];

const COLUMNS: ColumnDef<WorkspaceCandidate>[] = [
  {
    id: "name",
    accessorFn: (row) => row.name,
    header: "Name",
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    id: "email",
    accessorKey: "primaryEmail",
    header: "Email",
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => {
      const { suspended, linkedUser } = row.original;
      const disabled = !!linkedUser || suspended;
      return (
        <Badge variant={disabled ? "secondary" : "outline"}>
          {suspended ? "Suspended" : linkedUser ? "Linked" : "Importable"}
        </Badge>
      );
    },
  },
];

export interface BrowseStepProps {
  open: boolean;
  selected: WorkspaceCandidate | null;
  onSelectUser: (candidate: WorkspaceCandidate) => void;
}

export function BrowseStep({ open, selected, onSelectUser }: BrowseStepProps) {
  const [firstNameFilter, setFirstNameFilter] = React.useState("");
  const [lastNameFilter, setLastNameFilter] = React.useState("");
  const [debouncedFirstName] = useDebounce(firstNameFilter, 300);
  const [debouncedLastName] = useDebounce(lastNameFilter, 300);
  const [pageTokens, setPageTokens] = React.useState<(string | undefined)[]>([
    undefined,
  ]);
  const [pageIndex, setPageIndex] = React.useState(0);

  const gwsQuery =
    [
      debouncedFirstName && `givenName:${debouncedFirstName}`,
      debouncedLastName && `familyName:${debouncedLastName}`,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  const currentPageToken = pageTokens[pageIndex];

  const {
    data: pageData,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["workspace-users", currentPageToken, gwsQuery],
    queryFn: async () => {
      const result = await fetchWorkspaceUsersPageAction({
        pageToken: currentPageToken,
        query: gwsQuery,
      });
      if (!result?.data) throw new Error("Failed to load Workspace users.");
      return result.data;
    },
    enabled: open,
    staleTime: 30_000,
  });

  React.useEffect(() => {
    const next = pageData?.nextPageToken ?? null;
    if (next && pageTokens.length <= pageIndex + 1) {
      setPageTokens((prev) => [...prev, next]);
    }
  }, [pageData?.nextPageToken, pageIndex, pageTokens.length]);

  const candidates = pageData?.users ?? EMPTY_CANDIDATES;
  const nextPageToken = pageData?.nextPageToken ?? null;
  const isLoading = isFetching;
  const loadError = isError;
  const hasPreviousPage = pageIndex > 0;
  const hasNextPage = !!nextPageToken;

  const table = useReactTable({
    data: candidates,
    columns: COLUMNS,
    getCoreRowModel: getCoreRowModel(),
  });
  const rows = table.getRowModel().rows;

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Field className="flex-1">
          <FieldLabel htmlFor="filterFirstName">First name</FieldLabel>
          <Input
            id="filterFirstName"
            value={firstNameFilter}
            placeholder="Filter by first name"
            onChange={(e) => {
              setFirstNameFilter(e.target.value);
              setPageTokens([undefined]);
              setPageIndex(0);
            }}
          />
        </Field>
        <Field className="flex-1">
          <FieldLabel htmlFor="filterLastName">Last name</FieldLabel>
          <Input
            id="filterLastName"
            value={lastNameFilter}
            placeholder="Filter by last name"
            onChange={(e) => {
              setLastNameFilter(e.target.value);
              setPageTokens([undefined]);
              setPageIndex(0);
            }}
          />
        </Field>
      </div>

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20" />
                  </TableCell>
                </TableRow>
              ))
            ) : loadError ? null : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-8 text-center text-muted-foreground text-sm"
                >
                  {candidates.length === 0
                    ? "No Workspace users found."
                    : "No users match these filters."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const candidate = row.original;
                const disabled = !!candidate.linkedUser || candidate.suspended;
                const isSelected = selected?.id === candidate.id;
                return (
                  <TableRow
                    key={candidate.id}
                    className={cn(
                      disabled ? "opacity-60" : "cursor-pointer",
                      isSelected && "bg-muted/50",
                    )}
                    onClick={() => onSelectUser(candidate)}
                  >
                    <TableCell>
                      <span className="font-medium">{candidate.name}</span>
                    </TableCell>
                    <TableCell>{candidate.primaryEmail}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          disabled
                            ? "secondary"
                            : isSelected
                              ? "default"
                              : "outline"
                        }
                      >
                        {candidate.suspended
                          ? "Suspended"
                          : candidate.linkedUser
                            ? "Linked"
                            : isSelected
                              ? "Selected"
                              : "Importable"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {loadError && (
        <Alert variant="destructive">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>Failed to load Workspace users</AlertTitle>
          <AlertDescription className="flex items-center gap-2">
            <span>Could not connect to Google Workspace.</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => refetch()}
            >
              {isLoading ? "Retrying…" : "Retry"}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!loadError && (hasPreviousPage || hasNextPage) && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {pageIndex + 1}</span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasPreviousPage || isLoading}
              onClick={() => setPageIndex((i) => i - 1)}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasNextPage || isLoading}
              onClick={() => setPageIndex((i) => i + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
