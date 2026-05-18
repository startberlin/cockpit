"use client";

import { UserCog } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { impersonateAction } from "./impersonate-action";

interface ImpersonateButtonProps {
  userId: string;
  userEmail: string;
}

export function ImpersonateButton({
  userId,
  userEmail,
}: ImpersonateButtonProps) {
  const { execute, isPending } = useAction(impersonateAction, {
    onSuccess: () => {
      toast.success(`Now impersonating ${userEmail}`);
      window.location.href = "/membership";
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Failed to impersonate");
    },
  });

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => execute({ userId })}
    >
      <UserCog />
      {isPending ? "Starting…" : "Impersonate"}
    </Button>
  );
}
