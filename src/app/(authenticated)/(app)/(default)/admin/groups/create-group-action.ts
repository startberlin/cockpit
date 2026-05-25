"use server";

import { eq } from "drizzle-orm";
import { after } from "next/server";
import db from "@/db";
import { checkSlugAvailability } from "@/db/groups";
import { group, usersToGroups } from "@/db/schema/group";
import { actionClient } from "@/lib/action-client";
import { writeAuditLog } from "@/lib/audit-log";
import { createGoogleGroup } from "@/lib/google-workspace/directory";
import { isSystemGroupSlug } from "@/lib/groups/system-groups";
import { newId } from "@/lib/id";
import { events, inngest } from "@/lib/inngest";
import { can } from "@/lib/permissions/server";
import { track } from "@/lib/posthog-server";
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

    if (
      isSystemGroupSlug(parsedInput.slug, []) ||
      parsedInput.slug.startsWith("batch-")
    ) {
      throw new Error(
        "This slug is reserved for a system group and cannot be used.",
      );
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
          try {
            await inngest.send({
              name: events.groupMemberAdded.name,
              data: { groupId, userId: currentUser.id },
            });
          } catch (err) {
            console.error(
              `[create-group] Failed to send groupMemberAdded event for group ${groupId}`,
              err,
            );
          }
        }
      } catch (error) {
        console.error(
          `[create-group] Google Group creation failed for group ${groupId}`,
          error,
        );
      }
    }

    await writeAuditLog({
      category: "group",
      eventType: "group.created",
      actor: { id: currentUser.id, name: currentUser.name },
      metadata: { groupId, name: parsedInput.name, slug: parsedInput.slug },
      description: parsedInput.name,
    });

    after(() =>
      track({
        distinctId: currentUser.id,
        event: "group_created",
        properties: {
          has_email_integration: parsedInput.integrations.email,
        },
      }),
    );

    return { id: groupId };
  });
