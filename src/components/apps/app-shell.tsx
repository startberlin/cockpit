import { cookies } from "next/headers";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { getApp } from "@/lib/apps/registry";
import type { InternalAppNavItem } from "@/lib/apps/types";
import { SIDEBAR_COOKIE_NAME } from "@/lib/sidebar-preference";
import { AppShellSidebar } from "./app-shell-sidebar";

interface AppShellProps {
  appId: string;
  /** Defaults to the registry unless access checks filter the navigation. */
  navItems?: readonly InternalAppNavItem[];
  /** Opt-in layouts for workspaces; existing apps keep their reading column. */
  width?: "default" | "wide" | "full";
  user: {
    name: string;
    email: string | null;
    image?: string | null;
    firstName: string;
    lastName: string;
  };
  children: React.ReactNode;
}

const widthClasses = {
  default: {
    inset: "min-w-0 overflow-x-hidden",
    content: "mx-auto w-full max-w-4xl flex-1 p-6",
  },
  wide: {
    inset: "min-w-0 overflow-x-clip",
    content:
      "mx-auto flex min-w-0 w-full max-w-[1600px] flex-1 flex-col p-4 sm:p-6",
  },
  full: {
    inset: "h-svh min-w-0 overflow-hidden md:h-[calc(100svh-1rem)]",
    content: "flex min-h-0 min-w-0 w-full flex-1 flex-col",
  },
} as const;

/**
 * Chrome for an internal app: its own sidebar and header, no Cockpit navigation
 * and no Cockpit breadcrumbs. Apps live outside the `(app)` route group
 * precisely so they do not inherit that shell.
 *
 * Built from the same shared sidebar primitives Cockpit uses — that reuse is the
 * point of the shared layer.
 */
export async function AppShell({
  appId,
  navItems,
  user,
  width = "default",
  children,
}: AppShellProps) {
  const app = getApp(appId);
  const classes = widthClasses[width];
  const defaultOpen =
    (await cookies()).get(SIDEBAR_COOKIE_NAME)?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppShellSidebar appId={appId} navItems={navItems} user={user} />
      <SidebarInset className={classes.inset}>
        <ImpersonationBanner />
        <header className="flex h-14 min-h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1 size-11" />
          <span className="text-sm font-medium">{app?.name}</span>
        </header>
        <div className={classes.content}>{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
