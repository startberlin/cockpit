"use server";

import { and, eq } from "drizzle-orm";
import { after } from "next/server";
import { returnValidationErrors } from "next-safe-action";
import db from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { legalMembership } from "@/db/schema/legal-membership";
import {
  isFullDeclarations,
  membershipApplication,
} from "@/db/schema/membership-application";
import { actionClient } from "@/lib/action-client";
import { writeAuditLog } from "@/lib/audit-log";
import { events, inngest } from "@/lib/inngest";
import { sha256Hex } from "@/lib/legal-documents/document-hash";
import {
  readFinanzordnungBuffer,
  readSatzungBuffer,
} from "@/lib/legal-documents/static-documents";
import { track } from "@/lib/posthog-server";
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
      columns: { status: true, userId: true },
    });

    if (!lm || lm.userId !== user.id) {
      return returnValidationErrors(submitApplicationSchema, {
        legalMembershipId: {
          _errors: ["Membership not found or does not belong to you."],
        },
      });
    }

    const preSubmissionStatus = lm.status;
    if (
      preSubmissionStatus !== "application_pending" &&
      preSubmissionStatus !== "membership_reconfirmation_pending"
    ) {
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

    const isReconfirmation =
      preSubmissionStatus === "membership_reconfirmation_pending";

    const submitted = await db.transaction(async (tx) => {
      const updated = await tx
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
        )
        .returning({ id: membershipApplication.id });

      if (updated.length === 0) {
        return false;
      }

      await tx
        .update(legalMembership)
        .set({ status: "processing" })
        .where(eq(legalMembership.id, parsedInput.legalMembershipId));

      // Reconfirmation doesn't need board approval, so activate the user's
      // legal state in the same transaction. Otherwise paymentSetupAllowed
      // (gated on legalMembershipState === "active_member") stays false while
      // the membership page already surfaces the "Set up payment" button
      // (triggered by lm.status === "processing"), and clicking before the
      // Inngest workflow catches up throws "An admin needs to complete your
      // onboarding…". The workflow's activate-legal-membership step re-sets
      // this and is idempotent.
      await tx
        .update(userTable)
        .set({
          street: draft.street,
          city: draft.city,
          state: draft.state ?? "",
          zip: draft.zip,
          country: draft.country,
          birthDate: draft.birthDate,
          ...(isReconfirmation
            ? { legalMembershipState: "active_member" as const }
            : {}),
        })
        .where(eq(userTable.id, user.id));

      return true;
    });

    if (!submitted) {
      return { success: true };
    }

    try {
      await inngest.send(
        isReconfirmation
          ? {
              name: events.reconfirmationSubmitted.name,
              data: {
                legalMembershipId: parsedInput.legalMembershipId,
                userId: user.id,
              },
            }
          : {
              name: events.applicationSubmitted.name,
              data: { legalMembershipId: parsedInput.legalMembershipId },
            },
      );
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
          .set({ status: preSubmissionStatus })
          .where(eq(legalMembership.id, parsedInput.legalMembershipId));
        if (isReconfirmation) {
          await tx
            .update(userTable)
            .set({ legalMembershipState: user.legalMembershipState })
            .where(eq(userTable.id, user.id));
        }
      });
      return returnValidationErrors(submitApplicationSchema, {
        legalMembershipId: {
          _errors: ["Failed to submit application. Please try again."],
        },
      });
    }

    await writeAuditLog({
      category: "membership",
      eventType: isReconfirmation
        ? "membership.reconfirmation_submitted"
        : "membership.application_submitted",
      actor: { id: user.id, name: user.name },
      subject: { id: user.id, name: user.name },
      metadata: { legalMembershipId: parsedInput.legalMembershipId },
    });

    after(() =>
      track({
        distinctId: ctx.user.id,
        event: "membership_application_submitted",
      }),
    );

    return { success: true };
  });
