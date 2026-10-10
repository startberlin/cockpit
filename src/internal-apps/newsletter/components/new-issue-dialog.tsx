"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { createIssueAction } from "../actions/issues";
import { createIssueSchema } from "../actions/schemas";
import { parseError } from "../lib/error";

export function NewIssueDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const { form, action, handleSubmitWithAction } = useHookFormAction(
    createIssueAction,
    zodResolver(createIssueSchema),
    {
      actionProps: {
        onSuccess: ({ data }) => {
          setOpen(false);
          form.reset();
          // Straight into the composer: naming an issue is a step on the way to
          // writing it, not a destination.
          if (data?.id) router.push(`/newsletter/issues/${data.id}`);
        },
        onError: ({ error }) => toast.error(parseError(error)),
      },
      formProps: { defaultValues: { name: "" } },
    },
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => !action.isPending && setOpen(value)}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          New issue
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New issue</DialogTitle>
          <DialogDescription>
            Start with a working name. The subject line comes later.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={handleSubmitWithAction}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Working name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="October 2026"
                      disabled={action.isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Internal only. Recipients never see this.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={action.isPending}>
                {action.isPending ? "Creating" : "Create issue"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
