"use client";

import { ShieldAlert } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { stopImpersonatingAction } from "./stop-impersonating-action";

export function ImpersonationBanner() {
  const { data } = authClient.useSession();

  const { execute, isPending } = useAction(stopImpersonatingAction, {
    onSuccess: () => {
      window.location.href = "/people";
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Failed to stop impersonation");
    },
  });

  const impersonatedBy = data?.session?.impersonatedBy;
  if (!impersonatedBy) {
    return null;
  }

  return (
    <div className="sticky top-0 z-50 bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <ShieldAlert className="size-4 shrink-0" />
        <span className="truncate">
          Impersonating <strong>{data?.user?.email}</strong>
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="bg-amber-50 border-amber-700 text-amber-950 hover:bg-amber-100"
        disabled={isPending}
        onClick={() => execute()}
      >
        {isPending ? "Stopping…" : "Stop impersonation"}
      </Button>
    </div>
  );
}
