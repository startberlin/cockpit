"use server";

import { actionClient } from "@/lib/action-client";
import { findWorkspaceUserByEmail } from "@/lib/google-workspace/directory";
import { generateCompanyEmail } from "@/lib/google-workspace/email";
import { inngest } from "@/lib/inngest";
import { can } from "@/lib/permissions/server";
import { createUserSchema } from "./create-user-schema";

export const createUserAction = actionClient
  .inputSchema(createUserSchema)
  .action(async ({ parsedInput }) => {
    if (!(await can("users.create"))) {
      throw new Error("You are not authorized to create users.");
    }

    const companyEmail = generateCompanyEmail(
      parsedInput.firstName,
      parsedInput.lastName,
    );
    const existingWorkspaceUser = await findWorkspaceUserByEmail(companyEmail);

    if (existingWorkspaceUser) {
      throw new Error(
        `${companyEmail} already exists in Google Workspace. Import that Workspace user instead.`,
      );
    }

    await inngest.send({
      name: "user.created",
      data: parsedInput,
    });
  });
