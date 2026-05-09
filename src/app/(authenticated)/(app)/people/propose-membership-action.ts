"use server";

import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import db from "@/db";
import { getAllUserAuthorities } from "@/db/authority";
import {
  admissionParticipant,
  boardResolution,
} from "@/db/schema/board-admission";
import { legalMembership } from "@/db/schema/legal-membership";
import { actionClient } from "@/lib/action-client";
import { getBoardRosterSetup } from "@/lib/authority/board-roster";
import { newId } from "@/lib/id";
import { inngest } from "@/lib/inngest";
import { can } from "@/lib/permissions/server";
import { getOnboardingProgress } from "@/schema/onboarding-progress";

const ACTIVE_TENURE_STATUSES = [
  "admission_pending",
  "application_pending",
  "processing",
  "active",
] as const;

export const proposeMembershipAction = actionClient
  .inputSchema(z.object({ userId: z.string().min(1) }))
  .action(async ({ parsedInput }) => {
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

    // Guard against double tenure — check before creating any rows
    const existingTenure = await db.query.legalMembership.findFirst({
      where: (lm, { and, inArray }) =>
        and(
          eq(lm.userId, targetUser.id),
          inArray(lm.status, [...ACTIVE_TENURE_STATUSES]),
        ),
    });

    if (existingTenure) {
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

    const { presidentId, vicePresidentId, headOfFinanceId } =
      boardRoster.officers;

    // Build the resolution text
    const resolutionText = `Der Vorstand beschließt die Aufnahme von ${targetUser.firstName} ${targetUser.lastName} als ordentliches Mitglied des Vereins START Berlin e.V.`;
    const resolutionTextVersion = "v1";
    const resolutionTextHash = createHash("sha256")
      .update(resolutionText)
      .digest("hex");

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

      await tx.insert(boardResolution).values({
        id: newId("boardResolution"),
        legalMembershipId: createdLm.id,
        resolutionText,
        resolutionTextVersion,
        resolutionTextHash,
        billingApplies: true,
      });

      await tx.insert(admissionParticipant).values([
        {
          id: newId("admissionParticipant"),
          legalMembershipId: createdLm.id,
          userId: presidentId,
          officerFunction: "president",
        },
        {
          id: newId("admissionParticipant"),
          legalMembershipId: createdLm.id,
          userId: vicePresidentId,
          officerFunction: "vice_president",
        },
        {
          id: newId("admissionParticipant"),
          legalMembershipId: createdLm.id,
          userId: headOfFinanceId,
          officerFunction: "head_of_finance",
        },
      ]);

      return createdLm;
    });

    await inngest.send({
      name: "membership/admission-workflow.started",
      data: { legalMembershipId: lm.id, subjectUserId: targetUser.id },
    });

    return { legalMembershipId: lm.id };
  });
