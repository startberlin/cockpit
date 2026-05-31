"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { updateGrantsAction } from "@/app/(authenticated)/(app)/(default)/admin/people/[id]/update-grants-action";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import type { AccessGrant } from "@/db/schema/authority";

interface ExistingGrant {
  grant: AccessGrant;
}

interface AuthorityEditorProps {
  userId: string;
  grants: ExistingGrant[];
  canSetSuperAdmin: boolean;
}

export function AuthorityEditor({
  userId,
  grants,
  canSetSuperAdmin,
}: AuthorityEditorProps) {
  const router = useRouter();
  const [isSuperAdminGrant, setIsSuperAdminGrant] = useState(
    grants.some((a) => a.grant === "super_admin"),
  );
  const [isAdmin, setIsAdmin] = useState(
    grants.some((a) => a.grant === "admin"),
  );
  const [isFinanceAdmin, setIsFinanceAdmin] = useState(
    grants.some((a) => a.grant === "finance_admin"),
  );
  const [isPeopleAdmin, setIsPeopleAdmin] = useState(
    grants.some((a) => a.grant === "people_admin"),
  );
  const [isMembersGroupExporter, setIsMembersGroupExporter] = useState(
    grants.some((a) => a.grant === "members_group_exporter"),
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const nextGrants: Array<{ grant: AccessGrant }> = [];
      if (canSetSuperAdmin) {
        if (isSuperAdminGrant) nextGrants.push({ grant: "super_admin" });
      } else if (grants.some((g) => g.grant === "super_admin")) {
        nextGrants.push({ grant: "super_admin" });
      }
      if (isAdmin) nextGrants.push({ grant: "admin" });
      if (isFinanceAdmin) nextGrants.push({ grant: "finance_admin" });
      if (isPeopleAdmin) nextGrants.push({ grant: "people_admin" });
      if (isMembersGroupExporter)
        nextGrants.push({ grant: "members_group_exporter" });

      const result = await updateGrantsAction({ userId, grants: nextGrants });
      if (result?.serverError || result?.validationErrors) {
        toast.error(
          "Could not update permissions. Please try again. If this keeps happening, email operations@start-berlin.com.",
        );
        return;
      }
      toast.success("Permissions saved.");
      router.refresh();
    } catch (_error) {
      toast.error(
        "Could not update permissions. Please try again. If this keeps happening, email operations@start-berlin.com.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <FieldGroup>
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
                      All Admin permissions, plus can impersonate users, manage
                      officer assignments, and cancel memberships. Only Super
                      Admins can grant this role.
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
                    Can manage members, groups, intake batches, and permissions.
                    Has full access to the audit log.
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
                    Can view and manage membership payments, and see individual
                    member payment details.
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
                    Can add and import members, view all member profiles and
                    groups, and view membership tasks.
                  </span>
                </span>
              </span>
            </label>
            <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
              <Checkbox
                checked={isMembersGroupExporter}
                onCheckedChange={(checked) =>
                  setIsMembersGroupExporter(checked === true)
                }
              />
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="size-4" />
                <span className="flex flex-col gap-0.5">
                  <span>Members Group Exporter</span>
                  <span className="text-muted-foreground text-xs">
                    Can export the members@start-berlin.com group for event
                    invites. No other access granted.
                  </span>
                </span>
              </span>
            </label>
          </div>
        </Field>
      </FieldGroup>

      <div className="flex justify-end">
        <Button type="button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save permissions"}
        </Button>
      </div>
    </div>
  );
}
