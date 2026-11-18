import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { BreadcrumbProvider } from "@/components/breadcrumb-bridge";
import { BugReportButton } from "@/components/bug-report-panel";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { NavBreadcrumb } from "@/components/nav-breadcrumb";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { getUserAuthority } from "@/db/authority";
import { getCurrentUser } from "@/db/user";
import { NotificationBell } from "@/internal-apps/jobboard/components/notification-controls";
import { AuthorityProvider } from "@/lib/permissions/authority-context";
import { isJobboardNotificationRecipient } from "@/lib/permissions/evaluate";
import { getOnboardingProgress } from "@/schema/onboarding-progress";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default async function AppLayout({ children }: AppLayoutProps) {
  const user = await getCurrentUser();

  if (!user) {
    return redirect("/auth");
  }

  const onboardingStatus = getOnboardingProgress(user);

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
          <SidebarInset className="overflow-x-hidden">
            <ImpersonationBanner />
            <header className="flex h-14 min-h-14 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              <NavBreadcrumb />
              <div className="ml-auto flex shrink-0 items-center gap-1">
                {isJobboardNotificationRecipient(authority) && (
                  <NotificationBell viewerId={user.id} />
                )}
                <BugReportButton />
              </div>
            </header>
            {children}
          </SidebarInset>
        </SidebarProvider>
      </BreadcrumbProvider>
    </AuthorityProvider>
  );
}
