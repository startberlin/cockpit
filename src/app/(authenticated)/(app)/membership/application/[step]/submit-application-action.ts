"use server";

import { eq } from "drizzle-orm";
import { returnValidationErrors } from "next-safe-action";
import db from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { legalMembership } from "@/db/schema/legal-membership";
import { membershipApplication } from "@/db/schema/membership-application";
import { actionClient } from "@/lib/action-client";
import { newId } from "@/lib/id";
import { inngest } from "@/lib/inngest";
import { submitApplicationSchema } from "./application-validation";

export const submitApplicationAction = actionClient
  .inputSchema(submitApplicationSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { user } = ctx;

    const membership = await db.query.legalMembership.findFirst({
      where: eq(legalMembership.id, parsedInput.legalMembershipId),
      columns: { id: true, userId: true, status: true },
    });

    if (!membership || membership.userId !== user.id) {
      return returnValidationErrors(submitApplicationSchema, {
        legalMembershipId: {
          _errors: ["Legal membership not found."],
        },
      });
    }

    if (membership.status !== "application_pending") {
      return returnValidationErrors(submitApplicationSchema, {
        legalMembershipId: {
          _errors: ["Application is not in the expected state."],
        },
      });
    }

    // Duplicate check and INSERT are in the same transaction so concurrent
    // submissions cannot both pass the check. The DB unique constraint on
    // legalMembershipId is the final guard; 23505 is caught below.
    try {
      await db.transaction(async (tx) => {
        const existing = await tx.query.membershipApplication.findFirst({
          where: eq(
            membershipApplication.legalMembershipId,
            parsedInput.legalMembershipId,
          ),
          columns: { id: true },
        });

        if (existing) {
          return returnValidationErrors(submitApplicationSchema, {
            legalMembershipId: {
              _errors: ["Application already submitted."],
            },
          });
        }

        await tx.insert(membershipApplication).values({
          id: newId("membershipApplication"),
          legalMembershipId: parsedInput.legalMembershipId,
          subjectUserId: user.id,
          street: parsedInput.address.street,
          city: parsedInput.address.city,
          state: parsedInput.address.state,
          zip: parsedInput.address.zip,
          country: parsedInput.address.country,
          declarations: parsedInput.declarations,
          feeTextVersion: "v1",
          applicationVersion: "v1",
          submittedAt: new Date(),
        });

        await tx
          .update(userTable)
          .set({
            street: parsedInput.address.street,
            city: parsedInput.address.city,
            state: parsedInput.address.state,
            zip: parsedInput.address.zip,
            country: parsedInput.address.country,
          })
          .where(eq(userTable.id, user.id));
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
      ) {
        return returnValidationErrors(submitApplicationSchema, {
          legalMembershipId: {
            _errors: ["Application already submitted."],
          },
        });
      }
      throw error;
    }

    await inngest.send({
      name: "membership/application.submitted",
      data: {
        legalMembershipId: parsedInput.legalMembershipId,
      },
    });

    return { success: true };
  });
