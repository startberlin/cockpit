"use server";

import { eq } from "drizzle-orm";
import db from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { actionClient } from "@/lib/action-client";
import { settingsSchema } from "./settings-validation";

export const saveSettingsAction = actionClient
  .inputSchema(settingsSchema)
  .action(async ({ ctx, parsedInput }) => {
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
        }),
      })
      .where(eq(userTable.id, ctx.user.id));

    return { success: true };
  });
