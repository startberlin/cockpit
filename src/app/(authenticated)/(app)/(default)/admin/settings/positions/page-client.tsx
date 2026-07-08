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
import { DEPARTMENT_IDS, DEPARTMENT_NAMES } from "@/lib/departments";
import { updatePositionsAction } from "./update-positions-action";

const GLOBAL_POSITIONS = [
  { key: "president" as const, label: "President" },
  { key: "vice_president" as const, label: "Vice President" },
  { key: "head_of_finance" as const, label: "Head of Finance" },
];

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
      DEPARTMENT_IDS.map((dept) => [
        dept,
        positions.departmentHeads[dept] ?? null,
      ]),
    ) as Record<Department, PositionHolder | null>,
  );

  const [deptCoLeadSelections, setDeptCoLeadSelections] = useState<
    Record<Department, PositionHolder[]>
  >(
    Object.fromEntries(
      DEPARTMENT_IDS.map((dept) => [
        dept,
        positions.departmentCoLeads[dept] ?? [],
      ]),
    ) as Record<Department, PositionHolder[]>,
  );

  const [isSaving, setIsSaving] = useState(false);

  const setCoLeadAt = (
    dept: Department,
    index: number,
    holder: PositionHolder | null,
  ) => {
    setDeptCoLeadSelections((prev) => {
      const next = [...(prev[dept] ?? [])];
      if (holder === null) {
        next.splice(index, 1);
      } else {
        next[index] = holder;
      }
      return { ...prev, [dept]: next };
    });
  };

  const addCoLead = (dept: Department, holder: PositionHolder) => {
    setDeptCoLeadSelections((prev) => {
      const current = prev[dept] ?? [];
      if (current.some((c) => c.userId === holder.userId)) return prev;
      return { ...prev, [dept]: [...current, holder] };
    });
  };

  const handleSave = async () => {
    const duplicateDept = DEPARTMENT_IDS.find((dept) => {
      const headId = deptSelections[dept]?.userId;
      return (
        headId && deptCoLeadSelections[dept]?.some((c) => c.userId === headId)
      );
    });
    if (duplicateDept) {
      toast.error(
        `A member cannot be both head and co-lead of ${DEPARTMENT_NAMES[duplicateDept]}.`,
      );
      return;
    }

    setIsSaving(true);
    try {
      const result = await updatePositionsAction({
        president: globalSelections.president?.userId ?? null,
        vice_president: globalSelections.vice_president?.userId ?? null,
        head_of_finance: globalSelections.head_of_finance?.userId ?? null,
        departmentHeads: Object.fromEntries(
          DEPARTMENT_IDS.map((dept) => [
            dept,
            deptSelections[dept]?.userId ?? null,
          ]),
        ) as Record<Department, string | null>,
        departmentCoLeads: Object.fromEntries(
          DEPARTMENT_IDS.map((dept) => [
            dept,
            (deptCoLeadSelections[dept] ?? []).map((c) => c.userId),
          ]),
        ) as Record<Department, string[]>,
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
        <h1 className="text-2xl font-semibold tracking-tight">
          Officer Assignments
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Each position can be held by exactly one member with an active
          membership. Search by name or leave unassigned.
        </p>
      </div>

      <Card>
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
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Department leads
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              Each department has at most one head and any number of co-leads.
              Co-leads have the same permissions as the head.
            </p>
            <div className="space-y-6">
              {DEPARTMENT_IDS.map((dept) => {
                const head = deptSelections[dept];
                const coLeads = deptCoLeadSelections[dept] ?? [];
                const chosenIds = new Set(
                  [head, ...coLeads]
                    .filter((h): h is PositionHolder => h !== null)
                    .map((h) => h.userId),
                );

                return (
                  <div key={dept} className="space-y-3">
                    <PositionRow
                      label={`Head of ${DEPARTMENT_NAMES[dept]}`}
                      value={head}
                      eligibleUsers={eligibleUsers.filter(
                        (u) =>
                          !chosenIds.has(u.userId) || u.userId === head?.userId,
                      )}
                      onChange={(holder) =>
                        setDeptSelections((prev) => ({
                          ...prev,
                          [dept]: holder,
                        }))
                      }
                    />
                    {coLeads.map((coLead, idx) => (
                      <PositionRow
                        key={coLead.userId}
                        label={
                          idx === 0
                            ? `Co-Leads of ${DEPARTMENT_NAMES[dept]}`
                            : ""
                        }
                        value={coLead}
                        eligibleUsers={eligibleUsers.filter(
                          (u) =>
                            !chosenIds.has(u.userId) ||
                            u.userId === coLead.userId,
                        )}
                        onChange={(holder) => setCoLeadAt(dept, idx, holder)}
                      />
                    ))}
                    <PositionRow
                      key={`add-${coLeads.length}`}
                      label={
                        coLeads.length === 0
                          ? `Co-Leads of ${DEPARTMENT_NAMES[dept]}`
                          : ""
                      }
                      placeholder="Add a co-lead"
                      value={null}
                      eligibleUsers={eligibleUsers.filter(
                        (u) => !chosenIds.has(u.userId),
                      )}
                      onChange={(holder) => holder && addCoLead(dept, holder)}
                    />
                  </div>
                );
              })}
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
  placeholder = "Unassigned",
}: {
  label: string;
  value: PositionHolder | null;
  eligibleUsers: PositionHolder[];
  onChange: (holder: PositionHolder | null) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-sm font-medium w-52 shrink-0">{label}</span>
      <Combobox<PositionHolder>
        items={eligibleUsers}
        value={value}
        onValueChange={onChange}
        itemToStringLabel={(u) => `${u.firstName} ${u.lastName}`}
        itemToStringValue={(u) => `${u.firstName} ${u.lastName}`}
        isItemEqualToValue={(a, b) => a.userId === b.userId}
      >
        <ComboboxInput placeholder={placeholder} showClear className="w-64" />
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
