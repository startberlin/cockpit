import "dotenv/config";
import { WebClient } from "@slack/web-api";

const CHANNEL_ID = "C0A9WBKB3FS";

async function main() {
  const userId = process.argv[2];

  if (!userId) {
    console.error("Usage: npx tsx scripts/slack-add-to-channel.ts <user-id>");
    console.error("Example: npx tsx scripts/slack-add-to-channel.ts U12345678");
    process.exit(1);
  }

  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.error("Error: SLACK_BOT_TOKEN environment variable is not set");
    process.exit(1);
  }

  const slack = new WebClient(token);

  try {
    console.log(`Adding user ${userId} to channel...`);
    const result = await slack.conversations.invite({
      channel: CHANNEL_ID,
      users: userId,
    });

    if (!result.ok) {
      if (result.error === "already_in_channel") {
        console.log("User is already a member of this channel");
        return;
      }
      throw new Error(`Failed to invite user: ${result.error}`);
    }

    console.log("Successfully added user to channel");
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
