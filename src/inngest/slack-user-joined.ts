import { WebClient } from "@slack/web-api";
import { eq } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import db from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { env } from "@/env";
import { inngest } from "@/lib/inngest";

const slack = new WebClient(env.SLACK_BOT_TOKEN);

interface EventData {
  id: string;
}

export const handleSlackEvent = inngest.createFunction(
  {
    id: "handle-slack-event",
  },
  { event: "slack/user.joined" },
  async ({ event, step }) => {
    const { id } = event.data as EventData;

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

    await step.run("sync-user-accounts", async () => {
      await inngest.send({
        name: "cockpit/user.updated",
        data: {
          id: user.id,
        },
      });
    });

    await step.run("send-welcome-message", async () => {
      const response = await slack.chat.postMessage({
        channel: id,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "👋 Welcome to Slack, Sönke!",
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
