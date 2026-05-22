"use server";

import db from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { legalMembership } from "@/db/schema/legal-membership";
import { actionClient } from "@/lib/action-client";
import { sendEmail } from "@/lib/email";
import {
  fetchWorkspaceUsersPage,
  getWorkspaceUser,
} from "@/lib/google-workspace/directory";
import { newId } from "@/lib/id";
import { events, inngest } from "@/lib/inngest";
import { can } from "@/lib/permissions/server";
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
      // Idempotent recovery: user already imported (e.g. previous inngest.send
      // failed after the transaction committed). Resend events and return success.
      await inngest.send({
        name: events.cockpitUserUpdated.name,
        data: { id: existingUser.id },
      });
      try {
        await sendEmail(
          buildImportedUserNotificationEmail({
            email: workspaceUser.primaryEmail,
            firstName: parsedInput.firstName,
            status: parsedInput.status,
          }),
        );
      } catch (emailError) {
        console.error("Failed to send import notification email:", emailError);
      }
      return { id: existingUser.id };
    }

    // Convert the optional last-payment date string to a Date for DB storage.
    const isMemberStatus =
      parsedInput.status === "member" ||
      parsedInput.status === "supporting_alumni";

    const importedPaidThroughAt =
      isMemberStatus && parsedInput.paidThroughDate
        ? new Date(`${parsedInput.paidThroughDate}T23:59:59.999Z`)
        : null;

    // When no batch is selected, use the Google account creation date as the
    // member-since date so imported long-time members aren't shown as joining today.
    const memberSinceDate =
      parsedInput.batchNumber == null && workspaceUser.creationTime
        ? workspaceUser.creationTime.slice(0, 10)
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
          ...(memberSinceDate ? { memberSinceDate } : {}),
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

    if (createdUser.createdLegalMembershipId) {
      // Kicks the reconfirmation reminder workflow; it sends nothing for 3
      // days so we don't double up with the import notification email below.
      await inngest.send({
        name: events.reconfirmationPending.name,
        data: {
          userId: createdUser.id,
          legalMembershipId: createdUser.createdLegalMembershipId,
        },
      });
    }

    // Non-fatal: notification email failure must not block import success.
    try {
      await sendEmail(
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
