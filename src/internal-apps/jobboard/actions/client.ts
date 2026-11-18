import "server-only";

import { redirect } from "next/navigation";
import { createSafeActionClient } from "next-safe-action";
import { getCurrentUser } from "@/db/user";
import { JobboardError } from "../lib/service";

export const jobboardActionClient = createSafeActionClient({
  handleServerError: (error) => {
    if (error instanceof JobboardError) return error.message;
    // Database errors can include SQL parameters containing private contact details.
    console.error("[jobboard-action] Request failed.");
    return "Unable to save this change. Try again or contact Operations.";
  },
}).use(async ({ next }) => {
  const user = await getCurrentUser();
  if (!user) redirect("/auth");
  return next({ ctx: { user } });
});
