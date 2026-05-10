"use server";

import { and, eq, sql } from "drizzle-orm";
import { returnValidationErrors } from "next-safe-action";
import db from "@/db";
import {
  type MembershipApplicationDeclarations,
  membershipApplication,
} from "@/db/schema/membership-application";
import { actionClient } from "@/lib/action-client";
import { declarationStepSchema } from "../application-validation";

export const saveIdentityDeclarationsAction = actionClient
  .inputSchema(declarationStepSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { user } = ctx;

    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM membership_application WHERE legal_membership_id = ${parsedInput.legalMembershipId} AND subject_user_id = ${user.id} AND status = 'draft' FOR UPDATE`,
      );
      const updated = await tx
        .update(membershipApplication)
        .set({
          declarations: sql`COALESCE(${membershipApplication.declarations}, '{}') || ${JSON.stringify({ naturalPerson: true, legalCapacity: true } satisfies Partial<MembershipApplicationDeclarations>)}::jsonb`,
        })
        .where(
          and(
            eq(
              membershipApplication.legalMembershipId,
              parsedInput.legalMembershipId,
            ),
            eq(membershipApplication.subjectUserId, user.id),
            eq(membershipApplication.status, "draft"),
          ),
        )
        .returning({ id: membershipApplication.id });

      if (updated.length === 0) {
        return returnValidationErrors(declarationStepSchema, {
          legalMembershipId: {
            _errors: [
              "Application not found. Please complete the personal information step first.",
            ],
          },
        });
      }
    });

    return { success: true };
  });
