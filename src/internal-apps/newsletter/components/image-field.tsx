"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ImageRef } from "../lib/blocks";
import { uploadNewsletterImage } from "../lib/upload-image";
import { useUploadTracker } from "./upload-context";

interface ImageFieldProps {
  label: string;
  value: ImageRef | undefined;
  onChange: (value: ImageRef | undefined) => void;
}

export function ImageField({ label, value, onChange }: ImageFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const uploadingRef = useRef(false);
  const request = useRef<AbortController | null>(null);
  const current = useRef({ value, onChange });
  const uploads = useUploadTracker();
  useEffect(() => {
    current.current = { value, onChange };
  }, [value, onChange]);
  useEffect(() => () => request.current?.abort(), []);

  const upload = useCallback(
    async (file: File) => {
      if (uploadingRef.current || inputRef.current?.matches(":disabled"))
        return;
      uploadingRef.current = true;
      setUploading(true);
      const controller = new AbortController();
      request.current = controller;
      const finish = uploads?.begin();
      try {
        const image = await uploadNewsletterImage(file, {
          signal: controller.signal,
        });
        if (
          !controller.signal.aborted &&
          !inputRef.current?.matches(":disabled")
        )
          current.current.onChange({
            ...image,
            alt: current.current.value?.alt ?? "",
          });
      } catch (error) {
        if (!controller.signal.aborted)
          toast.error(
            error instanceof Error ? error.message : "Upload failed.",
          );
      } finally {
        finish?.();
        uploadingRef.current = false;
        request.current = null;
        if (!controller.signal.aborted) setUploading(false);
      }
    },
    [uploads],
  );

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={inputId}>{label}</Label>

      {value ? (
        <div className="flex items-start gap-3">
          {/* Deliberately a plain <img>: the source is a Blob URL or a local
              upload route, neither of which next/image is configured for, and
              this is an admin surface where the optimiser earns nothing. */}
          {/** biome-ignore lint/performance/noImgElement: see comment above */}
          <img
            src={value.url}
            alt={value.alt}
            width={112}
            height={80}
            className="h-20 w-28 shrink-0 border object-cover"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Input
              value={value.alt}
              aria-label={`${label} alt text`}
              disabled={uploading}
              placeholder="Alt text: what the image shows"
              onChange={(e) => onChange({ ...value, alt: e.target.value })}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                {uploading ? "Uploading" : "Replace"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={uploading}
                onClick={() => onChange(undefined)}
              >
                <X />
                Remove
              </Button>
              {value.width ? (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {value.width}×{value.height}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void upload(file);
          }}
          disabled={uploading}
          className={cn(
            "flex h-24 w-full flex-col items-center justify-center gap-1.5 border border-dashed text-sm text-muted-foreground transition-colors hover:bg-accent/50",
            dragging && "border-ring bg-accent/50",
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <ImagePlus className="size-4" />
              Drop an image or click to choose
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
