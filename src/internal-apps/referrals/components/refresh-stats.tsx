"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function RefreshStats() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-11"
      aria-label="Refresh statistics"
      aria-busy={pending}
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <RefreshCw
        className={pending ? "motion-safe:animate-spin" : undefined}
        aria-hidden="true"
      />
    </Button>
  );
}
