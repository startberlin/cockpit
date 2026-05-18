import { and, eq, isNull } from "drizzle-orm";
import { google } from "googleapis";
import db from "@/db";
import { group } from "@/db/schema/group";
import { env } from "@/env";
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
      if (env.DISABLE_SLACK) {
        console.warn(
          `[slack disabled] would have created channel ${g.slackChannelSlug ?? g.slug} for group ${id}`,
        );
      } else {
        try {
          const channelSlug = g.slackChannelSlug ?? g.slug;
          const channelId = await step.run(
            "create-or-resolve-slack-channel",
            async () => {
              const result = await slack.conversations.create({
                name: channelSlug,
                is_private: true,
              });

              if (result.ok && result.channel?.id) {
                return result.channel.id;
              }

              if (result.error === "name_taken") {
                const listResult = await slack.conversations.list({
                  types: "private_channel",
                });
                const existing = listResult.channels?.find(
                  (ch) => ch.name === channelSlug,
                );
                if (existing?.id) {
                  return existing.id;
                }
              }

              throw new Error(
                `Failed to create Slack channel: ${result.error}`,
              );
            },
          );

          await step.run("persist-slack-channel-id", async () => {
            await db
              .update(group)
              .set({ slackChannelId: channelId })
              .where(and(eq(group.id, id), isNull(group.slackChannelId)));
          });
        } catch (error) {
          console.error(
            `[sync-group-integrations] Slack sync failed for group ${id}`,
            error,
          );
        }
      }
    }

    if (g.emailEnabled && !g.googleGroupEmail) {
      if (env.DISABLE_GOOGLE_WORKSPACE) {
        console.warn(
          `[google-workspace disabled] would have created Google Group ${g.googleEmailPrefix ?? g.slug}@start-berlin.com for group ${id}`,
        );
      } else {
        try {
          await step.run("sync-google-group", async () => {
            const auth = createGoogleAuth(
              "https://www.googleapis.com/auth/admin.directory.group",
            );

            const admin = google.admin({ auth, version: "directory_v1" });
            const emailPrefix = g.googleEmailPrefix ?? g.slug;
            const groupEmail = `${emailPrefix}@start-berlin.com`;

            try {
              await admin.groups.insert({
                requestBody: {
                  email: groupEmail,
                  name: g.name,
                  description: `Email group for ${g.name}`,
                },
              });
            } catch (insertError: unknown) {
              const status =
                insertError &&
                typeof insertError === "object" &&
                "status" in insertError
                  ? (insertError as { status: number }).status
                  : null;

              // 409 means the group already exists — resolve and reuse it.
              if (status !== 409) throw insertError;
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
    }

    return { ok: true };
  },
);
