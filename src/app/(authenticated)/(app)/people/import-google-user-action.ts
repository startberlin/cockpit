"use server";

import db from "@/db";
import { createAdmissionWorkflow } from "@/db/admission";
import { getAllUserAuthorities } from "@/db/authority";
import { importedMembershipPaymentValues } from "@/db/membership";
import { user as userTable } from "@/db/schema/auth";
import { legalMembership } from "@/db/schema/legal-membership";
import { membershipPayment } from "@/db/schema/membership";
import { actionClient } from "@/lib/action-client";
import { getBoardRosterSetup } from "@/lib/authority/board-roster";
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

    const paidThroughAt =
      (parsedInput.status === "member" ||
        parsedInput.status === "supporting_alumni") &&
      parsedInput.paidThroughAt
        ? new Date(`${parsedInput.paidThroughAt}T23:59:59.999Z`)
        : null;

    if (paidThroughAt && paidThroughAt < new Date()) {
      throw new Error("Paid-through date must be today or in the future.");
    }

    const joinedAt =
      (parsedInput.status === "member" ||
        parsedInput.status === "supporting_alumni") &&
      parsedInput.joinedAt
        ? new Date(`${parsedInput.joinedAt}T00:00:00.000Z`)
        : null;

    const hasHistoricalJoinDate = joinedAt !== null;

    const requiresAdmissionWorkflow =
      (parsedInput.status === "member" ||
        parsedInput.status === "supporting_alumni") &&
      !hasHistoricalJoinDate;

    // For admission workflow path, validate board roster before creating any DB rows
    let boardRoster: Awaited<ReturnType<typeof getBoardRosterSetup>> | null =
      null;
    if (requiresAdmissionWorkflow) {
      const allAuthorities = await getAllUserAuthorities();
      boardRoster = getBoardRosterSetup(allAuthorities);

      if (!boardRoster.ok) {
        throw new Error(
          `Board roster is not properly configured: ${boardRoster.reason}`,
        );
      }
    }

    const createdUser = await db.transaction(async (tx) => {
      // Determine legalMembershipState for the user
      const legalMembershipState = "not_member" as const;

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
          legalMembershipState,
        })
        .returning({ id: userTable.id });

      let createdLegalMembershipId: string | null = null;

      if (hasHistoricalJoinDate && joinedAt) {
        // Historical join date: create reconfirmation-pending tenure.
        // Payment row and activation are deferred until the user submits the
        // application form and the reconfirmation workflow completes.
        await tx.insert(legalMembership).values({
          id: newId("legalMembership"),
          userId: createdUser.id,
          status: "membership_reconfirmation_pending",
          activatedAt: joinedAt,
          importedPaidThroughAt: paidThroughAt,
        });
      } else if (requiresAdmissionWorkflow && boardRoster?.ok) {
        // Documents missing/unsure: start admission tenure
        const [createdLm] = await tx
          .insert(legalMembership)
          .values({
            id: newId("legalMembership"),
            userId: createdUser.id,
            status: "admission_pending",
          })
          .returning({ id: legalMembership.id });

        createdLegalMembershipId = createdLm.id;

        await createAdmissionWorkflow(tx, {
          legalMembershipId: createdLm.id,
          subjectUser: {
            firstName: parsedInput.firstName,
            lastName: parsedInput.lastName,
          },
          officers: boardRoster.officers,
        });
      } else if (
        parsedInput.status === "alumni" ||
        parsedInput.status === "onboarding"
      ) {
        // Alumni and onboarding imports do not create legal admission or payment rows.
      } else {
        // Fallback for non-alumni without documentsVerified flag: create membershipPayment only
        await tx.insert(membershipPayment).values(
          importedMembershipPaymentValues({
            userId: createdUser.id,
            paidThroughAt,
          }),
        );
      }

      return { id: createdUser.id, createdLegalMembershipId };
    });

    // Send Inngest event for admission workflow after transaction commits.
    // inngest.send() is intentionally not guarded — if the transaction committed,
    // the legal_membership row exists. Failures surface as thrown errors.
    if (requiresAdmissionWorkflow) {
      if (!createdUser.createdLegalMembershipId) {
        throw new Error(
          "Could not start admission workflow. Please try again. If this keeps happening, email operations@start-berlin.com.",
        );
      }
      await inngest.send({
        name: events.admissionWorkflowStarted.name,
        data: {
          legalMembershipId: createdUser.createdLegalMembershipId,
          subjectUserId: createdUser.id,
        },
      });
    }

    await inngest.send({
      name: events.cockpitUserUpdated.name,
      data: { id: createdUser.id },
    });

    // Non-fatal: notification email failure must not block import success — all
    // durable state (user row, Inngest workflow) is already committed. Log and
    // continue so callers aren't blocked and can't retry into a duplicate-email error.
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
