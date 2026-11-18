"use client";

import { Button } from "@/components/ui/button";

export default function JobboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div role="alert" className="space-y-3 rounded-lg border p-6">
      <h2 className="font-semibold">Unable to load the jobboard</h2>
      <p className="text-sm text-muted-foreground">
        Your saved work is still available. Try loading this page again.
      </p>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
