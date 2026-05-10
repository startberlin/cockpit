import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { BreadcrumbProvider } from "@/components/breadcrumb-bridge";
import { NavBreadcrumb } from "@/components/nav-breadcrumb";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { getUserAuthority } from "@/db/authority";
import { getActiveLegalMembership } from "@/db/membership";
import { getCurrentUser } from "@/db/user";
import { AuthorityProvider } from "@/lib/permissions/authority-context";
import { getOnboardingProgress } from "@/schema/onboarding-progress";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default async function AppLayout({ children }: AppLayoutProps) {
  const user = await getCurrentUser();

  if (!user) {
    return redirect("/auth");
  }

  // Only not_member users can have a reconfirmation-pending tenure; skip the
  // DB query for active members to keep this path zero-cost for most users.
  if (user.legalMembershipState === "not_member") {
    const activeTenure = await getActiveLegalMembership(user.id);
    if (activeTenure?.status === "membership_reconfirmation_pending") {
      return redirect("/membership/application/personal-information");
    }
  }

  const onboardingStatus = await getOnboardingProgress(user);

  if (onboardingStatus !== "completed") {
    return redirect("/onboarding");
  }

  const authority = await getUserAuthority(user.id);

  if (!authority) {
    return redirect("/auth");
  }

  return (
    <AuthorityProvider authority={authority}>
      <BreadcrumbProvider>
        <SidebarProvider>
          <AppSidebar user={user} />
          <SidebarInset>
            <header className="flex h-14 min-h-14 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              <NavBreadcrumb />
            </header>
            <div className="mx-auto w-full max-w-4xl flex-1 p-6">
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </BreadcrumbProvider>
    </AuthorityProvider>
  );
}
