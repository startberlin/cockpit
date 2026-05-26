"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { checkMandateReadyAction } from "./check-mandate-action";

const POLL_INTERVAL_MS = 3_000;
const TIMEOUT_MS = 60_000;

export function PaymentReturnRedirect() {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    const startedAt = Date.now();

    async function poll() {
      if (!activeRef.current) return;

      if (Date.now() - startedAt >= TIMEOUT_MS) {
        setTimedOut(true);
        return;
      }

      try {
        const ready = await checkMandateReadyAction();
        if (!activeRef.current) return;
        if (ready) {
          router.replace("/membership");
          return;
        }
      } catch {
        // transient error — keep polling
      }

      if (activeRef.current) {
        setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    poll();

    return () => {
      activeRef.current = false;
    };
  }, [router]);

  if (timedOut) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="max-w-sm px-6 text-center">
          <p className="text-sm text-muted-foreground">
            Your payment setup is still being confirmed. Check back on your
            membership page in a moment.
          </p>
          <button
            type="button"
            className="mt-4 text-sm font-medium underline underline-offset-4"
            onClick={() => router.replace("/membership")}
          >
            Go to membership
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
    </main>
  );
}
