"use client";

import { Button } from "@/components/ui/button";

export default function ReferralsError({ reset }: { reset: () => void }) {
  return (
    <div className="space-y-4">
      <p>Referrals could not be loaded.</p>
      <Button type="button" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
