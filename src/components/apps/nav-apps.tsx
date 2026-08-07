"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { visibleInternalApps } from "@/lib/apps/registry";
import type { InternalAppDefinition } from "@/lib/apps/types";
import { useAuthority } from "@/lib/permissions/authority-context";
import { AppIconGlyph } from "./app-icon";

/**
 * Sidebar group listing the internal apps the current user may open.
 *
 * Unlike the Admin group, this does not need `HidableSidebarGroup`: that exists
 * because `<Can>` children resolve during render so the parent cannot know in
 * advance. Here visibility is computed synchronously from `useAuthority()`, so
 * an early return is enough.
 */
export function NavApps() {
  const authority = useAuthority();
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  const apps = useMemo(() => visibleInternalApps(authority), [authority]);

  if (apps.length === 0) return null;

  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Apps</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {apps.map((app) => (
            <AppNavItem
              key={app.id}
              app={app}
              pathname={pathname}
              onNavigate={closeMobile}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function AppNavItem({
  app,
  pathname,
  onNavigate,
}: {
  app: InternalAppDefinition;
  pathname: string;
  onNavigate: () => void;
}) {
  const label = app.nav?.label ?? app.name;
  const isActive =
    pathname === app.basePath || pathname.startsWith(`${app.basePath}/`);
  const items = app.nav?.items ?? [];

  if (items.length === 0) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
          <Link href={app.basePath} onClick={onNavigate}>
            <AppIconGlyph appId={app.id} size={16} />
            <span>{label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible asChild defaultOpen={isActive} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton isActive={isActive} tooltip={label}>
            <AppIconGlyph appId={app.id} size={16} />
            <span>{label}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent forceMount className="data-[state=closed]:hidden">
          <SidebarMenuSub>
            {items.map((item) => (
              <SidebarMenuSubItem key={item.href}>
                <SidebarMenuSubButton asChild isActive={pathname === item.href}>
                  <Link href={item.href} onClick={onNavigate}>
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
