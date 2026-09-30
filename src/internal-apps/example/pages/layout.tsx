import { redirect } from "next/navigation";
import { AppShell } from "@/components/apps/app-shell";
import { getCurrentUser } from "@/db/user";
import { requireAppAccess } from "@/lib/apps/server";

/**
 * Access gate plus chrome for the example app. Lives in the layout so it covers
 * every nested route, including ones added later.
 *
 * This guards page renders only — server actions are separate endpoints and
 * re-check `can()` themselves.
 */
export default async function ExampleAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAppAccess("example");

  const user = await getCurrentUser();
  if (!user) redirect("/auth");

  return (
    <AppShell appId="example" user={user}>
      {children}
    </AppShell>
  );
}
