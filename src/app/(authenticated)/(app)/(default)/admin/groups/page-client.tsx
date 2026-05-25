"use client";

import { Download } from "lucide-react";
import Link from "next/link";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { toast } from "sonner";
import { Can } from "@/components/can";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarImage,
} from "@/components/ui/avatar";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AdminGroup, GroupManager } from "@/db/groups";
import type { SystemGroup } from "@/lib/groups/system-groups";
import { exportGroupCsvAction } from "../../groups/[id]/actions";
import { CreateGroupDialog } from "./create-group-dialog";

async function handleExport(exportId: string, groupName: string) {
  try {
    const csv = await exportGroupCsvAction(exportId);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${groupName.toLowerCase().replace(/\s+/g, "-")}-luma.csv`;
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

function ManagerAvatarStack({ managers }: { managers: GroupManager[] }) {
  if (managers.length === 0)
    return <span className="text-muted-foreground">—</span>;

  return (
    <TooltipProvider>
      <AvatarGroup>
        {managers.map((m) => (
          <Tooltip key={m.id}>
            <TooltipTrigger asChild>
              <Avatar size="sm">
                {m.image && (
                  <AvatarImage
                    src={m.image}
                    alt={`${m.firstName} ${m.lastName}`}
                  />
                )}
                <AvatarFallback>
                  {m.firstName?.[0]}
                  {m.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              {m.firstName} {m.lastName}
            </TooltipContent>
          </Tooltip>
        ))}
      </AvatarGroup>
    </TooltipProvider>
  );
}

interface SystemGroupWithCount extends SystemGroup {
  memberCount: number;
}

interface UnifiedGroup {
  key: string;
  exportId: string;
  href: string;
  name: string;
  googleGroupEmail: string | null;
  memberCount: number;
  managers: GroupManager[];
  isSystem: boolean;
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

  const systemRows: UnifiedGroup[] = systemGroups.map((sg) => ({
    key: sg.slug,
    exportId: sg.slug,
    href: `/admin/groups/${sg.slug}`,
    name: sg.name,
    googleGroupEmail: sg.googleGroupEmail,
    memberCount: sg.memberCount,
    managers: [],
    isSystem: true,
  }));

  const manualRows: UnifiedGroup[] = manualGroups.map((g) => ({
    key: g.id,
    exportId: g.id,
    href: `/admin/groups/${g.id}`,
    name: g.name,
    googleGroupEmail: g.googleGroupEmail,
    memberCount: g.memberCount,
    managers: g.managers,
    isSystem: false,
  }));

  const filteredSystemRows = search
    ? systemRows.filter((r) =>
        r.name.toLowerCase().includes(search.toLowerCase()),
      )
    : systemRows;

  const allRows = [...filteredSystemRows, ...manualRows].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">All groups</h1>
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
          {systemRows.length + total} group
          {systemRows.length + total === 1 ? "" : "s"}
        </span>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Owners</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {allRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground py-8"
                >
                  {search
                    ? `No groups found for "${search}".`
                    : "No groups yet."}
                </TableCell>
              </TableRow>
            ) : (
              allRows.map((g) => (
                <TableRow key={g.key}>
                  <TableCell className="font-medium">
                    <Link href={g.href} className="hover:underline">
                      {g.name}
                    </Link>
                    {g.googleGroupEmail && (
                      <div className="text-xs text-muted-foreground font-normal">
                        {g.googleGroupEmail}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{g.memberCount}</TableCell>
                  <TableCell>
                    {g.isSystem ? (
                      <span className="text-sm text-muted-foreground">
                        System
                      </span>
                    ) : (
                      <ManagerAvatarStack managers={g.managers} />
                    )}
                  </TableCell>
                  <TableCell>
                    <Can permission="group.export" context={{ isMember: true }}>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Export CSV for Luma"
                        onClick={() => handleExport(g.exportId, g.name)}
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
  );
}
