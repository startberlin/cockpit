import { redirect } from "next/navigation";
import { AppShell } from "@/components/apps/app-shell";
import { getCurrentUser } from "@/db/user";
import { requireAppAccess } from "@/lib/apps/server";
import type { InternalAppNavItem } from "@/lib/apps/types";
import { can } from "@/lib/permissions/server";
import { referralsApp } from "../app";

export default async function ReferralsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAppAccess("referrals");
  const [user, canViewOverview] = await Promise.all([
    getCurrentUser(),
    can("apps.referrals.overview"),
  ]);
  if (!user) redirect("/auth");
  const navItems: InternalAppNavItem[] = [...referralsApp.nav.items];
  if (canViewOverview)
    navItems.push({ label: "Overview", href: "/referrals/overview" });
  return (
    <AppShell
      appId="referrals"
      navItems={navItems}
      user={{
        name: user.name,
        email: user.email,
        image: user.image,
        firstName: user.firstName,
        lastName: user.lastName,
      }}
    >
      {children}
    </AppShell>
  );
}
