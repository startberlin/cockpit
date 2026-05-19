"use client";

import {
  ChevronRight,
  CreditCard,
  IdCard,
  Layers,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Can, useCan } from "@/components/can";
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
import { useAuthority } from "@/lib/permissions/authority-context";

export function NavMain() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const authority = useAuthority();
  const can = useCan();

  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  const showAdminGroup =
    authority?.grants.some((g) =>
      ["admin", "super_admin", "people_admin", "finance_admin"].includes(
        g.grant,
      ),
    ) ||
    authority?.positions.some(
      (p) =>
        p.position === "department_head" || p.position === "head_of_finance",
    ) ||
    false;

  const canSeeAdminDirectory =
    authority?.grants.some((g) =>
      ["admin", "super_admin", "people_admin"].includes(g.grant),
    ) ||
    authority?.positions.some((p) => p.position === "department_head") ||
    false;

  const canSeeSettings =
    authority?.grants.some((g) => ["admin", "super_admin"].includes(g.grant)) ||
    false;

  const adminPeopleActive = pathname.startsWith("/admin/people/");
  const showAdminPeople = canSeeAdminDirectory || can("batches.manage");

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
                isActive={
                  pathname === "/people/directory" ||
                  pathname.startsWith("/people/directory/")
                }
                tooltip="Directory"
              >
                <Link href="/people/directory" onClick={closeMobile}>
                  <Users />
                  <span>Directory</span>
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

      {/* Admin */}
      {showAdminGroup && (
        <SidebarGroup>
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Admin > People (collapsible) */}
              {showAdminPeople && (
                <NavMainCollapsibleItem
                  label="People"
                  icon={Users}
                  isParentActive={adminPeopleActive}
                  tooltip="People"
                >
                  {canSeeAdminDirectory && (
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={
                          pathname === "/admin/people/directory" ||
                          pathname.startsWith("/admin/people/directory/")
                        }
                      >
                        <Link
                          href="/admin/people/directory"
                          onClick={closeMobile}
                        >
                          <span>Directory</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  )}
                  <Can permission="batches.manage">
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={pathname.startsWith("/admin/people/batches")}
                      >
                        <Link
                          href="/admin/people/batches"
                          onClick={closeMobile}
                        >
                          <span>Batches</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </Can>
                </NavMainCollapsibleItem>
              )}

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

              {/* Admin > Settings */}
              {canSeeSettings && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      pathname === "/admin/settings" ||
                      pathname.startsWith("/admin/settings/")
                    }
                    tooltip="Settings"
                  >
                    <Link href="/admin/settings" onClick={closeMobile}>
                      <Settings />
                      <span>Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}
    </>
  );
}

function NavMainCollapsibleItem({
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
  return (
    <Collapsible
      asChild
      defaultOpen={isParentActive}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton isActive={isParentActive} tooltip={tooltip}>
            <Icon />
            <span>{label}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>{children}</SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
