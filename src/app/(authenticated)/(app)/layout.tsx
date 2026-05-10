import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { getUserAuthority } from "@/db/authority";
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
      <SidebarProvider>
        <AppSidebar user={user} />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
          </header>
          <main className="mx-auto w-full max-w-4xl flex-1">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </AuthorityProvider>
  );
}
