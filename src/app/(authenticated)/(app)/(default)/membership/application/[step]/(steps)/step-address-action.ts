"use server";

import { eq } from "drizzle-orm";
import { after } from "next/server";
import { returnValidationErrors } from "next-safe-action";
import db from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { membershipApplication } from "@/db/schema/membership-application";
import { actionClient } from "@/lib/action-client";
import { newId } from "@/lib/id";
import { track } from "@/lib/posthog-server";
import { applicationPersonalInfoSchema } from "../application-validation";

export const saveApplicationPersonalInfoAction = actionClient
  .inputSchema(applicationPersonalInfoSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { user } = ctx;

    await db.transaction(async (tx) => {
      const ownedMembership = await tx.query.legalMembership.findFirst({
        where: (lm, { and, eq: eqFn }) =>
          and(
            eqFn(lm.id, parsedInput.legalMembershipId),
            eqFn(lm.userId, user.id),
          ),
        columns: { id: true },
      });

      if (!ownedMembership) {
        return returnValidationErrors(applicationPersonalInfoSchema, {
          legalMembershipId: {
            _errors: ["Membership not found or does not belong to you."],
          },
        });
      }

      await tx
        .update(userTable)
        .set({
          personalEmail: parsedInput.personalEmail,
          phone: parsedInput.phone,
          street: parsedInput.street,
          city: parsedInput.city,
          state: parsedInput.state,
          zip: parsedInput.zip,
          country: parsedInput.country,
          birthDate: parsedInput.birthDate,
        })
        .where(eq(userTable.id, user.id));

      await tx
        .insert(membershipApplication)
        .values({
          id: newId("membershipApplication"),
          legalMembershipId: parsedInput.legalMembershipId,
          subjectUserId: user.id,
          status: "draft",
          personalEmail: parsedInput.personalEmail,
          phone: parsedInput.phone,
          street: parsedInput.street,
          city: parsedInput.city,
          state: parsedInput.state,
          zip: parsedInput.zip,
          country: parsedInput.country,
          birthDate: parsedInput.birthDate,
        })
        .onConflictDoUpdate({
          target: membershipApplication.legalMembershipId,
          setWhere: eq(membershipApplication.subjectUserId, user.id),
          set: {
            personalEmail: parsedInput.personalEmail,
            phone: parsedInput.phone,
            street: parsedInput.street,
            city: parsedInput.city,
            state: parsedInput.state,
            zip: parsedInput.zip,
            country: parsedInput.country,
            birthDate: parsedInput.birthDate,
          },
        });
    });

    after(() =>
      track({
        distinctId: ctx.user.id,
        event: "membership_application_step_completed",
        properties: { step: "personal-information" },
      }),
    );

    return { success: true };
  });
