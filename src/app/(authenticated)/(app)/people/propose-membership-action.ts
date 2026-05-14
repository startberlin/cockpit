"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import db from "@/db";
import { createAdmissionWorkflow } from "@/db/admission";
import { getAllUserAuthorities } from "@/db/authority";
import {
  LIVE_TENURE_STATUSES,
  legalMembership,
} from "@/db/schema/legal-membership";
import { actionClient } from "@/lib/action-client";
import { getBoardRosterSetup } from "@/lib/authority/board-roster";
import { newId } from "@/lib/id";
import { events, inngest } from "@/lib/inngest";
import { can } from "@/lib/permissions/server";
import { getOnboardingProgress } from "@/schema/onboarding-progress";

export const proposeMembershipAction = actionClient
  .inputSchema(z.object({ userId: z.string().min(1) }))
  .action(async ({ parsedInput }) => {
    // The permission check requires the target user's department, so we must
    // fetch the user first. This means an authenticated caller can distinguish
    // "user not found" from "user exists but you lack permission" — an accepted
    // residual risk given the caller must be authenticated (not public-facing).
    const targetUser = await db.query.user.findFirst({
      where: (users, { eq }) => eq(users.id, parsedInput.userId),
    });

    if (!targetUser) {
      throw new Error("User not found.");
    }

    if (
      !(await can("membership.propose", {
        targetDepartment: targetUser.department,
      }))
    ) {
      throw new Error(
        "Could not propose membership. Please try again. If this keeps happening, email operations@start-berlin.com.",
      );
    }

    if (getOnboardingProgress(targetUser) !== "completed") {
      throw new Error("The user has not completed their profile onboarding.");
    }

    // Guard against double tenure — check before creating any rows.
    // Recovery path: if a tenure exists in admission_pending but inngestRunId is
    // null, the previous inngest.send failed after the transaction committed.
    // Resend the event rather than blocking forever.
    const existingTenure = await db.query.legalMembership.findFirst({
      where: (lm, { and, inArray }) =>
        and(
          eq(lm.userId, targetUser.id),
          inArray(lm.status, [...LIVE_TENURE_STATUSES]),
        ),
      columns: { id: true, status: true, inngestRunId: true },
    });

    if (existingTenure) {
      if (
        existingTenure.status === "admission_pending" &&
        !existingTenure.inngestRunId
      ) {
        await inngest.send({
          name: events.admissionWorkflowStarted.name,
          data: {
            legalMembershipId: existingTenure.id,
            subjectUserId: targetUser.id,
          },
        });
        return { legalMembershipId: existingTenure.id };
      }
      throw new Error(
        "This user already has an active or pending membership tenure.",
      );
    }

    // Board roster validation MUST happen before any DB rows are created
    const allAuthorities = await getAllUserAuthorities();
    const boardRoster = getBoardRosterSetup(allAuthorities);

    if (!boardRoster.ok) {
      throw new Error(
        `Board roster is not properly configured: ${boardRoster.reason}`,
      );
    }

    // Create all rows in a transaction
    const lm = await db.transaction(async (tx) => {
      const legalMembershipId = newId("legalMembership");

      const [createdLm] = await tx
        .insert(legalMembership)
        .values({
          id: legalMembershipId,
          userId: targetUser.id,
          status: "admission_pending",
        })
        .returning({ id: legalMembership.id });

      await createAdmissionWorkflow(tx, {
        legalMembershipId: createdLm.id,
        subjectUser: {
          firstName: targetUser.firstName ?? "",
          lastName: targetUser.lastName ?? "",
        },
        officers: boardRoster.officers,
      });

      return createdLm;
    });

    await inngest.send({
      name: events.admissionWorkflowStarted.name,
      data: { legalMembershipId: lm.id, subjectUserId: targetUser.id },
    });

    return { legalMembershipId: lm.id };
  });
