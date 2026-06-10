"use client";

import { ChevronDown, Download } from "lucide-react";
import Link from "next/link";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import { toast } from "sonner";
import { useCan } from "@/components/can";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AdminGroup, GroupManager } from "@/db/groups";
import type { SystemGroup } from "@/lib/groups/system-groups";
import {
  exportMultipleGroupsCsvAction,
  exportMultipleGroupsPhoneCsvAction,
} from "../../groups/[id]/actions";
import { CreateGroupDialog } from "./create-group-dialog";

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
  canExport: boolean;
}

interface AdminGroupsPageClientProps {
  systemGroups: SystemGroupWithCount[];
  manualGroups: AdminGroup[];
  total: number;
  initialSearch: string;
  canExportAll: boolean;
  viewerManagerGroupIds: string[];
}

export default function AdminGroupsPageClient({
  systemGroups,
  manualGroups,
  total,
  initialSearch,
  canExportAll,
  viewerManagerGroupIds,
}: AdminGroupsPageClientProps) {
  const viewerManagerGroupIdSet = new Set(viewerManagerGroupIds);
  const [search, setSearch] = useQueryState(
    "q",
    parseAsString
      .withDefault("")
      .withOptions({ throttleMs: 300, clearOnDefault: true, shallow: false }),
  );

  const [selectedRows, setSelectedRows] = useState(
    new Map<string, UnifiedGroup>(),
  );

  const can = useCan();
  const canExportAny =
    can("group.export", { isMember: true }) ||
    (!canExportAll && viewerManagerGroupIds.length > 0);

  const systemRows: UnifiedGroup[] = systemGroups.map((sg) => ({
    key: sg.slug,
    exportId: sg.slug,
    href: `/admin/groups/${sg.slug}`,
    name: sg.name,
    googleGroupEmail: sg.googleGroupEmail,
    memberCount: sg.memberCount,
    managers: [],
    isSystem: true,
    canExport: canExportAll,
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
    canExport: canExportAll || viewerManagerGroupIdSet.has(g.id),
  }));

  const filteredSystemRows = search
    ? systemRows.filter((r) =>
        r.name.toLowerCase().includes(search.toLowerCase()),
      )
    : systemRows;

  const allRows = [...filteredSystemRows, ...manualRows].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const allVisibleSelected =
    allRows.length > 0 && allRows.every((r) => selectedRows.has(r.key));
  const someVisibleSelected = allRows.some((r) => selectedRows.has(r.key));
  const headerChecked = allVisibleSelected
    ? true
    : someVisibleSelected
      ? "indeterminate"
      : false;

  const toggleSelectAll = () => {
    if (allVisibleSelected || someVisibleSelected) {
      setSelectedRows((prev) => {
        const next = new Map(prev);
        for (const r of allRows) next.delete(r.key);
        return next;
      });
    } else {
      setSelectedRows((prev) => {
        const next = new Map(prev);
        for (const r of allRows) next.set(r.key, r);
        return next;
      });
    }
  };

  const toggleRow = (row: UnifiedGroup) => {
    setSelectedRows((prev) => {
      const next = new Map(prev);
      if (next.has(row.key)) {
        next.delete(row.key);
      } else {
        next.set(row.key, row);
      }
      return next;
    });
  };

  const handleBulkExport = async () => {
    const rows = Array.from(selectedRows.values());
    const exportIds = rows.map((r) => r.exportId);
    const fileName =
      rows.length === 1
        ? `${rows[0].name.toLowerCase().replace(/\s+/g, "-")}-luma.csv`
        : "groups-luma.csv";
    try {
      const csv = await exportMultipleGroupsCsvAction(exportIds);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (_error) {
      toast.error(
        "Could not export groups. Please try again. If this keeps happening, email operations@start-berlin.com.",
      );
    }
  };

  const handleBulkPhoneExport = async () => {
    const rows = Array.from(selectedRows.values());
    const exportIds = rows.map((r) => r.exportId);
    const fileName =
      rows.length === 1
        ? `${rows[0].name.toLowerCase().replace(/\s+/g, "-")}-phone.csv`
        : "groups-phone.csv";
    try {
      const csv = await exportMultipleGroupsPhoneCsvAction(exportIds);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (_error) {
      toast.error(
        "Could not export groups. Please try again. If this keeps happening, email operations@start-berlin.com.",
      );
    }
  };

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
          }}
          className="max-w-sm"
        />
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {allRows.length} group
            {allRows.length === 1 ? "" : "s"}
          </span>
          {canExportAny &&
            selectedRows.size > 0 &&
            (() => {
              const canExportAllSelected = Array.from(
                selectedRows.values(),
              ).every((r) => r.canExport);
              return (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!canExportAllSelected}
                      title={
                        canExportAllSelected
                          ? undefined
                          : "You don't have export permission for one or more selected groups"
                      }
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Export {selectedRows.size} group
                      {selectedRows.size === 1 ? "" : "s"}
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleBulkExport}>
                      CSV for Luma
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleBulkPhoneExport}>
                      Phone list CSV
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })()}
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {canExportAny && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={headerChecked}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all groups"
                  />
                </TableHead>
              )}
              <TableHead>Name</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Owners</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canExportAny ? 4 : 3}
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
                  {canExportAny && (
                    <TableCell>
                      <Checkbox
                        checked={selectedRows.has(g.key)}
                        onCheckedChange={() => toggleRow(g)}
                        aria-label={`Select ${g.name}`}
                      />
                    </TableCell>
                  )}
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
