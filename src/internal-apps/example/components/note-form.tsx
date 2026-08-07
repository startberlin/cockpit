"use client";

import { useAction } from "next-safe-action/hooks";
import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseError } from "@/lib/error";
import { createNoteAction } from "../actions/create-note";

export function NoteForm() {
  const formRef = useRef<HTMLFormElement>(null);

  const { execute, isPending } = useAction(createNoteAction, {
    onSuccess: () => {
      formRef.current?.reset();
      toast.success("Note added.");
    },
    onError: ({ error }) => toast.error(parseError(error)),
  });

  return (
    <form
      ref={formRef}
      className="flex items-center gap-2"
      action={(formData) =>
        execute({ body: String(formData.get("body") ?? "") })
      }
    >
      <Input name="body" placeholder="Write a note…" maxLength={500} required />
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Adding…" : "Add"}
      </Button>
    </form>
  );
}
