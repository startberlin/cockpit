"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PositionAssignments, PositionHolder } from "@/db/authority";
import type { Department } from "@/db/schema/auth";
import { DEPARTMENTS } from "@/lib/enums";
import { updatePositionsAction } from "./update-positions-action";

const GLOBAL_POSITIONS = [
  { key: "president" as const, label: "President" },
  { key: "vice_president" as const, label: "Vice President" },
  { key: "head_of_finance" as const, label: "Head of Finance" },
];

const DEPARTMENT_KEYS = Object.keys(DEPARTMENTS) as Department[];

interface AdminSettingsPageClientProps {
  positions: PositionAssignments;
  eligibleUsers: PositionHolder[];
}

export default function AdminSettingsPageClient({
  positions,
  eligibleUsers,
}: AdminSettingsPageClientProps) {
  const [globalSelections, setGlobalSelections] = useState<
    Record<string, string>
  >({
    president: positions.president?.userId ?? "",
    vice_president: positions.vice_president?.userId ?? "",
    head_of_finance: positions.head_of_finance?.userId ?? "",
  });

  const [deptSelections, setDeptSelections] = useState<
    Record<Department, string>
  >(
    Object.fromEntries(
      DEPARTMENT_KEYS.map((dept) => [
        dept,
        positions.departmentHeads[dept]?.userId ?? "",
      ]),
    ) as Record<Department, string>,
  );

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await updatePositionsAction({
        president: globalSelections.president || null,
        vice_president: globalSelections.vice_president || null,
        head_of_finance: globalSelections.head_of_finance || null,
        departmentHeads: Object.fromEntries(
          DEPARTMENT_KEYS.map((dept) => [dept, deptSelections[dept] || null]),
        ) as Record<Department, string | null>,
        eligibleUsers,
      });

      if (result?.serverError || result?.validationErrors) {
        toast.error(
          "Could not save positions. Please try again. If this keeps happening, email operations@start-berlin.com.",
        );
        return;
      }

      toast.success("Positions saved. Notifications sent to affected members.");
    } catch (_err) {
      toast.error(
        "Could not save positions. Please try again. If this keeps happening, email operations@start-berlin.com.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage START Berlin org positions. Saving will notify any affected
          members by email.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Positions</CardTitle>
          <CardDescription>
            Each position can be held by exactly one member with an active
            membership. Select from the list or leave unassigned.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {GLOBAL_POSITIONS.map(({ key, label }) => (
            <PositionRow
              key={key}
              label={label}
              value={globalSelections[key]}
              eligibleUsers={eligibleUsers}
              onChange={(userId) =>
                setGlobalSelections((prev) => ({ ...prev, [key]: userId }))
              }
            />
          ))}

          <div className="border-t pt-4 mt-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Department heads
            </p>
            <div className="space-y-4">
              {DEPARTMENT_KEYS.map((dept) => (
                <PositionRow
                  key={dept}
                  label={`Head of ${DEPARTMENTS[dept]}`}
                  value={deptSelections[dept]}
                  eligibleUsers={eligibleUsers}
                  onChange={(userId) =>
                    setDeptSelections((prev) => ({ ...prev, [dept]: userId }))
                  }
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save positions"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PositionRow({
  label,
  value,
  eligibleUsers,
  onChange,
}: {
  label: string;
  value: string;
  eligibleUsers: PositionHolder[];
  onChange: (userId: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium w-48 shrink-0">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="flex-1 max-w-xs">
          <SelectValue placeholder="— Unassigned —" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">— Unassigned —</SelectItem>
          {eligibleUsers.map((user) => (
            <SelectItem key={user.userId} value={user.userId}>
              {user.firstName} {user.lastName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
