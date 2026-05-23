"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MembershipCardMenuProps {
  userId: string;
  canPropose: boolean;
  canRemove: boolean;
}

export function MembershipCardMenu({
  userId,
  canPropose,
  canRemove,
}: MembershipCardMenuProps) {
  if (!canPropose && !canRemove) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canPropose && (
          <DropdownMenuItem asChild>
            <Link href={`/admin/people/${userId}/propose`}>
              Propose for membership
            </Link>
          </DropdownMenuItem>
        )}
        {canRemove && (
          <DropdownMenuItem
            asChild
            className="text-destructive focus:text-destructive"
          >
            <Link href={`/admin/people/${userId}/remove`}>
              Remove from START Berlin
            </Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
