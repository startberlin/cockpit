import { redirect } from "next/navigation";
import { AppShell } from "@/components/apps/app-shell";
import { getCurrentUser } from "@/db/user";
import { requireAppAccess } from "@/lib/apps/server";

export default async function ReferralsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAppAccess("referrals");
  const user = await getCurrentUser();
  if (!user) redirect("/auth");
  return (
    <AppShell
      appId="referrals"
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
