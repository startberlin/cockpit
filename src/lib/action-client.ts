import "server-only";

import { redirect } from "next/navigation";
import { createSafeActionClient } from "next-safe-action";
import { getCurrentUser } from "@/db/user";

export const actionClient = createSafeActionClient({handleServerError: ((error) => {
  console.log(error);
})}).use(async ({ next }) => {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  return next({
    ctx: {
      user,
    },
  });
});
