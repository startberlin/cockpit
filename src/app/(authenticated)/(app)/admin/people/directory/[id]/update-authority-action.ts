"use server";

import { revalidatePath } from "next/cache";
import { getUserAuthority, replaceUserAuthority } from "@/db/authority";
import { actionClient } from "@/lib/action-client";
import { authorityUpdateInputSchema } from "@/lib/authority/assignments";
import { can } from "@/lib/permissions/server";

export const updateAuthorityAction = actionClient
  .inputSchema(authorityUpdateInputSchema)
  .action(async ({ parsedInput }) => {
    if (!(await can("users.manage_authority"))) {
      throw new Error(
        "You are not authorized to update positions and permissions.",
      );
    }

    const canImpersonate = await can("users.impersonate");

    if (!canImpersonate) {
      // Non-super-admins cannot grant or revoke super_admin.
      // Strip any super_admin from the submitted grants, then restore whatever
      // the target user currently holds so it is never silently removed.
      const existingAuthority = await getUserAuthority(parsedInput.userId);
      const hadSuperAdmin =
        existingAuthority?.grants.some((g) => g.grant === "super_admin") ??
        false;

      parsedInput = {
        ...parsedInput,
        grants: [
          ...parsedInput.grants.filter((g) => g.grant !== "super_admin"),
          ...(hadSuperAdmin ? [{ grant: "super_admin" as const }] : []),
        ],
      };
    }

    await replaceUserAuthority(parsedInput);
    revalidatePath(`/admin/people/directory/${parsedInput.userId}`);
    revalidatePath("/admin/settings");
  });
