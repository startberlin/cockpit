"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import db from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { actionClient } from "@/lib/action-client";

const schema = z.object({
  personalEmail: z
    .union([z.email("Please enter a valid email address."), z.literal("")])
    .optional(),
});

export const saveAlumniCommunityAction = actionClient
  .inputSchema(schema)
  .action(async ({ ctx, parsedInput }) => {
    if (parsedInput.personalEmail) {
      await db
        .update(userTable)
        .set({ personalEmail: parsedInput.personalEmail })
        .where(eq(userTable.id, ctx.user.id));
    }
    return { success: true };
  });
