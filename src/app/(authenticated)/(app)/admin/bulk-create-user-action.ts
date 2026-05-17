"use server";

import { actionClient } from "@/lib/action-client";
import { generateCompanyEmail } from "@/lib/google-workspace/email";
import { events, inngest } from "@/lib/inngest";
import { isSuperAdmin } from "@/lib/superadmin";
import { bulkCreateUserSchema } from "./bulk-create-user-schema";

export const bulkCreateUserAction = actionClient
  .inputSchema(bulkCreateUserSchema)
  .action(async ({ parsedInput }) => {
    if (!(await isSuperAdmin())) {
      throw new Error("You are not authorized to bulk-create users.");
    }

    const { entries, department, status, batchNumber } = parsedInput;

    await Promise.all(
      entries.map((entry) =>
        inngest.send({
          name: events.userCreated.name,
          data: {
            firstName: entry.firstName,
            lastName: entry.lastName,
            personalEmail: entry.personalEmail,
            companyEmail: generateCompanyEmail(entry.firstName, entry.lastName),
            ...(batchNumber != null ? { batchNumber } : {}),
            department,
            status,
          },
        }),
      ),
    );

    return { scheduled: entries.length };
  });
