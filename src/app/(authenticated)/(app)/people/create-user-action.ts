"use server";

import db from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { actionClient } from "@/lib/action-client";
import { findWorkspaceUserByEmail } from "@/lib/google-workspace/directory";
import { newId } from "@/lib/id";
import { events, inngest } from "@/lib/inngest";
import { can } from "@/lib/permissions/server";
import { createUserSchema } from "./create-user-schema";

export const createUserAction = actionClient
  .inputSchema(createUserSchema)
  .action(async ({ parsedInput }) => {
    if (!(await can("users.create"))) {
      throw new Error("You are not authorized to create users.");
    }

    const {
      firstName,
      lastName,
      personalEmail,
      companyEmail,
      batchNumber,
      department,
      status,
    } = parsedInput;

    const existingWorkspaceUser = await findWorkspaceUserByEmail(companyEmail);

    if (existingWorkspaceUser) {
      throw new Error(
        `${companyEmail} already exists in Google Workspace. Import that Workspace user instead.`,
      );
    }

    await db
      .insert(userTable)
      .values({
        id: newId("user"),
        email: companyEmail,
        firstName,
        lastName,
        personalEmail,
        name: `${firstName} ${lastName}`,
        ...(batchNumber != null ? { batchNumber } : {}),
        department: department ?? null,
        status: status ?? "onboarding",
      })
      .onConflictDoUpdate({
        target: userTable.email,
        set: {
          firstName,
          lastName,
          personalEmail,
          ...(batchNumber != null ? { batchNumber } : {}),
          department: department ?? null,
          status: status ?? "onboarding",
        },
      });

    await inngest.send({
      name: events.userCreated.name,
      data: parsedInput,
    });
  });
