import "server-only";

import { can } from "@/lib/permissions/server";

/** Layout access does not protect directly invoked server actions. */
export async function assertNewsletterAccess(): Promise<void> {
  if (!(await can("apps.newsletter.access"))) {
    throw new Error("You are not authorized to use the newsletter app.");
  }
}
