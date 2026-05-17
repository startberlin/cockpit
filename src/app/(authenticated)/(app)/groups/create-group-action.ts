"use server";

import db from "@/db";
import { checkSlugAvailability } from "@/db/groups";
import { group } from "@/db/schema/group";
import { actionClient } from "@/lib/action-client";
import { newId } from "@/lib/id";
import { events, inngest } from "@/lib/inngest";
import { can } from "@/lib/permissions/server";
import { createGroupSchema } from "./create-group-schema";

export const createGroupAction = actionClient
  .inputSchema(createGroupSchema)
  .action(async ({ parsedInput }) => {
    if (!(await can("groups.create"))) {
      throw new Error("You are not authorized to create groups.");
    }

    const slugAvailable = await checkSlugAvailability(parsedInput.slug);
    if (!slugAvailable) {
      throw new Error("This slug is already taken. Please choose another one.");
    }

    const groupId = newId("group");

    await db.insert(group).values({
      id: groupId,
      name: parsedInput.name,
      slug: parsedInput.slug,
      slackEnabled: parsedInput.integrations.slack,
      emailEnabled: parsedInput.integrations.email,
    });

    // Fire-and-forget: integrations are reconciled by syncGroupIntegrationsWorkflow,
    // with syncGroupsCron as the safety net if this immediate sync fails.
    await inngest.send({
      name: events.groupSyncRequested.name,
      data: { id: groupId },
    });

    return { id: groupId };
  });
