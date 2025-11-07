"use server";

import { actionClient } from "@/lib/action-client";
import { inngest } from "@/lib/inngest";
import { addPeopleSchema } from "./schema";

export const addPeopleAction = actionClient
  .inputSchema(addPeopleSchema)
  .action(async ({ ctx, parsedInput }) => {
    if (!ctx.user.roles.includes("admin")) {
      throw new Error("You are not an admin.");
    }

    console.log(parsedInput);

    await inngest.send(
      parsedInput.users.map((user) => ({
        name: "user.onboarding",
        data: user,
      })),
    );
  });
