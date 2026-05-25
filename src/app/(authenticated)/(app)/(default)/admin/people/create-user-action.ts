"use server";

import { eq } from "drizzle-orm";
import db from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { actionClient } from "@/lib/action-client";
import { writeAuditLog } from "@/lib/audit-log";
import { findWorkspaceUserByEmail } from "@/lib/google-workspace/directory";
import { newId } from "@/lib/id";
import { events, inngest } from "@/lib/inngest";
import { can } from "@/lib/permissions/server";
import { getPostHogClient } from "@/lib/posthog-server";
import { createUserSchema } from "./create-user-schema";

export const createUserAction = actionClient
  .inputSchema(createUserSchema)
  .action(async ({ parsedInput, ctx }) => {
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

    const [existingDbUser] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, companyEmail))
      .limit(1);

    const subjectId = existingDbUser?.id ?? newId("user");

    await db
      .insert(userTable)
      .values({
        id: subjectId,
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

    await writeAuditLog({
      category: "user",
      eventType: existingDbUser ? "user.updated" : "user.created",
      actor: { id: ctx.user.id, name: ctx.user.name },
      metadata: {
        firstName,
        lastName,
        companyEmail,
        department: department ?? null,
      },
      description: companyEmail,
    });

    try {
      getPostHogClient()?.capture({
        distinctId: subjectId,
        event: existingDbUser ? "admin_user_updated" : "admin_user_created",
        properties: {
          actor_id: ctx.user.id,
          company_email: companyEmail,
          status: status ?? "onboarding",
          department: department ?? null,
          batch_number: batchNumber ?? null,
        },
      });
    } catch (err) {
      console.error("[analytics] Failed to capture admin_user event:", err);
    }
  });
