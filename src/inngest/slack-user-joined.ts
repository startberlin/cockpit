import { eq } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import db from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { env } from "@/env";
import { events, inngest } from "@/lib/inngest";
import { slack } from "@/lib/slack";

export const handleSlackEvent = inngest.createFunction(
  {
    id: "handle-slack-event",
    triggers: [{ event: events.slackUserJoined }],
  },
  async ({ event, step }) => {
    const { id } = event.data;

    if (env.DISABLE_SLACK) {
      console.warn(
        `[slack disabled] handleSlackEvent(${id}) — skipping entire workflow`,
      );
      return { skipped: "slack-disabled" };
    }

    const userEmail = await step.run("find-slack-user-email", async () => {
      const response = await slack.users.profile.get({
        user: id,
      });

      if (!response.ok) {
        throw new Error(`Failed to find Slack user: ${response.error}`);
      }

      if (!response.profile) {
        throw new NonRetriableError("Slack user not found");
      }

      if (!response.profile.email) {
        throw new NonRetriableError("Slack user email not found");
      }

      return response.profile.email;
    });

    const user = await step.run("find-user-by-email", async () => {
      const user = await db.query.user.findFirst({
        where: eq(userTable.email, userEmail),
      });

      if (!user) {
        throw new NonRetriableError("User not found");
      }

      return user;
    });

    await step.sendEvent("sync-user-accounts", {
      name: events.cockpitUserUpdated.name,
      data: {
        id: user.id,
      },
    });

    await step.run("send-welcome-message", async () => {
      const response = await slack.chat.postMessage({
        channel: id,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `👋 Welcome to Slack, ${user.firstName}!`,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "You will be added to your respective Slack channels shortly.",
            },
          },
          {
            type: "context",
            elements: [
              {
                type: "plain_text",
                text: "In case of any problems, reach out to cockpit@start-berlin.com.",
                emoji: true,
              },
            ],
          },
        ],
      });

      if (!response.ok) {
        throw new Error(`Failed to send welcome message: ${response.error}`);
      }
    });
  },
);
