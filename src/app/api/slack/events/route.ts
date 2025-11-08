import { headers } from "next/headers";
import { z } from "zod";
import { env } from "@/env";
import { inngest } from "@/lib/inngest";
import { isValidSlackRequest } from "../../../../lib/verify-request";

const EventSchema = z.union([
  z.object({
    type: z.literal("url_verification"),
    challenge: z.string(),
    token: z.string(),
  }),
  z.object({
    type: z.literal("event_callback"),
    event: z.object({
      type: z.literal("join_team"),
      user: z.object({
        id: z.string(),
      }),
    }),
  }),
]);

export async function POST(request: Request) {
  const rawBody = await request.text();
  const h = await headers();

  const signature = h.get("x-slack-signature") as string;
  const requestTimestamp = Number(h.get("x-slack-request-timestamp"));

  const isValid = isValidSlackRequest({
    signingSecret: env.SLACK_SIGNING_SECRET,
    body: rawBody,
    headers: {
      "x-slack-signature": signature,
      "x-slack-request-timestamp": requestTimestamp,
    },
  });

  if (!isValid) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = JSON.parse(rawBody);

  console.log(body);

  const parsed = EventSchema.safeParse(body);

  if (!parsed.success) {
    return new Response("Invalid request", { status: 400 });
  }

  switch (parsed.data.type) {
    case "url_verification":
      return new Response(parsed.data.challenge, { status: 200 });
    case "event_callback":
      await inngest.send({
        name: "slack/user.joined",
        data: {
          id: parsed.data.event.user.id,
        },
      });

      return new Response("OK");
  }

  return new Response("OK");
}
