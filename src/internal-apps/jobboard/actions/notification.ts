"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getNotificationViewer, notifications } from "../lib/notifications";
import { JobboardError } from "../lib/service";
import { jobboardActionClient } from "./client";

export async function getUnreadNotificationCount() {
  const viewer = await getNotificationViewer();
  return viewer ? notifications.unreadCount(viewer.id) : 0;
}

export const markNotificationRead = jobboardActionClient
  .inputSchema(
    z.strictObject({ id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/) }),
  )
  .action(async ({ parsedInput: { id } }) => {
    const viewer = await getNotificationViewer();
    if (!viewer || !(await notifications.markRead(viewer.id, id)))
      throw new JobboardError(
        "notification_unavailable",
        "This notification is unavailable.",
        404,
      );
    revalidatePath("/notifications");
    revalidatePath(`/notifications/jobboard/${id}`);
  });
