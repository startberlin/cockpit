import createClient, { Environments } from "gocardless-nodejs";
import { env } from "@/env";

export const gocardless = createClient(
  env.GOCARDLESS_API_KEY ?? "",
  env.GOCARDLESS_ENVIRONMENT === "sandbox"
    ? Environments.Sandbox
    : Environments.Live,
  { raiseOnIdempotencyConflict: false },
);
