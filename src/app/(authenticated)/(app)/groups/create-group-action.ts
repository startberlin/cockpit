"use server";

import { checkSlugAvailability } from "@/db/groups";
import { actionClient } from "@/lib/action-client";
import { newId } from "@/lib/id";
import { inngest } from "@/lib/inngest";
import { can } from "@/lib/permissions/server";
import { createGroupSchema } from "./create-group-schema";

export const createGroupAction = actionClient
  .inputSchema(createGroupSchema)
  .action(async ({ parsedInput }) => {
    if (!(await can("groups.create"))) {
      throw new Error("You are not authorized to create groups.");
    }

    // Re-validate slug availability server-side
    const slugAvailable = await checkSlugAvailability(parsedInput.slug);
    if (!slugAvailable) {
      throw new Error("This slug is already taken. Please choose another one.");
    }

    // Generate a unique ID for the group
    const groupId = newId("group");

    // Send event to trigger the group creation workflow
    await inngest.send({
      name: "group.created",
      data: {
        id: groupId,
        name: parsedInput.name,
        slug: parsedInput.slug,
        integrations: parsedInput.integrations,
      },
    });

    return { id: groupId };
  });
