import "server-only";

import { cache } from "react";
import { getCurrentUser } from "@/db/user";

export const isSuperAdmin = cache(async () => {
  const user = await getCurrentUser();
  return user?.role === "admin";
});
