import "server-only";

import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "@/lib/auth";
import type { User } from "./schema/auth";

export const getCurrentUser = cache(async () => {
  const user = await auth.api.getSession({ headers: await headers() });

  console.log(user);

  if (!user) {
    return null;
  }

  return user.user as User;
});
