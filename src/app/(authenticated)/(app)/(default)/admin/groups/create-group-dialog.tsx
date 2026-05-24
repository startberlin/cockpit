"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Can } from "@/components/can";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { createGroupAction } from "./create-group-action";
import {
  type CreateGroupFormData,
  createGroupSchema,
} from "./create-group-schema";

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function CreateGroupDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm<CreateGroupFormData>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: {
      name: "",
      slug: "",
      integrations: { email: false, googleEmailPrefix: undefined },
    },
  });

  const { execute, isPending } = useAction(createGroupAction, {
    onSuccess: () => {
      toast.success("Group created.");
      setOpen(false);
      form.reset();
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error(
        error.serverError ?? "Could not create group. Please try again.",
      );
    },
  });

  const emailEnabled = form.watch("integrations.email");

  return (
    <Can permission="groups.create">
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) form.reset();
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Create group
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create group</DialogTitle>
            <DialogDescription>
              Create a new manual group. Members are added one by one.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => execute(data))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Group name"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          if (!form.getValues("slug")) {
                            form.setValue("slug", slugify(e.target.value));
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input placeholder="group-slug" {...field} />
                    </FormControl>
                    <FormDescription>
                      Lowercase letters, numbers, and hyphens.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="integrations.email"
                render={({ field }) => (
                  <FormItem className="flex items-start gap-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div>
                      <FormLabel>Enable email</FormLabel>
                      <FormDescription>
                        Create a Google Group for this group.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              {emailEnabled && (
                <FormField
                  control={form.control}
                  name="integrations.googleEmailPrefix"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email prefix</FormLabel>
                      <FormControl>
                        <Input placeholder="my-group" {...field} />
                      </FormControl>
                      <FormDescription>
                        The email will be prefix@start-berlin.com. Defaults to
                        slug.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Creating…" : "Create group"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Can>
  );
}
