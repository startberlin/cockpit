"use server";

import { getCurrentUser } from "@/db/user";

export async function checkMandateReadyAction(): Promise<boolean> {
  const user = await getCurrentUser();
  return !!user?.gocardlessMandateId;
}
