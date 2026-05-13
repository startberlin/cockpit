import gocardless, { Environments } from "gocardless-nodejs";
import { env } from "@/env";

export function getGoCardlessClient() {
  return gocardless(
    env.GOCARDLESS_API_KEY ?? "",
    env.GOCARDLESS_ENVIRONMENT === "sandbox"
      ? Environments.Sandbox
      : Environments.Live,
    { raiseOnIdempotencyConflict: false },
  );
}
