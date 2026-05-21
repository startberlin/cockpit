"use server";

import { eq } from "drizzle-orm";
import db from "@/db";
import { checkSlugAvailability } from "@/db/groups";
import { group, usersToGroups } from "@/db/schema/group";
import { actionClient } from "@/lib/action-client";
import { createGoogleGroup } from "@/lib/google-workspace/directory";
import { triggerGoogleSync } from "@/lib/groups/google-sync";
import { newId } from "@/lib/id";
import { can } from "@/lib/permissions/server";
import { createGroupSchema } from "./create-group-schema";

export const createGroupAction = actionClient
  .inputSchema(createGroupSchema)
  .action(async ({ parsedInput, ctx: { user: currentUser } }) => {
    if (!(await can("groups.create"))) {
      throw new Error("You are not authorized to create groups.");
    }

    const slugAvailable = await checkSlugAvailability(parsedInput.slug);
    if (!slugAvailable) {
      throw new Error("This slug is already taken. Please choose another one.");
    }

    const groupId = newId("group");

    try {
      await db.insert(group).values({
        id: groupId,
        name: parsedInput.name,
        slug: parsedInput.slug,
        emailEnabled: parsedInput.integrations.email,
        googleEmailPrefix: parsedInput.integrations.googleEmailPrefix ?? null,
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: string }).code === "23505"
      ) {
        throw new Error(
          "This slug is already taken. Please choose another one.",
        );
      }
      throw error;
    }

    await db.insert(usersToGroups).values({
      userId: currentUser.id,
      groupId,
      source: "manual",
    });

    if (parsedInput.integrations.email) {
      const emailPrefix =
        parsedInput.integrations.googleEmailPrefix ?? parsedInput.slug;
      try {
        const googleGroupEmail = await createGoogleGroup(
          emailPrefix,
          parsedInput.name,
        );
        if (googleGroupEmail) {
          await db
            .update(group)
            .set({ googleGroupEmail })
            .where(eq(group.id, groupId));
          await triggerGoogleSync(groupId);
        }
      } catch (error) {
        console.error(
          `[create-group] Google Group creation failed for group ${groupId}`,
          error,
        );
      }
    }

    return { id: groupId };
  });
