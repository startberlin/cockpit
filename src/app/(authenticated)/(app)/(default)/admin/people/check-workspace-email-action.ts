"use server";

import { z } from "zod";
import { actionClient } from "@/lib/action-client";
import { findWorkspaceUserByEmail } from "@/lib/google-workspace/directory";
import { can } from "@/lib/permissions/server";

export const checkWorkspaceEmailAction = actionClient
  .inputSchema(z.object({ email: z.email() }))
  .action(async ({ parsedInput }) => {
    if (!(await can("users.create"))) {
      throw new Error("You are not authorized to check Workspace users.");
    }

    const user = await findWorkspaceUserByEmail(parsedInput.email);

    return {
      available: !user,
      email: parsedInput.email,
    };
  });
