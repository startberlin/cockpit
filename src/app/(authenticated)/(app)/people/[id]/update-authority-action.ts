"use server";

import { revalidatePath } from "next/cache";
import { replaceUserAuthority } from "@/db/authority";
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

    await replaceUserAuthority(parsedInput);
    revalidatePath(`/people/${parsedInput.userId}`);
  });
