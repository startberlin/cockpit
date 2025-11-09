"use server";

import { actionClient } from "@/lib/action-client";
import { inngest } from "@/lib/inngest";
import { can } from "@/lib/permissions/server";
import { createUserSchema } from "./create-user-schema";

export const createUserAction = actionClient
  .inputSchema(createUserSchema)
  .action(async ({ parsedInput }) => {
    if (!can("user.manage")) {
      throw new Error("You are not authorized to create users.");
    }

    await inngest.send({
      name: "user.created",
      data: parsedInput,
    });
  });
