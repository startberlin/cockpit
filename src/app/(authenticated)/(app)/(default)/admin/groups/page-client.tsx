"use client";

import { Download } from "lucide-react";
import Link from "next/link";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { toast } from "sonner";
import { Can } from "@/components/can";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminGroup } from "@/db/groups";
import type { SystemGroup } from "@/lib/groups/system-groups";
import { exportGroupCsvAction } from "../../groups/[id]/actions";
import { CreateGroupDialog } from "./create-group-dialog";

async function handleExport(groupId: string) {
  try {
    const csv = await exportGroupCsvAction(groupId);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "group-members-luma.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  } catch (_error) {
    toast.error(
      "Could not export group. Please try again. If this keeps happening, email operations@start-berlin.com.",
    );
  }
}

interface SystemGroupWithCount extends SystemGroup {
  memberCount: number;
}

interface AdminGroupsPageClientProps {
  systemGroups: SystemGroupWithCount[];
  manualGroups: AdminGroup[];
  total: number;
  pageCount: number;
  initialSearch: string;
}

export default function AdminGroupsPageClient({
  systemGroups,
  manualGroups,
  total,
  pageCount,
  initialSearch,
}: AdminGroupsPageClientProps) {
  const [page, setPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({ shallow: false }),
  );
  const [search, setSearch] = useQueryState(
    "q",
    parseAsString
      .withDefault("")
      .withOptions({ throttleMs: 300, clearOnDefault: true, shallow: false }),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Groups</h1>
      </div>

      {/* System groups */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          System groups
        </h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {systemGroups.map((sg) => (
                <TableRow key={sg.slug} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <Link
                      href={`/groups/${sg.slug}`}
                      className="hover:underline"
                    >
                      <div className="flex items-center gap-2">
                        {sg.name}
                        <Badge variant="secondary" className="text-xs">
                          Auto
                        </Badge>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>{sg.memberCount}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {sg.googleGroupEmail}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Manual groups */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Manual groups
          </h2>
          <CreateGroupDialog />
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Search groups..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value || null);
              setPage(1);
            }}
            className="max-w-sm"
          />
          <span className="text-sm text-muted-foreground ml-auto">
            {total} group{total === 1 ? "" : "s"}
          </span>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Email enabled</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {manualGroups.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground py-8"
                  >
                    {search
                      ? `No groups found for "${search}".`
                      : "No manual groups yet."}
                  </TableCell>
                </TableRow>
              ) : (
                manualGroups.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/groups/${g.id}`}
                        className="hover:underline"
                      >
                        {g.name}
                      </Link>
                    </TableCell>
                    <TableCell>{g.memberCount}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {g.googleGroupEmail ?? "—"}
                    </TableCell>
                    <TableCell>{g.emailEnabled ? "Yes" : "No"}</TableCell>
                    <TableCell>
                      <Can
                        permission="group.export"
                        context={{ isMember: true }}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Export CSV"
                          onClick={() => handleExport(g.id)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </Can>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {pageCount > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-disabled={page <= 1}
                  className={
                    page <= 1
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
              <PaginationItem>
                <span className="text-sm text-muted-foreground px-3">
                  {page} / {pageCount}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  aria-disabled={page >= pageCount}
                  className={
                    page >= pageCount
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </div>
  );
}
