"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { replaceUserGrants } from "@/db/authority";
import { actionClient } from "@/lib/action-client";
import { can } from "@/lib/permissions/server";

const accessGrants = [
  "super_admin",
  "admin",
  "finance_admin",
  "people_admin",
] as const;

const schema = z.object({
  userId: z.string(),
  grants: z.array(z.object({ grant: z.enum(accessGrants) })),
});

export const updateGrantsAction = actionClient
  .inputSchema(schema)
  .action(async ({ parsedInput }) => {
    if (!(await can("users.manage_authority"))) {
      throw new Error("You are not authorized to update permissions.");
    }

    const canImpersonate = await can("users.impersonate");

    let grants = parsedInput.grants;
    if (!canImpersonate) {
      // Non-super-admins cannot grant super_admin — but since this action
      // only updates grants (not positions), we still need to preserve any
      // existing super_admin grant if present.
      const { getUserAuthority } = await import("@/db/authority");
      const existing = await getUserAuthority(parsedInput.userId);
      const hadSuperAdmin =
        existing?.grants.some((g) => g.grant === "super_admin") ?? false;

      grants = [
        ...grants.filter((g) => g.grant !== "super_admin"),
        ...(hadSuperAdmin ? [{ grant: "super_admin" as const }] : []),
      ];
    }

    await replaceUserGrants(parsedInput.userId, grants);
    revalidatePath(`/admin/people/directory/${parsedInput.userId}`);
  });
