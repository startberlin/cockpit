"use client";

import { ChevronDown, Download } from "lucide-react";
import { toast } from "sonner";
import {
  exportGroupCsvAction,
  exportGroupPhoneCsvAction,
} from "@/app/(authenticated)/(app)/(default)/groups/[id]/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export function GroupExportMenu({
  groupId,
  canExportPhone,
}: {
  groupId: string;
  canExportPhone: boolean;
}) {
  const handleExport = async (
    exportAction: (id: string) => Promise<string>,
    filename: string,
  ) => {
    try {
      downloadCsv(await exportAction(groupId), filename);
    } catch (_error) {
      toast.error(
        "Could not export group. Please try again. If this keeps happening, email operations@start-berlin.com.",
      );
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-1" />
          Export
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() =>
            handleExport(exportGroupCsvAction, "group-members-luma.csv")
          }
        >
          CSV for Luma
        </DropdownMenuItem>
        {canExportPhone ? (
          <DropdownMenuItem
            onClick={() =>
              handleExport(exportGroupPhoneCsvAction, "group-members-phone.csv")
            }
          >
            Phone list CSV
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
