"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import db from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { actionClient } from "@/lib/action-client";

const schema = z
  .object({
    eventEmailPreference: z.enum(["personal_email", "start_email", "custom"], {
      message: "Please choose which email address to use for event invites.",
    }),
    eventInviteEmail: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.eventEmailPreference === "custom") {
      if (!z.email().safeParse(data.eventInviteEmail ?? "").success) {
        ctx.addIssue({
          code: "custom",
          message: "Please enter a valid email address.",
          path: ["eventInviteEmail"],
        });
      }
    }
  });

export const saveEventEmailPreferenceAction = actionClient
  .inputSchema(schema)
  .action(async ({ ctx, parsedInput }) => {
    await db
      .update(userTable)
      .set({
        eventEmailPreference: parsedInput.eventEmailPreference,
        eventInviteEmail:
          parsedInput.eventEmailPreference === "custom"
            ? (parsedInput.eventInviteEmail ?? null)
            : null,
      })
      .where(eq(userTable.id, ctx.user.id));

    return { success: true };
  });
