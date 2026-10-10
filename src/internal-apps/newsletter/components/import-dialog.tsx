"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listImportGroupsAction,
  previewImportAction,
  runImportAction,
} from "../actions/import";
import { importGroupSchema } from "../actions/schemas";
import { parseError } from "../lib/error";

/**
 * Imports a Cockpit group into Resend.
 *
 * Always shows the diff before doing anything: how many people the group
 * resolves to, how many are already contacts, how many have no address. Adding
 * several hundred people to a mailing list is not an action anyone should take
 * without seeing the number first.
 */
export function ImportDialog({ mode }: { mode: "sandbox" | "live" }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const [groups, setGroups] = useState<{ slug: string; name: string }[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [previewData, setPreviewData] =
    useState<
      NonNullable<Awaited<ReturnType<typeof previewImportAction>>>["data"]
    >();
  const [loadingPreview, setLoadingPreview] = useState(false);
  const { form, action: run } = useHookFormAction(
    runImportAction,
    zodResolver(importGroupSchema),
    {
      actionProps: {
        onSuccess: ({ data }) => {
          setOpen(false);
          const n = data?.submitted ?? 0;
          const people = `${n} contact${n === 1 ? "" : "s"}`;
          toast.success(
            data?.mode === "sandbox"
              ? `Sandbox: ${people} prepared, nothing was written to Resend.`
              : `Submitted ${people} to Resend. The import runs in the background.`,
          );
          router.refresh();
        },
        onError: ({ error }) => toast.error(parseError(error)),
      },
      formProps: { defaultValues: { groupSlug: "" } },
    },
  );
  const groupSlug = form.watch("groupSlug");
  const busy = run.isPending || form.formState.isSubmitting;

  useEffect(() => {
    if (!open) return;
    let current = true;
    setLoadingGroups(true);
    void listImportGroupsAction()
      .then((result) => {
        if (!current) return;
        if (result?.data) setGroups(result.data.groups);
        else toast.error(parseError(result));
      })
      .catch((error) => {
        if (current) toast.error(parseError(error));
      })
      .finally(() => {
        if (current) setLoadingGroups(false);
      });
    return () => {
      current = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !groupSlug) return;
    let current = true;
    setPreviewData(undefined);
    setLoadingPreview(true);
    // A result belongs to the group that was selected when it was requested.
    // Ignore late responses after another group is selected or the dialog closes.
    void previewImportAction({ groupSlug })
      .then((result) => {
        if (!current) return;
        if (result?.data) setPreviewData(result.data);
        else toast.error(parseError(result));
      })
      .catch((error) => {
        if (current) toast.error(parseError(error));
      })
      .finally(() => {
        if (current) setLoadingPreview(false);
      });
    return () => {
      current = false;
    };
  }, [open, groupSlug]);

  const data = previewData?.groupSlug === groupSlug ? previewData : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (busy) return;
        if (value) setPreviewData(undefined);
        setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Download />
          Import from Cockpit
        </Button>
      </DialogTrigger>
      <DialogContent className="grid-cols-1">
        <DialogHeader>
          <DialogTitle>Import from Cockpit</DialogTitle>
          <DialogDescription>
            Adds people from a Cockpit group as Resend contacts, tagged with
            where they came from.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit(async (values) => {
              if (busy || loadingPreview || !data?.sample.length) return;
              await run.executeAsync(values);
            })}
          >
            <FormField
              control={form.control}
              name="groupSlug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={loadingGroups || busy}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pick a group" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {groups.map((group) => (
                        <SelectItem key={group.slug} value={group.slug}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {loadingPreview ? (
              <p role="status" className="text-sm text-muted-foreground">
                Loading group members
              </p>
            ) : data ? (
              <div className="flex flex-col gap-3 border bg-muted/30 p-3 text-sm">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat label="New" value={data.fresh} />
                  <Stat label="Already there" value={data.existing} />
                  <Stat label="No address" value={data.withoutEmail} />
                </div>
                {data.sample.length ? (
                  <p className="break-words text-xs text-muted-foreground">
                    For example: {data.sample.slice(0, 3).join(", ")}
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Existing contacts keep their subscription, including opt-outs,
                  and their segment membership.
                </p>
              </div>
            ) : null}

            <DialogFooter>
              <Button
                disabled={
                  !groupSlug || busy || loadingPreview || !data?.sample.length
                }
                type="submit"
              >
                {busy
                  ? "Importing"
                  : mode === "sandbox"
                    ? "Run in sandbox"
                    : `Import ${(data?.fresh ?? 0) + (data?.existing ?? 0)} contacts`}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-lg font-semibold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
