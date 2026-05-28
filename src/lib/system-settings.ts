import "server-only";

import { cache } from "react";
import db from "@/db";

export const getSystemSettings = cache(async () => {
  const row = await db.query.systemSettings.findFirst({
    where: (table, { eq }) => eq(table.id, "singleton"),
  });
  return { maintenanceMode: row?.maintenanceMode ?? false };
});
