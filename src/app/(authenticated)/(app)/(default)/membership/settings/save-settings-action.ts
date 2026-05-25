"use server";

import { eq } from "drizzle-orm";
import db from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { actionClient } from "@/lib/action-client";
import { getPostHogClient } from "@/lib/posthog-server";
import { settingsSchema } from "./settings-validation";

export const saveSettingsAction = actionClient
  .inputSchema(settingsSchema)
  .action(async ({ ctx, parsedInput }) => {
    const current = ctx.user;

    await db
      .update(userTable)
      .set({
        personalEmail: parsedInput.personalEmail,
        phone: parsedInput.phone,
        street: parsedInput.street,
        city: parsedInput.city,
        state: parsedInput.state,
        zip: parsedInput.zip,
        country: parsedInput.country,
        ...(parsedInput.eventEmailPreference !== undefined && {
          eventEmailPreference: parsedInput.eventEmailPreference,
          eventInviteEmail:
            parsedInput.eventEmailPreference === "custom"
              ? (parsedInput.eventInviteEmail ?? null)
              : null,
        }),
      })
      .where(eq(userTable.id, ctx.user.id));

    const changedFields: string[] = [];

    if (parsedInput.personalEmail !== current.personalEmail) {
      changedFields.push("personalEmail");
    }
    if (parsedInput.phone !== current.phone) {
      changedFields.push("phone");
    }
    if (parsedInput.street !== current.street) {
      changedFields.push("street");
    }
    if (parsedInput.city !== current.city) {
      changedFields.push("city");
    }
    if (parsedInput.state !== current.state) {
      changedFields.push("state");
    }
    if (parsedInput.zip !== current.zip) {
      changedFields.push("zip");
    }
    if (parsedInput.country !== current.country) {
      changedFields.push("country");
    }
    if (
      parsedInput.eventEmailPreference !== undefined &&
      parsedInput.eventEmailPreference !== current.eventEmailPreference
    ) {
      changedFields.push("eventEmailPreference");
    }
    const nextEventInviteEmail =
      parsedInput.eventEmailPreference === undefined
        ? current.eventInviteEmail
        : parsedInput.eventEmailPreference === "custom"
          ? (parsedInput.eventInviteEmail ?? null)
          : null;

    if (nextEventInviteEmail !== current.eventInviteEmail) {
      changedFields.push("eventInviteEmail");
    }

    try {
      getPostHogClient()?.capture({
        distinctId: ctx.user.id,
        event: "profile_updated",
        properties: { changed_fields: changedFields },
      });
    } catch (err) {
      console.error("[analytics] Failed to capture profile_updated:", err);
    }

    return { success: true };
  });
