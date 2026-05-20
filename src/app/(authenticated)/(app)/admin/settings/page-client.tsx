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
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
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
    Record<string, PositionHolder | null>
  >({
    president: positions.president ?? null,
    vice_president: positions.vice_president ?? null,
    head_of_finance: positions.head_of_finance ?? null,
  });

  const [deptSelections, setDeptSelections] = useState<
    Record<Department, PositionHolder | null>
  >(
    Object.fromEntries(
      DEPARTMENT_KEYS.map((dept) => [
        dept,
        positions.departmentHeads[dept] ?? null,
      ]),
    ) as Record<Department, PositionHolder | null>,
  );

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await updatePositionsAction({
        president: globalSelections.president?.userId ?? null,
        vice_president: globalSelections.vice_president?.userId ?? null,
        head_of_finance: globalSelections.head_of_finance?.userId ?? null,
        departmentHeads: Object.fromEntries(
          DEPARTMENT_KEYS.map((dept) => [
            dept,
            deptSelections[dept]?.userId ?? null,
          ]),
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
            membership. Search by name or leave unassigned.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {GLOBAL_POSITIONS.map(({ key, label }) => (
            <PositionRow
              key={key}
              label={label}
              value={globalSelections[key]}
              eligibleUsers={eligibleUsers}
              onChange={(holder) =>
                setGlobalSelections((prev) => ({ ...prev, [key]: holder }))
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
                  onChange={(holder) =>
                    setDeptSelections((prev) => ({ ...prev, [dept]: holder }))
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
  value: PositionHolder | null;
  eligibleUsers: PositionHolder[];
  onChange: (holder: PositionHolder | null) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-sm font-medium w-48 shrink-0">{label}</span>
      <Combobox<PositionHolder>
        items={eligibleUsers}
        value={value}
        onValueChange={onChange}
        itemToStringLabel={(u) => `${u.firstName} ${u.lastName}`}
        itemToStringValue={(u) => `${u.firstName} ${u.lastName}`}
        isItemEqualToValue={(a, b) => a.userId === b.userId}
      >
        <ComboboxInput placeholder="Unassigned" showClear className="w-64" />
        <ComboboxContent>
          <ComboboxEmpty>No members found.</ComboboxEmpty>
          <ComboboxList>
            <ComboboxCollection>
              {(user: PositionHolder) => (
                <ComboboxItem key={user.userId} value={user}>
                  {user.firstName} {user.lastName}
                </ComboboxItem>
              )}
            </ComboboxCollection>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
