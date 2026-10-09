"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { getApp, isInternalApp } from "@/lib/apps/registry";
import type { InternalAppNavItem } from "@/lib/apps/types";
import { AppIconGlyph } from "./app-icon";

interface AppShellSidebarProps {
  /** App id, not the definition — definitions hold functions and cannot cross the RSC boundary. */
  appId: string;
  navItems?: readonly InternalAppNavItem[];
  user: {
    name: string;
    email: string | null;
    image?: string | null;
    firstName: string;
    lastName: string;
  };
}

/**
 * Navigation for an internal app. Deliberately does NOT reuse `AppSidebar`:
 * an app is its own product, so it shows its own name and its own nav items,
 * not Cockpit's Personal/Community/Admin groups.
 */
export function AppShellSidebar({
  appId,
  navItems,
  user,
}: AppShellSidebarProps) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  const app = getApp(appId);
  if (!app || !isInternalApp(app)) return null;

  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  const items = navItems ?? app.nav?.items ?? [];

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <Link href={app.basePath} onClick={closeMobile}>
                <AppIconGlyph appId={app.id} size={20} />
                <span className="font-semibold">{app.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {items.length > 0 ? (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href}
                      tooltip={item.label}
                    >
                      <Link href={item.href} onClick={closeMobile}>
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Back to Cockpit">
              {/* Plain <a>: the app was opened in its own tab, so this is a
                  deliberate hand-off back rather than in-app navigation. */}
              <a href="/tools">
                <ArrowLeft />
                <span>Back to Cockpit</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSeparator />
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
