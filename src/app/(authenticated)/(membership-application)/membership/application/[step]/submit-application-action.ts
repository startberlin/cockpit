"use server";

import { and, eq } from "drizzle-orm";
import { returnValidationErrors } from "next-safe-action";
import db from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { legalMembership } from "@/db/schema/legal-membership";
import {
  isFullDeclarations,
  membershipApplication,
} from "@/db/schema/membership-application";
import { actionClient } from "@/lib/action-client";
import { events, inngest } from "@/lib/inngest";
import { sha256Hex } from "@/lib/legal-documents/document-hash";
import {
  readFinanzordnungBuffer,
  readSatzungBuffer,
} from "@/lib/legal-documents/static-documents";
import { submitApplicationSchema } from "./application-validation";

export const submitApplicationAction = actionClient
  .inputSchema(submitApplicationSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { user } = ctx;

    const draft = await db.query.membershipApplication.findFirst({
      where: eq(
        membershipApplication.legalMembershipId,
        parsedInput.legalMembershipId,
      ),
    });

    if (!draft || draft.subjectUserId !== user.id) {
      return returnValidationErrors(submitApplicationSchema, {
        legalMembershipId: { _errors: ["Application not found."] },
      });
    }

    if (draft.status !== "draft") {
      return returnValidationErrors(submitApplicationSchema, {
        legalMembershipId: { _errors: ["Application already submitted."] },
      });
    }

    const lm = await db.query.legalMembership.findFirst({
      where: eq(legalMembership.id, parsedInput.legalMembershipId),
      columns: { status: true },
    });

    if (lm?.status !== "application_pending") {
      return returnValidationErrors(submitApplicationSchema, {
        legalMembershipId: {
          _errors: ["Application is not in the expected state."],
        },
      });
    }

    if (
      !draft.street ||
      !draft.city ||
      !draft.zip ||
      !draft.country ||
      !draft.birthDate
    ) {
      return returnValidationErrors(submitApplicationSchema, {
        legalMembershipId: {
          _errors: ["Personal information is incomplete."],
        },
      });
    }

    if (!isFullDeclarations(draft.declarations)) {
      return returnValidationErrors(submitApplicationSchema, {
        legalMembershipId: { _errors: ["Declarations are incomplete."] },
      });
    }

    let satzungHash: string;
    let finanzordnungHash: string;
    try {
      [satzungHash, finanzordnungHash] = await Promise.all([
        readSatzungBuffer().then(sha256Hex),
        readFinanzordnungBuffer().then(sha256Hex),
      ]);
    } catch (cause) {
      throw new Error(
        `Failed to read legal documents for application ${parsedInput.legalMembershipId} (user ${user.id})`,
        { cause },
      );
    }

    await db.transaction(async (tx) => {
      await tx
        .update(membershipApplication)
        .set({
          status: "submitted",
          feeTextVersion: finanzordnungHash,
          applicationVersion: satzungHash,
          submittedAt: new Date(),
        })
        .where(
          and(
            eq(membershipApplication.id, draft.id),
            eq(membershipApplication.status, "draft"),
          ),
        );

      await tx
        .update(legalMembership)
        .set({ status: "processing" })
        .where(eq(legalMembership.id, parsedInput.legalMembershipId));

      await tx
        .update(userTable)
        .set({
          street: draft.street,
          city: draft.city,
          state: draft.state ?? "",
          zip: draft.zip,
          country: draft.country,
          birthDate: draft.birthDate,
        })
        .where(eq(userTable.id, user.id));
    });

    try {
      await inngest.send({
        name: events.applicationSubmitted.name,
        data: { legalMembershipId: parsedInput.legalMembershipId },
      });
    } catch {
      await db.transaction(async (tx) => {
        await tx
          .update(membershipApplication)
          .set({
            status: "draft",
            submittedAt: null,
            feeTextVersion: null,
            applicationVersion: null,
          })
          .where(eq(membershipApplication.id, draft.id));
        await tx
          .update(legalMembership)
          .set({ status: "application_pending" })
          .where(eq(legalMembership.id, parsedInput.legalMembershipId));
      });
      return returnValidationErrors(submitApplicationSchema, {
        legalMembershipId: {
          _errors: ["Failed to submit application. Please try again."],
        },
      });
    }

    return { success: true };
  });
