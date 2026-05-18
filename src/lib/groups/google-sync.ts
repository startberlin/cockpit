import "server-only";

import { eq } from "drizzle-orm";
import db from "@/db";
import { group } from "@/db/schema/group";
import { events, inngest } from "@/lib/inngest";

export async function triggerGoogleSync(groupId: string) {
  await db
    .update(group)
    .set({ googleSyncPending: true })
    .where(eq(group.id, groupId));
  await inngest.send({
    name: events.groupCriteriaChanged.name,
    data: { groupId },
  });
}
