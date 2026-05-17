"use client";

import { ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function ImpersonationBanner() {
  const { data } = authClient.useSession();
  const router = useRouter();
  const [stopping, setStopping] = useState(false);

  const impersonatedBy = data?.session?.impersonatedBy;
  if (!impersonatedBy) {
    return null;
  }

  const stop = async () => {
    setStopping(true);
    const result = await authClient.admin.stopImpersonating();
    setStopping(false);
    if (result.error) {
      toast.error(result.error.message ?? "Failed to stop impersonation");
      return;
    }
    router.push("/admin");
    router.refresh();
  };

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
        disabled={stopping}
        onClick={stop}
      >
        {stopping ? "Stopping…" : "Stop impersonation"}
      </Button>
    </div>
  );
}
