import { google } from "googleapis";
import db from "@/db";
import { group } from "@/db/schema/group";
import { createGoogleAuth } from "@/lib/google-auth";
import { inngest } from "@/lib/inngest";
import { slack } from "@/lib/slack";

export const createGroupWorkflow = inngest.createFunction(
  { id: "create-group", idempotency: "event.data.id" },
  { event: "group.created" },
  async ({ event, step }) => {
    const { id, name, slug, integrations } = event.data;

    // Step 1: Insert group into database
    await step.run("insert-db-group", async () => {
      await db
        .insert(group)
        .values({
          id,
          name,
          slug,
        })
        .onConflictDoNothing();
    });

    // Step 2: Create Slack channel if requested
    if (integrations.slack) {
      await step.run("create-slack-channel", async () => {
        const result = await slack.conversations.create({
          name: slug,
          is_private: true,
        });

        if (!result.ok) {
          throw new Error(`Failed to create Slack channel: ${result.error}`);
        }

        return { channelId: result.channel?.id };
      });
    }

    // Step 3: Create Google Group if requested
    if (integrations.email) {
      await step.run("create-google-group", async () => {
        const auth = createGoogleAuth(
          "https://www.googleapis.com/auth/admin.directory.group",
        );

        const admin = google.admin({
          auth,
          version: "directory_v1",
        });

        const groupEmail = `${slug}@start-berlin.com`;

        const result = await admin.groups.insert({
          requestBody: {
            email: groupEmail,
            name: name,
            description: `Email group for ${name}`,
          },
        });

        if (result.status !== 200) {
          throw new Error(
            `Failed to create Google Group: ${result.statusText}`,
          );
        }

        return { groupEmail };
      });
    }
  },
);
