"use client";

import { ChevronRight, CreditCard, IdCard, Layers, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Can } from "@/components/can";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import type { GlobalAction } from "@/lib/permissions";

type SubItem = {
  href: string;
  label: string;
  permission?: GlobalAction;
  isActive: (pathname: string) => boolean;
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: (pathname: string) => boolean;
  permission?: GlobalAction;
  items?: SubItem[];
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/membership",
    label: "My membership",
    icon: IdCard,
    isActive: (p) => p === "/membership" || p.startsWith("/membership/"),
  },
  {
    href: "/people",
    label: "People",
    icon: Users,
    isActive: (p) => p === "/people" || p.startsWith("/people/"),
    items: [
      {
        href: "/people/directory",
        label: "Directory",
        isActive: (p) =>
          p === "/people/directory" || p.startsWith("/people/directory/"),
      },
      {
        href: "/people/batches",
        label: "Batches",
        permission: "batches.manage",
        isActive: (p) => p.startsWith("/people/batches"),
      },
    ],
  },
  {
    href: "/groups",
    label: "Groups",
    icon: Layers,
    isActive: (p) => p === "/groups" || p.startsWith("/groups/"),
  },
  {
    href: "/payments",
    label: "Payments",
    icon: CreditCard,
    permission: "payments.manage",
    isActive: (p) => p === "/payments" || p.startsWith("/payments/"),
  },
];

export function NavMain() {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarMenu>
        {NAV_ITEMS.map((item) => {
          if (!item.items?.length) {
            const menuItem = (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={item.isActive(pathname)}
                  tooltip={item.label}
                >
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );

            return item.permission ? (
              <Can key={item.href} permission={item.permission}>
                {menuItem}
              </Can>
            ) : (
              menuItem
            );
          }

          return (
            <NavMainCollapsibleItem
              key={item.href}
              item={item as NavItem & { items: SubItem[] }}
              pathname={pathname}
            />
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}

function NavMainCollapsibleItem({
  item,
  pathname,
}: {
  item: NavItem & { items: SubItem[] };
  pathname: string;
}) {
  const isParentActive = item.isActive(pathname);

  return (
    <Collapsible
      asChild
      defaultOpen={isParentActive}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton isActive={isParentActive} tooltip={item.label}>
            <item.icon />
            <span>{item.label}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.items.map((sub) => {
              const link = (
                <SidebarMenuSubItem key={sub.href}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={sub.isActive(pathname)}
                  >
                    <Link href={sub.href}>
                      <span>{sub.label}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );

              return sub.permission ? (
                <Can key={sub.href} permission={sub.permission}>
                  {link}
                </Can>
              ) : (
                link
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
