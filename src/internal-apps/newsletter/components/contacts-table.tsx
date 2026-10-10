"use client";

import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ContactRow } from "../db/queries";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Berlin",
});

export function ContactsTable({
  rows,
  total,
  pageCount,
  currentPage,
}: {
  rows: ContactRow[];
  total: number;
  pageCount: number;
  currentPage: number;
}) {
  // URL state, per Cockpit convention — a filtered list stays shareable and
  // survives a refresh.
  const [, setPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({ shallow: false }),
  );
  const [search, setSearch] = useQueryState(
    "q",
    parseAsString.withDefault("").withOptions({
      throttleMs: 300,
      clearOnDefault: true,
      shallow: false,
    }),
  );

  return (
    <div className="w-full">
      <div className="flex items-center pb-4">
        <Input
          aria-label="Find a contact"
          placeholder="Find a contact"
          value={search}
          className="max-w-sm"
          onChange={(e) => {
            void setSearch(e.target.value || null);
            void setPage(1);
          }}
        />
      </div>

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Added</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.email}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {[row.firstName, row.lastName].filter(Boolean).join(" ") ||
                      "-"}
                  </TableCell>
                  <TableCell>
                    {row.unsubscribed ? (
                      <Badge variant="outline">Unsubscribed</Badge>
                    ) : (
                      <Badge variant="secondary">Subscribed</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.resendCreatedAt
                      ? dateFormat.format(row.resendCreatedAt)
                      : "-"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  {search
                    ? "No contact matches that search."
                    : "No contacts mirrored yet. Sync from Resend to pull them in."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center justify-between py-3">
          <span className="text-sm text-muted-foreground">
            {total} contact{total === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground tabular-nums">
              {currentPage} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
