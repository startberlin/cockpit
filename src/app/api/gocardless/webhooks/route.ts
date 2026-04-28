import { headers } from "next/headers";
import { recordAndProcessGoCardlessEvent } from "@/db/gocardless-events";
import { env } from "@/env";
import { GoCardlessWebhookSchema } from "@/lib/gocardless/webhook";
import { isValidGoCardlessWebhook } from "@/lib/verify-request";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const h = await headers();

  if (!env.GOCARDLESS_WEBHOOK_SECRET) {
    return new Response("GoCardless webhook not configured", { status: 500 });
  }

  const signature = h.get("webhook-signature");
  const isValid = isValidGoCardlessWebhook({
    webhookSecret: env.GOCARDLESS_WEBHOOK_SECRET,
    body: rawBody,
    signature,
  });

  if (!isValid) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid request", { status: 400 });
  }

  const parsed = GoCardlessWebhookSchema.safeParse(body);

  if (!parsed.success) {
    return new Response("Invalid request", { status: 400 });
  }

  for (const event of parsed.data.events) {
    await recordAndProcessGoCardlessEvent(event);
  }

  return new Response("OK");
}
