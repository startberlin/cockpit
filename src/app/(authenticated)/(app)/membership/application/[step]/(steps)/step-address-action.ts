"use server";

import { eq } from "drizzle-orm";
import db from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { actionClient } from "@/lib/action-client";
import { applicationAddressSchema } from "../application-validation";

export const saveApplicationAddressAction = actionClient
  .inputSchema(applicationAddressSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { user } = ctx;

    await db
      .update(userTable)
      .set({
        street: parsedInput.street,
        city: parsedInput.city,
        state: parsedInput.state,
        zip: parsedInput.zip,
        country: parsedInput.country,
      })
      .where(eq(userTable.id, user.id));

    return { success: true };
  });
