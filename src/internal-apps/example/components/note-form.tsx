"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseError } from "@/lib/error";
import { createNoteAction } from "../actions/create-note";
import { createNoteSchema } from "../actions/create-note-schema";

export function NoteForm() {
  const { form, action, handleSubmitWithAction } = useHookFormAction(
    createNoteAction,
    zodResolver(createNoteSchema),
    {
      actionProps: {
        onSuccess: () => {
          form.reset();
          toast.success("Note added.");
        },
        onError: ({ error }) => toast.error(parseError(error)),
      },
      formProps: {
        defaultValues: { body: "" },
      },
    },
  );

  const isPending = action.isPending;

  return (
    <form className="flex items-center gap-2" onSubmit={handleSubmitWithAction}>
      <Input
        {...form.register("body")}
        placeholder="Write a note…"
        maxLength={500}
      />
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Adding…" : "Add"}
      </Button>
    </form>
  );
}
