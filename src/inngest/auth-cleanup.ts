import { lt, sql } from "drizzle-orm";
import db from "@/db";
import { session, verification } from "@/db/schema/auth";
import { inngest } from "@/lib/inngest";

export const authCleanupCron = inngest.createFunction(
  {
    id: "auth-cleanup-cron",
    name: "Auth Cleanup (daily)",
    triggers: [{ cron: "TZ=Europe/Berlin 15 3 * * *" }],
  },
  async ({ step }) => {
    const now = sql`NOW()`;

    const sessions = await step.run("delete-expired-sessions", async () => {
      const result = await db
        .delete(session)
        .where(lt(session.expiresAt, now))
        .returning({ id: session.id });
      return { deletedCount: result.length };
    });

    const verifications = await step.run(
      "delete-expired-verifications",
      async () => {
        const result = await db
          .delete(verification)
          .where(lt(verification.expiresAt, now))
          .returning({ id: verification.id });
        return { deletedCount: result.length };
      },
    );

    return { sessions, verifications };
  },
);
