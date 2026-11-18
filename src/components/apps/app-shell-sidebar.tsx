"use client";

import { ArrowLeft, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavUser } from "@/components/nav-user";
import { Button } from "@/components/ui/button";
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
import { APP_NAV_ICONS } from "./app-icons";

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
  const currentItem = items
    .filter(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="flex-row items-center">
        <SidebarMenu className="min-w-0 flex-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              tooltip={app.name}
              className="group-data-[collapsible=icon]:justify-center"
            >
              <Link
                href={app.basePath}
                onClick={closeMobile}
                aria-label={app.name}
              >
                <AppIconGlyph appId={app.id} size={20} className="shrink-0" />
                <span className="font-semibold group-data-[collapsible=icon]:hidden">
                  {app.name}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {isMobile ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0"
            aria-label="Close navigation"
            onClick={closeMobile}
          >
            <X aria-hidden="true" />
          </Button>
        ) : null}
      </SidebarHeader>

      <SidebarContent>
        {items.length > 0 ? (
          <SidebarGroup>
            <SidebarGroupContent
              role="navigation"
              aria-label={`${app.name} navigation`}
            >
              <SidebarMenu>
                {items.map((item) => {
                  const Icon = APP_NAV_ICONS[item.icon];
                  const isCurrent = item === currentItem;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isCurrent}
                        tooltip={item.label}
                        className="h-11 md:h-8"
                      >
                        <Link
                          href={item.href}
                          onClick={closeMobile}
                          aria-label={item.label}
                          aria-current={
                            isCurrent
                              ? pathname === item.href
                                ? "page"
                                : "location"
                              : undefined
                          }
                        >
                          <Icon aria-hidden="true" />
                          <span className="group-data-[collapsible=icon]:hidden">
                            {item.label}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
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
              <a href="/tools" aria-label="Back to Cockpit">
                <ArrowLeft aria-hidden="true" />
                <span className="group-data-[collapsible=icon]:hidden">
                  Back to Cockpit
                </span>
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
