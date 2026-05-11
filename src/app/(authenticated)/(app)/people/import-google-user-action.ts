"use server";

import db from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { legalMembership } from "@/db/schema/legal-membership";
import { actionClient } from "@/lib/action-client";
import {
  fetchWorkspaceUsersPage,
  getWorkspaceUser,
} from "@/lib/google-workspace/directory";
import { newId } from "@/lib/id";
import { events, inngest } from "@/lib/inngest";
import { can } from "@/lib/permissions/server";
import { resend } from "@/lib/resend";
import { buildImportedUserNotificationEmail } from "./import-google-user-email";
import {
  fetchWorkspaceUsersPageSchema,
  importGoogleWorkspaceUserSchema,
  normalizeImportedDepartment,
} from "./import-google-user-schema";

export const fetchWorkspaceUsersPageAction = actionClient
  .inputSchema(fetchWorkspaceUsersPageSchema)
  .action(async ({ parsedInput }) => {
    if (!(await can("users.import"))) {
      throw new Error("You are not authorized to import Workspace users.");
    }

    const page = await fetchWorkspaceUsersPage({
      pageToken: parsedInput.pageToken,
      query: parsedInput.query,
    });

    const localUsers = await db.query.user.findMany({
      where: (users, { inArray }) =>
        inArray(
          users.email,
          page.users.map((u) => u.primaryEmail),
        ),
      columns: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    return {
      users: page.users.map((workspaceUser) => {
        const linkedUser = localUsers.find(
          (u) => u.email === workspaceUser.primaryEmail,
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
      }),
      nextPageToken: page.nextPageToken,
    };
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

    const existingUser = await db.query.user.findFirst({
      where: (users, { eq }) => eq(users.email, workspaceUser.primaryEmail),
      columns: { id: true },
    });

    if (existingUser) {
      throw new Error("This Google Workspace user is already imported.");
    }

    // Convert the optional last-payment date string to a Date for DB storage.
    const isMemberStatus =
      parsedInput.status === "member" ||
      parsedInput.status === "supporting_alumni";

    const importedPaidThroughAt =
      isMemberStatus && parsedInput.paidThroughDate
        ? new Date(`${parsedInput.paidThroughDate}T23:59:59.999Z`)
        : null;

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
          ...(parsedInput.batchNumber != null
            ? { batchNumber: parsedInput.batchNumber }
            : {}),
          department: normalizeImportedDepartment(
            parsedInput.status,
            parsedInput.department,
          ),
          status: parsedInput.status,
          emailVerified: true,
          legalMembershipState: "not_member",
        })
        .returning({ id: userTable.id });

      let createdLegalMembershipId: string | null = null;

      if (isMemberStatus) {
        // Existing members always need to reconfirm their membership docs on
        // first login. The reconfirmation workflow activates the tenure and
        // creates the first proposed payment row (anchored to importedPaidThroughAt
        // if present, otherwise today).
        const [createdLm] = await tx
          .insert(legalMembership)
          .values({
            id: newId("legalMembership"),
            userId: createdUser.id,
            status: "membership_reconfirmation_pending",
            importedPaidThroughAt,
          })
          .returning({ id: legalMembership.id });

        createdLegalMembershipId = createdLm.id;
      }
      // alumni/onboarding: no legal admission or payment rows

      return { id: createdUser.id, createdLegalMembershipId };
    });

    await inngest.send({
      name: events.cockpitUserUpdated.name,
      data: { id: createdUser.id },
    });

    // Non-fatal: notification email failure must not block import success.
    try {
      await resend.emails.send(
        buildImportedUserNotificationEmail({
          email: workspaceUser.primaryEmail,
          firstName: parsedInput.firstName,
          status: parsedInput.status,
        }),
      );
    } catch (emailError) {
      console.error("Failed to send import notification email:", emailError);
    }

    return { id: createdUser.id };
  });
