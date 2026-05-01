"use server";

import db from "@/db";
import { importedMembershipPaymentValues } from "@/db/membership";
import { user as userTable } from "@/db/schema/auth";
import { membershipPayment } from "@/db/schema/membership";
import { actionClient } from "@/lib/action-client";
import {
  getWorkspaceUser,
  searchWorkspaceUsers,
} from "@/lib/google-workspace/directory";
import { newId } from "@/lib/id";
import { can } from "@/lib/permissions/server";
import { resend } from "@/lib/resend";
import { buildImportedUserNotificationEmail } from "./import-google-user-email";
import {
  importGoogleWorkspaceUserSchema,
  normalizeImportedDepartment,
  searchGoogleWorkspaceUsersSchema,
} from "./import-google-user-schema";

export const searchGoogleWorkspaceUsersAction = actionClient
  .inputSchema(searchGoogleWorkspaceUsersSchema)
  .action(async ({ parsedInput }) => {
    if (!(await can("users.import"))) {
      throw new Error("You are not authorized to import Workspace users.");
    }

    const workspaceUsers = await searchWorkspaceUsers(parsedInput.query);
    if (workspaceUsers.length === 0) {
      return [];
    }

    const localUsers = await db.query.user.findMany({
      where: (users, { inArray }) =>
        inArray(
          users.email,
          workspaceUsers.map((user) => user.primaryEmail),
        ),
      columns: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    return workspaceUsers.map((workspaceUser) => {
      const linkedUser = localUsers.find(
        (user) => user.email === workspaceUser.primaryEmail,
      );

      return {
        ...workspaceUser,
        linkedUser: linkedUser
          ? {
              id: linkedUser.id,
              name: `${linkedUser.firstName} ${linkedUser.lastName}`,
              email: linkedUser.email,
            }
          : null,
      };
    });
  });

export const importGoogleWorkspaceUserAction = actionClient
  .inputSchema(importGoogleWorkspaceUserSchema)
  .action(async ({ parsedInput }) => {
    if (!(await can("users.import"))) {
      throw new Error("You are not authorized to import Workspace users.");
    }

    const workspaceUser = await getWorkspaceUser(
      parsedInput.googleWorkspaceUserId,
    );

    if (!workspaceUser) {
      throw new Error("The selected Google Workspace user no longer exists.");
    }

    if (workspaceUser.suspended) {
      throw new Error("Suspended Google Workspace users cannot be imported.");
    }

    if (
      workspaceUser.givenName !== parsedInput.firstName ||
      workspaceUser.familyName !== parsedInput.lastName
    ) {
      throw new Error(
        "The selected Google Workspace user changed. Search and select the user again.",
      );
    }

    const existingUser = await db.query.user.findFirst({
      where: (users, { eq }) => eq(users.email, workspaceUser.primaryEmail),
      columns: { id: true },
    });

    if (existingUser) {
      throw new Error("This Google Workspace user is already imported.");
    }

    const paidThroughAt =
      parsedInput.status !== "alumni" && parsedInput.paidThroughAt
        ? new Date(`${parsedInput.paidThroughAt}T23:59:59.999Z`)
        : null;

    if (paidThroughAt && paidThroughAt < new Date()) {
      throw new Error("Paid-through date must be today or in the future.");
    }

    const createdUser = await db.transaction(async (tx) => {
      const [createdUser] = await tx
        .insert(userTable)
        .values({
          id: newId("user"),
          name: `${parsedInput.firstName} ${parsedInput.lastName}`,
          email: workspaceUser.primaryEmail,
          firstName: parsedInput.firstName,
          lastName: parsedInput.lastName,
          personalEmail: "",
          batchNumber: parsedInput.batchNumber,
          department: normalizeImportedDepartment(
            parsedInput.status,
            parsedInput.department,
          ),
          status: parsedInput.status,
          emailVerified: true,
        })
        .returning({ id: userTable.id });

      if (parsedInput.status !== "alumni") {
        await tx.insert(membershipPayment).values(
          importedMembershipPaymentValues({
            userId: createdUser.id,
            paidThroughAt,
          }),
        );
      }

      return createdUser;
    });

    await resend.emails.send(
      buildImportedUserNotificationEmail({
        email: workspaceUser.primaryEmail,
        firstName: parsedInput.firstName,
        status: parsedInput.status,
      }),
    );

    return createdUser;
  });
