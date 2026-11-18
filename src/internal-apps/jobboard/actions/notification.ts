"use server";

import { revalidatePath } from "next/cache";
import { getNotificationViewer, notifications } from "../lib/notifications";

export async function getUnreadNotificationCount() {
  const viewer = await getNotificationViewer();
  return viewer ? notifications.unreadCount(viewer.id) : 0;
}

export async function markNotificationRead(id: string) {
  const viewer = await getNotificationViewer();
  if (!viewer || typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(id))
    return;
  await notifications.markRead(viewer.id, id);
  revalidatePath("/notifications");
  revalidatePath(`/notifications/jobboard/${id}`);
}
