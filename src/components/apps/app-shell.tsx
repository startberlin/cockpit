import { ImpersonationBanner } from "@/components/impersonation-banner";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { getApp } from "@/lib/apps/registry";
import type { InternalAppNavItem } from "@/lib/apps/types";
import { AppShellSidebar } from "./app-shell-sidebar";

interface AppShellProps {
  appId: string;
  /** Server-filtered navigation. Defaults to the app registry. */
  navItems?: readonly InternalAppNavItem[];
  /**
   * Content column width.
   *
   * - `default` — Cockpit's usual `max-w-4xl` reading column.
   * - `wide` — full viewport width, still scrolling with the page.
   * - `full` — full width *and* a bounded height, so the page can own its own
   *   scroll containers. Needed for side-by-side tools like an editor with a
   *   live preview, where the two halves have to scroll independently.
   */
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

/**
 * Chrome for an internal app: its own sidebar and header, no Cockpit navigation
 * and no Cockpit breadcrumbs. Apps live outside the `(app)` route group
 * precisely so they do not inherit that shell.
 *
 * Built from the same shared sidebar primitives Cockpit uses — that reuse is the
 * point of the shared layer.
 */
export function AppShell({
  appId,
  navItems,
  user,
  width = "default",
  children,
}: AppShellProps) {
  const app = getApp(appId);

  return (
    <SidebarProvider>
      <AppShellSidebar appId={appId} navItems={navItems} user={user} />
      <SidebarInset
        className={
          width === "full"
            ? // Bound the height so a `min-h-0` child can scroll instead of
              // growing the page. The inset variant adds `m-2`, which costs
              // 1rem vertically on md and up.
              "h-svh overflow-hidden md:h-[calc(100svh-1rem)]"
            : "overflow-x-hidden"
        }
      >
        <ImpersonationBanner />
        <header className="flex h-14 min-h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <span className="text-sm font-medium">{app?.name}</span>
        </header>
        <div
          className={
            width === "full"
              ? "flex min-h-0 w-full flex-1 flex-col"
              : width === "wide"
                ? "flex w-full flex-1 flex-col p-6"
                : "mx-auto w-full max-w-4xl flex-1 p-6"
          }
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
