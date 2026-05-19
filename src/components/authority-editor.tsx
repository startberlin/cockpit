"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { updateAuthorityAction } from "@/app/(authenticated)/(app)/people/directory/[id]/update-authority-action";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import type { Department } from "@/db/schema/auth";
import type {
  AccessGrant,
  AuthorityScope,
  OrganizationPosition,
} from "@/db/schema/authority";
import type { GlobalOrganizationPosition } from "@/lib/authority/model";
import { DEPARTMENTS } from "@/lib/enums";

interface ExistingPosition {
  position: OrganizationPosition;
  scope: AuthorityScope;
  department: Department;
}

interface ExistingGrant {
  grant: AccessGrant;
  scope: AuthorityScope;
  department: Department;
}

interface AuthorityEditorProps {
  userId: string;
  positions: ExistingPosition[];
  grants: ExistingGrant[];
  canSetSuperAdmin: boolean;
}

type PositionInput =
  | {
      position: GlobalOrganizationPosition;
      scope: "global";
      department?: "none";
    }
  | {
      position: "department_head";
      scope: "department";
      department: Department;
    };

type GrantInput = {
  grant: "super_admin" | "admin" | "finance_admin" | "people_admin";
  scope: "global";
  department?: "none";
};

const GLOBAL_POSITIONS = [
  { value: "president", label: "President" },
  { value: "vice_president", label: "Vice President" },
  { value: "head_of_finance", label: "Head of Finance" },
] as const satisfies Array<{
  value: GlobalOrganizationPosition;
  label: string;
}>;

export function AuthorityEditor({
  userId,
  positions,
  grants,
  canSetSuperAdmin,
}: AuthorityEditorProps) {
  const router = useRouter();
  const initialGlobalPositions = useMemo(
    () =>
      new Set(
        positions
          .filter((assignment) => assignment.scope === "global")
          .map((assignment) => assignment.position)
          .filter(
            (position): position is GlobalOrganizationPosition =>
              position !== "department_head",
          ),
      ),
    [positions],
  );
  const [globalPositions, setGlobalPositions] = useState(
    initialGlobalPositions,
  );
  const initialDepartmentHeadDepartments = useMemo(
    () =>
      new Set(
        positions
          .filter(
            (assignment) =>
              assignment.position === "department_head" &&
              assignment.scope === "department" &&
              assignment.department,
          )
          .map((assignment) => assignment.department as Department),
      ),
    [positions],
  );
  const [departmentHeadDepartments, setDepartmentHeadDepartments] = useState(
    initialDepartmentHeadDepartments,
  );
  const [isSuperAdminGrant, setIsSuperAdminGrant] = useState(
    grants.some(
      (assignment) =>
        assignment.grant === "super_admin" && assignment.scope === "global",
    ),
  );
  const [isAdmin, setIsAdmin] = useState(
    grants.some(
      (assignment) =>
        assignment.grant === "admin" && assignment.scope === "global",
    ),
  );
  const [isFinanceAdmin, setIsFinanceAdmin] = useState(
    grants.some(
      (assignment) =>
        assignment.grant === "finance_admin" && assignment.scope === "global",
    ),
  );
  const [isPeopleAdmin, setIsPeopleAdmin] = useState(
    grants.some(
      (assignment) =>
        assignment.grant === "people_admin" && assignment.scope === "global",
    ),
  );
  const [isSaving, setIsSaving] = useState(false);

  const toggleGlobalPosition = (position: GlobalOrganizationPosition) => {
    setGlobalPositions((current) => {
      const next = new Set(current);
      if (next.has(position)) {
        next.delete(position);
      } else {
        next.add(position);
      }
      return next;
    });
  };

  const toggleDepartmentHead = (department: Department) => {
    setDepartmentHeadDepartments((current) => {
      const next = new Set(current);
      if (next.has(department)) {
        next.delete(department);
      } else {
        next.add(department);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const nextPositions: PositionInput[] = [
        ...Array.from(globalPositions).map((position) => ({
          position,
          scope: "global" as const,
        })),
      ];

      for (const department of departmentHeadDepartments) {
        nextPositions.push({
          position: "department_head",
          scope: "department",
          department,
        });
      }

      const nextGrants: GrantInput[] = [];
      if (canSetSuperAdmin && isSuperAdminGrant) {
        nextGrants.push({ grant: "super_admin", scope: "global" });
      }
      if (isAdmin) {
        nextGrants.push({ grant: "admin", scope: "global" });
      }
      if (isFinanceAdmin) {
        nextGrants.push({ grant: "finance_admin", scope: "global" });
      }
      if (isPeopleAdmin) {
        nextGrants.push({ grant: "people_admin", scope: "global" });
      }

      const result = await updateAuthorityAction({
        userId,
        positions: nextPositions,
        grants: nextGrants,
      });
      if (result?.serverError || result?.validationErrors) {
        toast.error(
          "Could not update positions and permissions. Please try again. If this keeps happening, email operations@start-berlin.com.",
        );
        return;
      }
      toast.success("Positions and permissions saved.");
      router.refresh();
    } catch (_error) {
      toast.error(
        "Could not update positions and permissions. Please try again. If this keeps happening, email operations@start-berlin.com.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <FieldGroup>
        <Field>
          <FieldLabel>Positions</FieldLabel>
          <FieldDescription>
            Choose the responsibilities this member currently holds. President,
            Vice President, and Head of Finance can vote on membership
            resolutions. Department heads can manage their department work, but
            they do not vote on those legal decisions.
          </FieldDescription>
          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            {GLOBAL_POSITIONS.map((position) => (
              <label
                key={position.value}
                className="flex items-center gap-2 rounded-md border p-3 text-sm"
              >
                <Checkbox
                  checked={globalPositions.has(position.value)}
                  onCheckedChange={() => toggleGlobalPosition(position.value)}
                />
                {position.label}
              </label>
            ))}
            {Object.entries(DEPARTMENTS).map(([id, label]) => (
              <label
                key={id}
                className="flex items-center gap-2 rounded-md border p-3 text-sm"
              >
                <Checkbox
                  checked={departmentHeadDepartments.has(id as Department)}
                  onCheckedChange={() => toggleDepartmentHead(id as Department)}
                />
                Head of {label}
              </label>
            ))}
          </div>
        </Field>

        <Field>
          <FieldLabel>Permissions</FieldLabel>
          <FieldDescription>
            Give admin access only to people who should be able to manage START
            Cockpit for every department.
          </FieldDescription>
          <div className="space-y-3 pt-2">
            {canSetSuperAdmin && (
              <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
                <Checkbox
                  checked={isSuperAdminGrant}
                  onCheckedChange={(checked) =>
                    setIsSuperAdminGrant(checked === true)
                  }
                />
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="size-4" />
                  <span className="flex flex-col gap-0.5">
                    <span>Super Admin</span>
                    <span className="text-muted-foreground text-xs">
                      All Admin permissions, plus can impersonate any user. Only
                      Super Admins can grant this role.
                    </span>
                  </span>
                </span>
              </label>
            )}
            <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
              <Checkbox
                checked={isAdmin}
                onCheckedChange={(checked) => setIsAdmin(checked === true)}
              />
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="size-4" />
                <span className="flex flex-col gap-0.5">
                  <span>Admin</span>
                  <span className="text-muted-foreground text-xs">
                    Can manage members, groups, positions, and permissions
                    across START Cockpit.
                  </span>
                </span>
              </span>
            </label>
            <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
              <Checkbox
                checked={isFinanceAdmin}
                onCheckedChange={(checked) =>
                  setIsFinanceAdmin(checked === true)
                }
              />
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="size-4" />
                <span className="flex flex-col gap-0.5">
                  <span>Finance Admin</span>
                  <span className="text-muted-foreground text-xs">
                    Can view and manage membership payments across START
                    Cockpit.
                  </span>
                </span>
              </span>
            </label>
            <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
              <Checkbox
                checked={isPeopleAdmin}
                onCheckedChange={(checked) =>
                  setIsPeopleAdmin(checked === true)
                }
              />
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="size-4" />
                <span className="flex flex-col gap-0.5">
                  <span>People Admin</span>
                  <span className="text-muted-foreground text-xs">
                    Can create groups, manage group members, and manage matching
                    rules across START Cockpit.
                  </span>
                </span>
              </span>
            </label>
          </div>
        </Field>
      </FieldGroup>

      <div className="flex justify-end">
        <Button type="button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save positions and permissions"}
        </Button>
      </div>
    </div>
  );
}
