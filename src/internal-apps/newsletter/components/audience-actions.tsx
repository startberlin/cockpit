"use client";

import { RefreshCw, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  assignSegmentAction,
  refreshSegmentMembershipAction,
  syncContactsAction,
} from "../actions/audience";
import { parseError } from "../lib/error";
import { ImportDialog } from "./import-dialog";

export function AudienceActions({
  defaultSegmentId,
  contactCount,
  mode,
}: {
  defaultSegmentId: string | null;
  contactCount: number;
  mode: "sandbox" | "live";
}) {
  const router = useRouter();

  const sync = useAction(syncContactsAction, {
    onSuccess: ({ data }) => {
      toast.success(`Synced ${data?.synced ?? 0} contacts from Resend.`);
      router.refresh();
    },
    onError: ({ error }) => toast.error(parseError(error)),
  });

  const refresh = useAction(refreshSegmentMembershipAction, {
    onSuccess: ({ data }) => {
      toast.success(
        `Checked segment membership for ${data?.checked ?? 0} contacts.`,
      );
      router.refresh();
    },
    onError: ({ error }) => toast.error(parseError(error)),
  });

  const assign = useAction(assignSegmentAction, {
    onSuccess: ({ data }) => {
      if (data?.mode === "sandbox") {
        toast.success(
          `Sandbox: ${data.simulated} contacts would be added. No contacts were changed.`,
        );
      } else if (data?.failed) {
        toast.error(
          `Added ${data.added}, but ${data.failed} failed: ${data.firstError}`,
        );
      } else {
        toast.success(
          `Added ${data?.added ?? 0} contacts (${data?.skipped ?? 0} already in the segment).`,
        );
      }
      router.refresh();
    },
    onError: ({ error }) => toast.error(parseError(error)),
  });
  // These operations all replace the same audience mirror. Keep them serial
  // so a slower sync cannot overwrite a newer segment membership result.
  const busy = sync.isPending || refresh.isPending || assign.isPending;

  return (
    <div className="flex flex-wrap gap-2">
      <ImportDialog mode={mode} />

      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => sync.execute()}
      >
        <RefreshCw className={sync.isPending ? "animate-spin" : undefined} />
        {sync.isPending ? "Syncing" : "Sync from Resend"}
      </Button>

      <Button
        size="sm"
        variant="outline"
        disabled={busy || contactCount === 0}
        onClick={() => refresh.execute()}
        title="Refresh which contacts belong to each segment."
      >
        <Users />
        {refresh.isPending ? "Checking" : "Refresh segment membership"}
      </Button>

      {defaultSegmentId ? (
        <Button
          size="sm"
          variant="outline"
          disabled={busy || contactCount === 0}
          onClick={() => assign.execute({ segmentId: defaultSegmentId })}
        >
          <UserPlus />
          {assign.isPending ? "Adding" : "Add contacts to segment"}
        </Button>
      ) : null}
    </div>
  );
}
