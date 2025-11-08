"use server";

import { actionClient } from "@/lib/action-client";
import { inngest } from "@/lib/inngest";
import { createUserSchema } from "./create-user-schema";

export const createUserAction = actionClient
  .inputSchema(createUserSchema)
  .action(async ({ ctx, parsedInput }) => {
    if (!ctx.user.roles.includes("admin")) {
      throw new Error("You are not an admin.");
    }

    const {
      firstName,
      lastName,
      personalEmail,
      batchNumber,
      departmentId,
      status,
    } = parsedInput;

    await inngest.send({
      name: "user.created",
      data: {
        firstName,
        lastName,
        personalEmail,
        batchNumber,
        departmentId,
        status,
      },
    });
  });
