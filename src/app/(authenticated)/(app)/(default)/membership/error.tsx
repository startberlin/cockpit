"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

export default function MembershipError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    posthog.captureException(error);
  }, [error]);
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <p className="text-muted-foreground">Failed to load membership data.</p>
      <button type="button" onClick={reset} className="text-sm underline">
        Try again
      </button>
    </div>
  );
}
