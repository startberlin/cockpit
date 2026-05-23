"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { proposeMembershipAction } from "@/app/(authenticated)/(app)/(default)/people/propose-membership-action";
import { Button } from "@/components/ui/button";

interface ProposeMembershipFormProps {
  userId: string;
  backHref: string;
}

export function ProposeMembershipForm({
  userId,
  backHref,
}: ProposeMembershipFormProps) {
  const router = useRouter();

  const { execute, isPending } = useAction(proposeMembershipAction, {
    onSuccess: () => {
      toast.success("Membership proposed", {
        description:
          "The board admission workflow has been started for this member.",
      });
      router.push(backHref);
    },
    onError: ({ error }) => {
      toast.error(
        error.serverError ?? "Could not propose membership. Please try again.",
      );
    },
  });

  return (
    <div className="flex gap-3">
      <Button type="button" variant="outline" asChild>
        <Link href={backHref}>Cancel</Link>
      </Button>
      <Button
        type="button"
        disabled={isPending}
        onClick={() => execute({ userId })}
      >
        {isPending ? "Proposing…" : "Propose for membership"}
      </Button>
    </div>
  );
}
