"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function NewsletterError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex flex-col items-center gap-4 p-8 text-center">
      <p className="text-muted-foreground">
        This newsletter page could not be loaded. Please try again.
      </p>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
