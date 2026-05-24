"use server";

import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import db from "@/db";
import { getAllUserAuthorities } from "@/db/authority";
import {
  LIVE_TENURE_STATUSES,
  legalMembership,
} from "@/db/schema/legal-membership";
import { actionClient } from "@/lib/action-client";
import { writeAuditLog } from "@/lib/audit-log";
import { getBoardRosterSetup } from "@/lib/authority/board-roster";
import { newId } from "@/lib/id";
import { events, inngest } from "@/lib/inngest";
import { can } from "@/lib/permissions/server";
import { buildSubjectMetadata, getPostHogClient } from "@/lib/posthog-server";
import { getOnboardingProgress } from "@/schema/onboarding-progress";

export const proposeMembershipAction = actionClient
  .inputSchema(z.object({ userId: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    const targetUser = await db.query.user.findFirst({
      where: (users, { eq }) => eq(users.id, parsedInput.userId),
    });

    if (!targetUser) {
      throw new Error("User not found.");
    }

    if (!(await can("user.membership.propose", targetUser))) {
      throw new Error(
        "Could not propose membership. Please try again. If this keeps happening, email operations@start-berlin.com.",
      );
    }

    if (getOnboardingProgress(targetUser) !== "completed") {
      throw new Error("The user has not completed their profile onboarding.");
    }

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

        await writeAuditLog({
          category: "membership",
          eventType: "membership.proposed",
          actor: { id: ctx.user.id, name: ctx.user.name },
          subject: {
            id: targetUser.id,
            name: `${targetUser.firstName ?? ""} ${targetUser.lastName ?? ""}`.trim(),
          },
          metadata: { legalMembershipId: existingTenure.id },
        });

        try {
          const posthog = getPostHogClient();
          posthog?.capture({
            distinctId: targetUser.id,
            event: "admin_membership_proposed",
            properties: {
              actor_id: ctx.user.id,
              ...buildSubjectMetadata(targetUser),
            },
          });
        } catch (err) {
          console.error(
            "PostHog capture failed for admin_membership_proposed:",
            err,
          );
        }

        return { legalMembershipId: existingTenure.id };
      }
      throw new Error(
        "This user already has an active or pending membership tenure.",
      );
    }

    const allAuthorities = await getAllUserAuthorities();
    const boardRoster = getBoardRosterSetup(allAuthorities);

    if (!boardRoster.ok) {
      throw new Error(
        `Board roster is not properly configured: ${boardRoster.reason}`,
      );
    }

    const { presidentId, vicePresidentId, headOfFinanceId } =
      boardRoster.officers;

    const firstName = targetUser.firstName ?? "";
    const lastName = targetUser.lastName ?? "";

    const resolutionText = `Der Vorstand beschließt die Aufnahme von ${firstName} ${lastName} als ordentliches Mitglied des Vereins START Berlin e.V., sofern die betreffende Person einen entsprechenden Aufnahmeantrag stellt.`;
    const boardResolutionHash = createHash("sha256")
      .update(resolutionText)
      .digest("hex");

    const boardParticipants = [
      { userId: presidentId, officerFunction: "president" as const },
      { userId: vicePresidentId, officerFunction: "vice_president" as const },
      { userId: headOfFinanceId, officerFunction: "head_of_finance" as const },
    ];

    const lm = await db.transaction(async (tx) => {
      const legalMembershipId = newId("legalMembership");

      const [createdLm] = await tx
        .insert(legalMembership)
        .values({
          id: legalMembershipId,
          userId: targetUser.id,
          status: "admission_pending",
          boardResolutionText: resolutionText,
          boardResolutionHash,
          boardParticipants,
          boardVotes: [],
        })
        .returning({ id: legalMembership.id });

      return createdLm;
    });

    await inngest.send({
      name: events.admissionWorkflowStarted.name,
      data: { legalMembershipId: lm.id, subjectUserId: targetUser.id },
    });

    await writeAuditLog({
      category: "membership",
      eventType: "membership.proposed",
      actor: { id: ctx.user.id, name: ctx.user.name },
      subject: {
        id: targetUser.id,
        name: `${targetUser.firstName ?? ""} ${targetUser.lastName ?? ""}`.trim(),
      },
      metadata: { legalMembershipId: lm.id },
    });

    try {
      const posthog = getPostHogClient();
      posthog?.capture({
        distinctId: targetUser.id,
        event: "admin_membership_proposed",
        properties: {
          actor_id: ctx.user.id,
          ...buildSubjectMetadata(targetUser),
        },
      });
    } catch (err) {
      console.error(
        "PostHog capture failed for admin_membership_proposed:",
        err,
      );
    }

    return { legalMembershipId: lm.id };
  });
