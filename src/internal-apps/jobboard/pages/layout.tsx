import { redirect } from "next/navigation";
import { AppShell } from "@/components/apps/app-shell";
import { getCurrentUser } from "@/db/user";
import { requireAppAccess } from "@/lib/apps/server";

export default async function JobboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAppAccess("jobboard");
  const user = await getCurrentUser();
  if (!user) redirect("/auth");
  return (
    <AppShell appId="jobboard" user={user} width="wide">
      {children}
    </AppShell>
  );
}
