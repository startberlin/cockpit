import "server-only";
import { cache } from "react";
import db from "@/db";
import { getUserAuthority } from "@/db/authority";
import { getCurrentUser } from "@/db/user";
import { isJobboardNotificationRecipient } from "@/lib/permissions/evaluate";
import { createJobboardNotifications } from "../db/notifications";

export const notifications = createJobboardNotifications(db);
export const getNotificationViewer = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;
  const authority = await getUserAuthority(user.id);
  return authority && isJobboardNotificationRecipient(authority)
    ? { id: user.id }
    : null;
});
