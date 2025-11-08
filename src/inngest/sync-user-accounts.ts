import { eq } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import db from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { inngest } from "@/lib/inngest";

interface EventData {
  id: string;
}

export const syncUserAccounts = inngest.createFunction(
  { id: "sync-user-accounts" },
  { event: "cockpit/user.updated" },
  async ({ event }) => {
    const { id } = event.data as EventData;

    const user = await db.query.user.findFirst({
      where: eq(userTable.id, id),
    });

    if (!user) {
      throw new NonRetriableError("User not found");
    }
  },
);
