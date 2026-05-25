"use client";

import { BugIcon } from "lucide-react";
import posthog from "posthog-js";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "ui", label: "UI / Layout" },
  { value: "data", label: "Wrong data" },
  { value: "access", label: "Access issue" },
  { value: "other", label: "Something else" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

export function BugReportButton() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleOpen = (value: boolean) => {
    setOpen(value);
    if (!value) {
      setCategory(null);
      setDescription("");
      setSubmitted(false);
    }
  };

  const handleSubmit = () => {
    posthog.capture("bug_report_submitted", {
      category,
      description: description.trim() || undefined,
    });
    setSubmitted(true);
    setTimeout(() => handleOpen(false), 1500);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => setOpen(true)}
        aria-label="Report a bug"
      >
        <BugIcon className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report a Bug</DialogTitle>
            <DialogDescription>
              Help us improve Cockpit. What kind of issue did you run into?
            </DialogDescription>
          </DialogHeader>

          {submitted ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Thanks for your report — we&apos;ll look into it.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setCategory(cat.value)}
                      className={cn(
                        "cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors",
                        category === cat.value
                          ? "border-foreground bg-foreground text-background"
                          : "border-input bg-background hover:bg-muted",
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
                <Textarea
                  placeholder="Describe what happened… (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
              </div>
              <DialogFooter>
                <Button onClick={handleSubmit} disabled={!category}>
                  Send report
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
