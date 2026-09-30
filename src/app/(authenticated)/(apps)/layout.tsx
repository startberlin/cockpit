import { redirect } from "next/navigation";
import { getUserAuthority } from "@/db/authority";
import { getCurrentUser } from "@/db/user";
import { AuthorityProvider } from "@/lib/permissions/authority-context";
import { getOnboardingProgress } from "@/schema/onboarding-progress";

/**
 * Shared guards for internal apps.
 *
 * Sibling to `(app)`, not nested inside it: apps are their own products and must
 * not inherit Cockpit's sidebar, header, or breadcrumbs. The guards below mirror
 * `(app)/layout.tsx` because they are about being a signed-in, onboarded member
 * — not about Cockpit specifically.
 *
 * Per-app access is enforced one level down, in `(apps)/<slug>/layout.tsx`.
 */
export default async function AppsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    return redirect("/auth");
  }

  if (getOnboardingProgress(user) !== "completed") {
    return redirect("/onboarding");
  }

  const authority = await getUserAuthority(user.id);

  if (!authority) {
    return redirect("/auth");
  }

  return (
    <AuthorityProvider authority={authority}>{children}</AuthorityProvider>
  );
}
