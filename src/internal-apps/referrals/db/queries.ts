import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/db/user";
import { can } from "@/lib/permissions/server";
import { referralsStore } from "./server";

export async function getMyReferrals() {
  const [user, allowed] = await Promise.all([
    getCurrentUser(),
    can("apps.referrals.access"),
  ]);
  if (!user) redirect("/auth");
  if (!allowed) redirect("/tools");
  // The browser never supplies a member ID to this query.
  return referralsStore.myDashboard(user.id);
}

export async function getReferralsOverview() {
  if (!(await can("apps.referrals.overview"))) redirect("/referrals");
  await referralsStore.provisionMembers();
  return referralsStore.overview();
}
