import { eq } from "drizzle-orm";
import { google } from "googleapis";
import db from "@/db";
import { group } from "@/db/schema/group";
import { createGoogleAuth } from "@/lib/google-auth";
import { events, inngest } from "@/lib/inngest";
import { slack } from "@/lib/slack";

export const syncGroupIntegrationsWorkflow = inngest.createFunction(
  {
    id: "sync-group-integrations",
    triggers: [{ event: events.groupSyncRequested }],
  },
  async ({ event, step }) => {
    const { id } = event.data;

    const g = await step.run("load-group", () =>
      db.query.group.findFirst({ where: eq(group.id, id) }),
    );

    if (!g) {
      return { skipped: "group-not-found" };
    }

    if (g.slackEnabled && !g.slackChannelId) {
      // Try/catch wraps step.run so Inngest still retries the step on transient
      // failures; we only swallow once retries are exhausted. The cron will pick
      // it up later.
      try {
        await step.run("sync-slack-channel", async () => {
          const result = await slack.conversations.create({
            name: g.slug,
            is_private: true,
          });

          if (!result.ok || !result.channel?.id) {
            throw new Error(`Failed to create Slack channel: ${result.error}`);
          }

          await db
            .update(group)
            .set({ slackChannelId: result.channel.id })
            .where(eq(group.id, id));
        });
      } catch (error) {
        console.error(
          `[sync-group-integrations] Slack sync failed for group ${id}`,
          error,
        );
      }
    }

    if (g.emailEnabled && !g.googleGroupEmail) {
      try {
        await step.run("sync-google-group", async () => {
          const auth = createGoogleAuth(
            "https://www.googleapis.com/auth/admin.directory.group",
          );

          const admin = google.admin({ auth, version: "directory_v1" });
          const groupEmail = `${g.slug}@start-berlin.com`;

          const result = await admin.groups.insert({
            requestBody: {
              email: groupEmail,
              name: g.name,
              description: `Email group for ${g.name}`,
            },
          });

          if (result.status !== 200) {
            throw new Error(
              `Failed to create Google Group: ${result.statusText}`,
            );
          }

          await db
            .update(group)
            .set({ googleGroupEmail: groupEmail })
            .where(eq(group.id, id));
        });
      } catch (error) {
        console.error(
          `[sync-group-integrations] Email sync failed for group ${id}`,
          error,
        );
      }
    }

    return { ok: true };
  },
);
