import "server-only";

import { and, eq } from "drizzle-orm";
import db from "@/db";
import { userAccessGrant } from "@/db/schema";
import { getCurrentUser } from "@/db/user";

export async function isMaintenanceAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  const grant = await db.query.userAccessGrant.findFirst({
    where: and(
      eq(userAccessGrant.userId, user.id),
      eq(userAccessGrant.grant, "admin"),
    ),
  });

  return !!grant;
}
