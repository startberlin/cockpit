"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";

interface UserSessionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userLabel: string;
}

export function UserSessionsSheet({
  open,
  onOpenChange,
  userId,
  userLabel,
}: UserSessionsSheetProps) {
  const queryClient = useQueryClient();
  const queryKey = ["admin", "user-sessions", userId];
  const [revokingToken, setRevokingToken] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const sessionsQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await authClient.admin.listUserSessions({ userId });
      if (result.error) {
        throw new Error(result.error.message ?? "Failed to load sessions");
      }
      return result.data?.sessions ?? [];
    },
    enabled: open,
  });

  const revokeOne = async (sessionToken: string) => {
    setRevokingToken(sessionToken);
    const result = await authClient.admin.revokeUserSession({ sessionToken });
    setRevokingToken(null);
    if (result.error) {
      toast.error(result.error.message ?? "Failed to revoke session");
      return;
    }
    toast.success("Session revoked");
    queryClient.invalidateQueries({ queryKey });
  };

  const revokeAll = async () => {
    setRevokingAll(true);
    const result = await authClient.admin.revokeUserSessions({ userId });
    setRevokingAll(false);
    if (result.error) {
      toast.error(result.error.message ?? "Failed to revoke sessions");
      return;
    }
    toast.success("All sessions revoked");
    queryClient.invalidateQueries({ queryKey });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0 w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Active sessions</SheetTitle>
          <SheetDescription>{userLabel}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-3">
          {sessionsQuery.isLoading ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : sessionsQuery.isError ? (
            <p className="text-sm text-destructive">
              {(sessionsQuery.error as Error).message}
            </p>
          ) : sessionsQuery.data && sessionsQuery.data.length > 0 ? (
            sessionsQuery.data.map((session) => (
              <div
                key={session.id}
                className="rounded-md border p-3 text-sm flex flex-col gap-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {session.ipAddress ?? "Unknown IP"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={revokingToken === session.token}
                    onClick={() => revokeOne(session.token)}
                  >
                    Revoke
                  </Button>
                </div>
                {session.userAgent && (
                  <p className="text-xs text-muted-foreground break-all">
                    {session.userAgent}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Created {new Date(session.createdAt).toLocaleString()} ·
                  expires {new Date(session.expiresAt).toLocaleString()}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No active sessions.</p>
          )}
        </div>
        <SheetFooter>
          <Button
            variant="destructive"
            disabled={
              revokingAll ||
              !sessionsQuery.data ||
              sessionsQuery.data.length === 0
            }
            onClick={revokeAll}
          >
            {revokingAll ? "Revoking…" : "Revoke all sessions"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
