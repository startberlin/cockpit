import { env } from "@/env";
import {
  GOCARDLESS_API_VERSION,
  GoCardlessConfigurationError,
  GoCardlessRequestError,
} from "./types";

interface GoCardlessRequestOptions {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
  idempotencyKey?: string;
}

export function requireGoCardlessConfig() {
  if (!env.GOCARDLESS_API_KEY) {
    throw new GoCardlessConfigurationError("GOCARDLESS_API_KEY is required");
  }

  if (!env.GOCARDLESS_MEMBERSHIP_TEMPLATE_ID) {
    throw new GoCardlessConfigurationError(
      "GOCARDLESS_MEMBERSHIP_TEMPLATE_ID is required",
    );
  }

  return {
    apiKey: env.GOCARDLESS_API_KEY,
    baseUrl: env.GOCARDLESS_BASE_URL.replace(/\/$/, ""),
    membershipTemplateId: env.GOCARDLESS_MEMBERSHIP_TEMPLATE_ID,
  };
}

export async function goCardlessRequest<T>(
  path: string,
  options: GoCardlessRequestOptions = {},
): Promise<T> {
  const config = requireGoCardlessConfig();
  const headers = new Headers({
    Authorization: `Bearer ${config.apiKey}`,
    "GoCardless-Version": GOCARDLESS_API_VERSION,
    Accept: "application/json",
  });

  if (options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (options.idempotencyKey) {
    headers.set("Idempotency-Key", options.idempotencyKey);
  }

  const response = await fetch(`${config.baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new GoCardlessRequestError(
      `GoCardless request failed with ${response.status}`,
      response.status,
      responseBody,
    );
  }

  return (await response.json()) as T;
}
