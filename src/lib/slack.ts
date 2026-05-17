import "server-only";

import { WebClient } from "@slack/web-api";
import { env } from "@/env";

export const slack = new WebClient(env.SLACK_BOT_TOKEN);

function slackErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = (error as { data?: { error?: unknown } }).data;
    if (data && typeof data.error === "string") return data.error;
  }
  return undefined;
}

export async function lookupSlackUserIdByEmail(
  email: string,
): Promise<string | null> {
  if (env.DISABLE_SLACK) return null;

  try {
    const res = await slack.users.lookupByEmail({ email });
    return res.user?.id ?? null;
  } catch (error) {
    if (slackErrorCode(error) === "users_not_found") return null;
    throw error;
  }
}

export async function inviteToChannel(
  channelId: string,
  slackUserIds: string[],
): Promise<void> {
  if (slackUserIds.length === 0) return;
  if (env.DISABLE_SLACK) {
    console.warn(
      `[slack disabled] would invite ${slackUserIds.join(",")} to ${channelId}`,
    );
    return;
  }

  try {
    await slack.conversations.invite({
      channel: channelId,
      users: slackUserIds.join(","),
    });
  } catch (error) {
    const code = slackErrorCode(error);
    if (code === "already_in_channel" || code === "cant_invite_self") return;
    throw error;
  }
}

export async function kickFromChannel(
  channelId: string,
  slackUserId: string,
): Promise<void> {
  if (env.DISABLE_SLACK) {
    console.warn(
      `[slack disabled] would kick ${slackUserId} from ${channelId}`,
    );
    return;
  }

  try {
    await slack.conversations.kick({
      channel: channelId,
      user: slackUserId,
    });
  } catch (error) {
    const code = slackErrorCode(error);
    if (code === "not_in_channel" || code === "cant_kick_self") return;
    throw error;
  }
}
