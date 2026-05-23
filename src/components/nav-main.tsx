"use client";

import {
  AppWindow,
  ChevronRight,
  CreditCard,
  IdCard,
  Layers,
  Network,
  ScrollText,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useLayoutEffect } from "react";
import { Can } from "@/components/can";
import {
  HidableGroupContext,
  useHidableGroupContext,
  useHidableGroupState,
} from "@/components/hidable-group-context";
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

export function NavMain() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <>
      {/* Personal */}
      <SidebarGroup>
        <SidebarGroupLabel>Personal</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={
                  pathname === "/membership" ||
                  pathname.startsWith("/membership/")
                }
                tooltip="My membership"
              >
                <Link href="/membership" onClick={closeMobile}>
                  <IdCard />
                  <span>My membership</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === "/tools"}
                tooltip="Tools"
              >
                <Link href="/tools" onClick={closeMobile}>
                  <AppWindow />
                  <span>Tools</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {/* Community */}
      <SidebarGroup>
        <SidebarGroupLabel>Community</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === "/people"}
                tooltip="People"
              >
                <Link href="/people" onClick={closeMobile}>
                  <Users />
                  <span>People</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === "/people/org-chart"}
                tooltip="Org Chart"
              >
                <Link href="/people/org-chart" onClick={closeMobile}>
                  <Network />
                  <span>Org Chart</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={
                  pathname === "/groups" || pathname.startsWith("/groups/")
                }
                tooltip="Groups"
              >
                <Link href="/groups" onClick={closeMobile}>
                  <Layers />
                  <span>Groups</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {/* Admin — auto-hides when user has no admin permissions */}
      <HidableSidebarGroup label="Admin">
        <SidebarMenu>
          {/* Admin > People (collapsible) */}
          <HidableNavCollapsibleItem
            label="People"
            icon={Users}
            isParentActive={pathname.startsWith("/admin/people/")}
            tooltip="People"
          >
            <Can permission="user.view_details">
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  asChild
                  isActive={
                    pathname === "/admin/people" ||
                    (pathname.startsWith("/admin/people/") &&
                      !pathname.startsWith("/admin/people/batches"))
                  }
                >
                  <Link href="/admin/people" onClick={closeMobile}>
                    <span>Members</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            </Can>
            <Can permission="batches.manage">
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  asChild
                  isActive={pathname.startsWith("/admin/people/batches")}
                >
                  <Link href="/admin/people/batches" onClick={closeMobile}>
                    <span>Batches</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            </Can>
          </HidableNavCollapsibleItem>

          {/* Admin > Groups */}
          <Can permission="groups.view_all">
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={
                  pathname === "/admin/groups" ||
                  pathname.startsWith("/admin/groups/")
                }
                tooltip="Groups"
              >
                <Link href="/admin/groups" onClick={closeMobile}>
                  <Layers />
                  <span>Groups</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </Can>

          {/* Admin > Payments */}
          <Can permission="payments.manage">
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={
                  pathname === "/admin/payments" ||
                  pathname.startsWith("/admin/payments/")
                }
                tooltip="Payments"
              >
                <Link href="/admin/payments" onClick={closeMobile}>
                  <CreditCard />
                  <span>Payments</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </Can>

          {/* Admin > Audit log */}
          <Can permission="audit_log.read">
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith("/admin/audit-log")}
                tooltip="Audit log"
              >
                <Link href="/admin/audit-log" onClick={closeMobile}>
                  <ScrollText />
                  <span>Audit log</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </Can>

          {/* Admin > Settings (collapsible) */}
          <HidableNavCollapsibleItem
            label="Settings"
            icon={Settings}
            isParentActive={pathname.startsWith("/admin/settings")}
            tooltip="Settings"
          >
            <Can permission="settings.positions.manage">
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  asChild
                  isActive={pathname.startsWith("/admin/settings/positions")}
                >
                  <Link href="/admin/settings/positions" onClick={closeMobile}>
                    <span>Officer Assignments</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            </Can>
          </HidableNavCollapsibleItem>
        </SidebarMenu>
      </HidableSidebarGroup>
    </>
  );
}

function HidableSidebarGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const { hasVisible, contextValue } = useHidableGroupState();

  return (
    <HidableGroupContext.Provider value={contextValue}>
      <SidebarGroup className={hasVisible ? undefined : "hidden"}>
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
        <SidebarGroupContent>{children}</SidebarGroupContent>
      </SidebarGroup>
    </HidableGroupContext.Provider>
  );
}

function HidableNavCollapsibleItem({
  label,
  icon: Icon,
  isParentActive,
  tooltip,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isParentActive: boolean;
  tooltip: string;
  children: React.ReactNode;
}) {
  const outerContext = useHidableGroupContext();
  const outerReportId = useId();
  const { hasVisible, contextValue } = useHidableGroupState();

  useLayoutEffect(() => {
    if (!outerContext) return;
    outerContext.report(outerReportId, hasVisible);
    return () => outerContext.report(outerReportId, false);
  }, [outerContext, outerReportId, hasVisible]);

  return (
    <HidableGroupContext.Provider value={contextValue}>
      <Collapsible
        asChild
        defaultOpen={isParentActive}
        className={`group/collapsible${hasVisible ? "" : " hidden"}`}
      >
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton isActive={isParentActive} tooltip={tooltip}>
              <Icon />
              <span>{label}</span>
              <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent forceMount className="data-[state=closed]:hidden">
            <SidebarMenuSub>{children}</SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    </HidableGroupContext.Provider>
  );
}
