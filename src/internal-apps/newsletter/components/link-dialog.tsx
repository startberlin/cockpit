"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Editor } from "@tiptap/core";
import { Link2 } from "lucide-react";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const linkSchema = z.object({
  url: z
    .string()
    .trim()
    .pipe(
      z.union([
        z.literal(""),
        z
          .url("Enter a full URL, such as https://example.com.")
          .refine(
            (value) =>
              ["https:", "http:", "mailto:", "tel:"].includes(
                new URL(value).protocol,
              ),
            "Use an HTTP, HTTPS, email or telephone link.",
          ),
      ]),
    ),
});

export function LinkDialog({
  editor,
  active,
  disabled,
}: {
  editor: Editor;
  active: boolean;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const inputId = useId();
  const form = useForm<z.input<typeof linkSchema>>({
    resolver: zodResolver(linkSchema),
    defaultValues: { url: "" },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (value)
          form.reset({
            url: String(editor.getAttributes("link").href ?? "https://"),
          });
        setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Add link"
          aria-pressed={active}
          disabled={disabled}
          className={cn(active && "bg-accent text-accent-foreground")}
        >
          <Link2 />
        </Button>
      </DialogTrigger>
      <DialogContent className="grid-cols-1">
        <DialogHeader>
          <DialogTitle>Edit link</DialogTitle>
          <DialogDescription>
            Add a URL to the selected text. Leave it empty to remove the link.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex min-w-0 flex-col gap-4"
          onSubmit={form.handleSubmit(({ url }) => {
            if (disabled || !editor.isEditable) return;
            // ProseMirror keeps the selection while the dialog has focus.
            const chain = editor.chain().focus().extendMarkRange("link");
            if (url) chain.setLink({ href: url }).run();
            else chain.unsetLink().run();
            setOpen(false);
          })}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={inputId}>Link URL</Label>
            <Input
              id={inputId}
              {...form.register("url")}
              placeholder="https://example.com"
              aria-invalid={!!form.formState.errors.url}
            />
            {form.formState.errors.url ? (
              <p role="alert" className="text-sm text-destructive">
                {form.formState.errors.url.message}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={disabled}>
              Apply link
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
