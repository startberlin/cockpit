"use client";

import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  LightbulbIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
} from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import posthog from "posthog-js";
import { useState } from "react";
import { toast } from "sonner";
import { submitFeedbackAction } from "@/components/submit-feedback-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

type Category = "issue" | "idea" | "other";

const CATEGORIES: {
  value: Category;
  label: string;
  icon: typeof AlertTriangleIcon;
  iconClass: string;
  title: string;
  placeholder: string;
}[] = [
  {
    value: "issue",
    label: "Issue",
    icon: AlertTriangleIcon,
    iconClass: "text-amber-500",
    title: "Report an issue",
    placeholder: "I noticed that…",
  },
  {
    value: "idea",
    label: "Idea",
    icon: LightbulbIcon,
    iconClass: "text-yellow-500",
    title: "Share an idea",
    placeholder: "I'd love to…",
  },
  {
    value: "other",
    label: "Other",
    icon: MoreHorizontalIcon,
    iconClass: "text-muted-foreground",
    title: "Send us a message",
    placeholder: "Tell us what's on your mind…",
  },
];

type Step = "category" | "describe" | "submitted";

export function BugReportButton() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("category");
  const [category, setCategory] = useState<Category | null>(null);
  const [description, setDescription] = useState("");

  const { execute, isPending } = useAction(submitFeedbackAction, {
    onSuccess: () => {
      if (category) {
        const trimmed = description.trim();
        posthog.capture("bug_report_submitted", {
          category,
          has_description: trimmed.length > 0,
          description_length: trimmed.length,
        });
      }
      setStep("submitted");
      setTimeout(() => handleOpen(false), 1500);
    },
    onError: ({ error }) => {
      toast.error(
        error.serverError ??
          "Could not send your feedback. Please try again in a moment.",
      );
    },
  });

  const reset = () => {
    setStep("category");
    setCategory(null);
    setDescription("");
  };

  const handleOpen = (value: boolean) => {
    setOpen(value);
    if (!value) reset();
  };

  const handlePick = (value: Category) => {
    setCategory(value);
    setStep("describe");
  };

  const active = CATEGORIES.find((c) => c.value === category);

  const handleSubmit = () => {
    if (!category || !description.trim()) return;
    execute({
      category,
      description: description.trim(),
      pageUrl: typeof window !== "undefined" ? window.location.href : null,
    });
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
      >
        <MessageSquareIcon className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="sm:max-w-md">
          {step === "category" && (
            <>
              <DialogTitle>What&apos;s on your mind?</DialogTitle>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => handlePick(cat.value)}
                      className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border bg-muted/40 px-3 py-5 text-sm font-medium transition-colors hover:bg-muted"
                    >
                      <Icon className={`size-6 ${cat.iconClass}`} />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === "describe" && active && (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep("category")}
                  aria-label="Back"
                  disabled={isPending}
                  className="-ml-1 cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  <ArrowLeftIcon className="size-4" />
                </button>
                <active.icon className={`size-4 ${active.iconClass}`} />
                <DialogTitle>{active.title}</DialogTitle>
              </div>
              <Textarea
                autoFocus
                placeholder={active.placeholder}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                disabled={isPending}
              />
              <Button
                onClick={handleSubmit}
                disabled={!description.trim() || isPending}
                className="w-full"
              >
                {isPending ? <Spinner /> : null}
                Send feedback
              </Button>
            </>
          )}

          {step === "submitted" && (
            <>
              <DialogTitle className="sr-only">Feedback sent</DialogTitle>
              <p className="py-6 text-center text-sm text-muted-foreground">
                Thanks for your feedback — we&apos;ll look into it.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
