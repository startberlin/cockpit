import { lt, sql } from "drizzle-orm";
import db from "@/db";
import { verification } from "@/db/schema/auth";
import { inngest } from "@/lib/inngest";

export const authCleanupCron = inngest.createFunction(
  {
    id: "auth-cleanup-cron",
    name: "Auth Cleanup (daily)",
    triggers: [{ cron: "TZ=Europe/Berlin 15 3 * * *" }],
  },
  async ({ step }) => {
    const sessions = await step.run("delete-expired-sessions", async () => {
      // Keep the most recent session per user (even if expired) so the admin
      // "Last sign-in" column in member-summary-strip.tsx still has a row to
      // read from. Only purge older expired rows.
      const result = await db.execute(sql`
        DELETE FROM "session"
        WHERE "expires_at" < NOW()
          AND "id" NOT IN (
            SELECT DISTINCT ON ("user_id") "id"
            FROM "session"
            ORDER BY "user_id", "updated_at" DESC
          )
        RETURNING "id"
      `);
      return { deletedCount: result.rowCount ?? 0 };
    });

    const verifications = await step.run(
      "delete-expired-verifications",
      async () => {
        const result = await db
          .delete(verification)
          .where(lt(verification.expiresAt, sql`NOW()`))
          .returning({ id: verification.id });
        return { deletedCount: result.length };
      },
    );

    return { sessions, verifications };
  },
);
