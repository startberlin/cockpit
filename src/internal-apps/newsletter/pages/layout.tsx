import { redirect } from "next/navigation";
import { AppShell } from "@/components/apps/app-shell";
import { getCurrentUser } from "@/db/user";
import { requireAppAccess } from "@/lib/apps/server";

/**
 * Access gate plus chrome for the newsletter app.
 *
 * The shell runs `full`: full width and a bounded height, so each page owns its
 * own scroll container. The composer needs that to split into two independently
 * scrolling panes — in Cockpit's default `max-w-4xl` page-scrolling column, a
 * side-by-side editor and preview simply scroll away together. Pages that want
 * the usual reading column opt back into it with `PageContainer`.
 *
 * This guards page renders only — server actions re-check `can()` themselves.
 */
export default async function NewsletterAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAppAccess("newsletter");

  const user = await getCurrentUser();
  if (!user) redirect("/auth");

  return (
    <AppShell appId="newsletter" width="full" user={user}>
      {children}
    </AppShell>
  );
}
