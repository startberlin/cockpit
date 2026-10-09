"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ShareLink({ url }: { url: string }) {
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setMessage("Link copied");
    } catch {
      setCopied(false);
      setMessage("Copy the link above.");
    }
  }

  async function share() {
    if (!navigator.share) {
      await copy();
      return;
    }
    try {
      await navigator.share({ title: "Apply to START Berlin", url });
      setMessage("Link shared");
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "AbortError"
      )
        return;
      setMessage("Sharing failed. Copy the link instead.");
    }
  }

  return (
    <div className="space-y-3">
      <p className="break-all select-all border bg-muted/40 px-4 py-3 text-sm leading-relaxed">
        {url}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          size="lg"
          className="min-h-11 sm:flex-1"
          onClick={copy}
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? "Copied" : "Copy link"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-h-11 sm:flex-1"
          onClick={share}
        >
          <Share2 aria-hidden="true" /> Share
        </Button>
      </div>
      <p
        role="status"
        aria-live="polite"
        className="min-h-5 text-xs text-muted-foreground"
      >
        {message}
      </p>
    </div>
  );
}
