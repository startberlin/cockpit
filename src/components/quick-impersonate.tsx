"use client";

import { useQuery } from "@tanstack/react-query";
import { UserCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";

export function QuickImpersonate({ onSelected }: { onSelected?: () => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();

  const usersQuery = useQuery({
    queryKey: ["admin", "quick-impersonate", search],
    queryFn: async () => {
      const result = await authClient.admin.listUsers({
        query: search
          ? { searchValue: search, searchField: "email", limit: 20 }
          : { limit: 20 },
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Failed to load users");
      }
      return result.data?.users ?? [];
    },
    enabled: open,
    staleTime: 30_000,
  });

  const impersonate = async (userId: string) => {
    const result = await authClient.admin.impersonateUser({ userId });
    if (result.error) {
      toast.error(result.error.message ?? "Failed to impersonate");
      return;
    }
    setOpen(false);
    onSelected?.();
    router.push("/membership");
    router.refresh();
  };

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip="Impersonate user"
          onClick={() => setOpen(true)}
        >
          <UserCog />
          <span>Impersonate…</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Impersonate user"
        description="Search by email and select a user to impersonate."
      >
        <CommandInput
          placeholder="Search by email…"
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          {usersQuery.isLoading ? (
            <CommandEmpty>Loading…</CommandEmpty>
          ) : (
            <CommandEmpty>No users found.</CommandEmpty>
          )}
          <CommandGroup>
            {usersQuery.data?.map((user) => (
              <CommandItem
                key={user.id}
                value={`${user.email} ${user.name}`}
                onSelect={() => impersonate(user.id)}
              >
                <div className="flex flex-col">
                  <span className="text-sm">{user.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
