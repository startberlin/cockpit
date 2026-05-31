"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import db from "@/db";
import { getUserAuthority, replaceUserGrants } from "@/db/authority";
import { user as userTable } from "@/db/schema";
import { actionClient } from "@/lib/action-client";
import { writeAuditLog } from "@/lib/audit-log";
import { can } from "@/lib/permissions/server";
import { buildSubjectMetadata, track } from "@/lib/posthog-server";

const accessGrants = [
  "super_admin",
  "admin",
  "finance_admin",
  "people_admin",
  "members_group_exporter",
] as const;

const schema = z.object({
  userId: z.string(),
  grants: z.array(z.object({ grant: z.enum(accessGrants) })),
});

export const updateGrantsAction = actionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx }) => {
    if (!(await can("users.manage_authority"))) {
      throw new Error("You are not authorized to update permissions.");
    }

    const canImpersonate = await can("users.impersonate");

    const existingAuthority = await getUserAuthority(parsedInput.userId);
    const oldGrants = (existingAuthority?.grants ?? []).map((g) => g.grant);

    let grants = parsedInput.grants;
    if (!canImpersonate) {
      // Non-super-admins cannot grant super_admin — but since this action
      // only updates grants (not positions), we still need to preserve any
      // existing super_admin grant if present.
      const hadSuperAdmin = oldGrants.includes("super_admin");
      grants = [
        ...grants.filter((g) => g.grant !== "super_admin"),
        ...(hadSuperAdmin ? [{ grant: "super_admin" as const }] : []),
      ];
    }

    await replaceUserGrants(parsedInput.userId, grants);
    revalidatePath(`/admin/people/${parsedInput.userId}`);

    const [targetUser] = await db
      .select({
        id: userTable.id,
        name: userTable.name,
        status: userTable.status,
        department: userTable.department,
        batchNumber: userTable.batchNumber,
        legalMembershipState: userTable.legalMembershipState,
        memberSinceDate: userTable.memberSinceDate,
      })
      .from(userTable)
      .where(eq(userTable.id, parsedInput.userId))
      .limit(1);

    const newGrants = grants.map((g) => g.grant);
    const grantLabels: Record<string, string> = {
      super_admin: "Super Admin",
      admin: "Admin",
      finance_admin: "Finance Admin",
      people_admin: "People Admin",
      members_group_exporter: "Members Group Exporter",
    };
    const oldSet = new Set(oldGrants);
    const newSet = new Set(newGrants);
    const added = newGrants
      .filter((g) => !oldSet.has(g))
      .map((g) => grantLabels[g] ?? g);
    const removed = oldGrants
      .filter((g) => !newSet.has(g))
      .map((g) => grantLabels[g] ?? g);
    const parts: string[] = [];
    if (added.length) parts.push(`Added ${added.join(", ")}`);
    if (removed.length) parts.push(`Removed ${removed.join(", ")}`);
    const description = parts.join("; ") || "No changes";

    await writeAuditLog({
      category: "authority",
      eventType: "authority.grants_updated",
      actor: { id: ctx.user.id, name: ctx.user.name },
      subject: targetUser ? { id: targetUser.id, name: targetUser.name } : null,
      metadata: { grants: newGrants },
      description,
    });

    if (targetUser) {
      after(() =>
        track({
          distinctId: targetUser.id,
          event: "admin_permissions_updated",
          properties: {
            actor_id: ctx.user.id,
            permissions_added: added,
            permissions_removed: removed,
            ...buildSubjectMetadata(targetUser),
          },
        }),
      );
    }
  });
