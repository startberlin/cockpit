import { ImpersonationBanner } from "@/components/impersonation-banner";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { getApp } from "@/lib/apps/registry";
import { AppShellSidebar } from "./app-shell-sidebar";

interface AppShellProps {
  appId: string;
  user: {
    name: string;
    email: string | null;
    image?: string | null;
    firstName: string;
    lastName: string;
  };
  children: React.ReactNode;
}

/**
 * Chrome for an internal app: its own sidebar and header, no Cockpit navigation
 * and no Cockpit breadcrumbs. Apps live outside the `(app)` route group
 * precisely so they do not inherit that shell.
 *
 * Built from the same shared sidebar primitives Cockpit uses — that reuse is the
 * point of the shared layer.
 */
export function AppShell({ appId, user, children }: AppShellProps) {
  const app = getApp(appId);

  return (
    <SidebarProvider>
      <AppShellSidebar appId={appId} user={user} />
      <SidebarInset className="overflow-x-hidden">
        <ImpersonationBanner />
        <header className="flex h-14 min-h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <span className="text-sm font-medium">{app?.name}</span>
        </header>
        <div className="mx-auto w-full max-w-4xl flex-1 p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
