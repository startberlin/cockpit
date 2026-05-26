"use server";

import { eq } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";
import db from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { actionClient } from "@/lib/action-client";
import { events, inngest } from "@/lib/inngest";
import { track } from "@/lib/posthog-server";

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

    try {
      await inngest.send({
        name: events.profileOnboardingCompleted.name,
        data: { userId: ctx.user.id },
      });
    } catch (err) {
      console.error(
        `[step-event-email] Failed to send profileOnboardingCompleted event for user ${ctx.user.id}`,
        err,
      );
    }

    after(() => {
      track({
        distinctId: ctx.user.id,
        event: "onboarding_email_preference_selected",
        properties: {
          preference: parsedInput.eventEmailPreference,
        },
      });
      track({
        distinctId: ctx.user.id,
        event: "onboarding_completed",
      });
    });

    return { success: true };
  });
