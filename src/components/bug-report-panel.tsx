"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BugIcon,
  CameraIcon,
  CircleCheck,
  DatabaseIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  LightbulbIcon,
  MessageSquareIcon,
  MessageSquareMoreIcon,
  SendIcon,
  XIcon,
} from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import posthog from "posthog-js";
import * as React from "react";
import { toast } from "sonner";
import { submitFeedbackAction } from "@/components/submit-feedback-action";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Category definitions
// ---------------------------------------------------------------------------

const CATEGORIES = [
  {
    value: "bug" as const,
    label: "Something is broken",
    description: "A button, table, or page is not behaving the way it should.",
    icon: BugIcon,
  },
  {
    value: "visual" as const,
    label: "Visual issue",
    description: "Layout, text, or styling looks wrong or out of place.",
    icon: LayoutDashboardIcon,
  },
  {
    value: "data" as const,
    label: "Wrong data",
    description: "Information shown is missing, outdated, or incorrect.",
    icon: DatabaseIcon,
  },
  {
    value: "account" as const,
    label: "Account or access",
    description: "Sign-in, permissions, or membership status is off.",
    icon: KeyRoundIcon,
  },
  {
    value: "suggestion" as const,
    label: "Suggestion",
    description: "An idea for how Cockpit could work better.",
    icon: LightbulbIcon,
  },
  {
    value: "other" as const,
    label: "Something else",
    description: "None of the above quite fits.",
    icon: MessageSquareMoreIcon,
  },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];
type Step = "category" | "details" | "submitted";

const STEP_LABELS = ["Category", "Details"] as const;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CategoryStep({
  value,
  onChange,
}: {
  value: Category | null;
  onChange: (c: Category) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const selected = value === cat.value;
        return (
          <button
            key={cat.value}
            type="button"
            onClick={() => onChange(cat.value)}
            className={cn(
              "flex cursor-pointer items-start gap-3 border p-3 text-left transition-colors",
              selected
                ? "border-foreground bg-accent"
                : "border-border bg-background hover:bg-muted",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex size-8 shrink-0 items-center justify-center",
                selected
                  ? "bg-foreground text-background"
                  : "bg-muted text-foreground",
              )}
            >
              <Icon className="size-4" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-semibold">{cat.label}</span>
              <span className="text-xs leading-snug text-muted-foreground">
                {cat.description}
              </span>
            </span>
            <span
              className={cn(
                "relative mt-2 flex size-4 shrink-0 items-center justify-center rounded-full border",
                selected ? "border-foreground bg-foreground" : "border-border",
              )}
            >
              {selected && (
                <span className="size-2 rounded-full bg-background" />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function DetailsStep({
  category,
  description,
  onDescriptionChange,
  screenshotDataUrl,
  onCaptureScreenshot,
  isCapturing,
  onRemoveScreenshot,
}: {
  category: (typeof CATEGORIES)[number];
  description: string;
  onDescriptionChange: (v: string) => void;
  screenshotDataUrl: string | null;
  onCaptureScreenshot: () => void;
  isCapturing: boolean;
  onRemoveScreenshot: () => void;
}) {
  const Icon = category.icon;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5 border border-border bg-muted px-3 py-2.5">
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Category</span>
        <span className="text-sm font-semibold">{category.label}</span>
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="bug-description"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          What happened
        </label>
        <Textarea
          id="bug-description"
          autoFocus
          placeholder="Describe the issue. If it's a bug, include the steps you took right before it happened."
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          className="min-h-36 resize-none"
        />
        <p className="text-xs text-muted-foreground">
          We follow up by email if we need more detail.
        </p>
      </div>

      {screenshotDataUrl ? (
        <div className="relative">
          {/* biome-ignore lint/performance/noImgElement: screenshot is a base64 data URL, next/image does not support it */}
          <img
            src={screenshotDataUrl}
            alt="Screenshot"
            className="w-full rounded-sm border object-cover"
            style={{ maxHeight: 160 }}
          />
          <button
            type="button"
            onClick={onRemoveScreenshot}
            aria-label="Remove screenshot"
            className="absolute top-1.5 right-1.5 flex size-5 cursor-pointer items-center justify-center rounded-sm bg-background/90 text-foreground shadow-sm hover:bg-muted"
          >
            <XIcon className="size-3" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={onCaptureScreenshot}
          disabled={isCapturing}
        >
          {isCapturing ? <Spinner /> : <CameraIcon className="size-4" />}
          {isCapturing ? "Capturing…" : "Attach screenshot"}
        </Button>
      )}
    </div>
  );
}

function SuccessStep({ progress }: { progress: number }) {
  return (
    <div className="flex flex-col items-center gap-5 px-6 py-10 text-center">
      <div className="flex size-14 items-center justify-center rounded-full border border-success/30 bg-success/10 text-success">
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div className="flex max-w-xs flex-col gap-1.5">
        <p className="text-lg font-bold">Thanks, your report was sent</p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The operations team will follow up by email if we need more detail.
        </p>
      </div>
      <div className="relative h-0.5 w-full max-w-[280px] overflow-hidden bg-border">
        <div
          className="absolute inset-0 bg-foreground"
          style={{
            width: `${progress}%`,
            transition: "width 60ms linear",
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        This closes automatically.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function BugReportButton() {
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<Step>("category");
  const [category, setCategory] = React.useState<Category | null>(null);
  const [description, setDescription] = React.useState("");
  const [screenshotDataUrl, setScreenshotDataUrl] = React.useState<
    string | null
  >(null);
  const [isCapturing, setIsCapturing] = React.useState(false);
  const [progress, setProgress] = React.useState(100);

  const { execute, isPending } = useAction(submitFeedbackAction, {
    onSuccess: () => {
      if (category) {
        posthog.capture("bug_report_submitted", { category });
      }
      setStep("submitted");
    },
    onError: ({ error }) => {
      toast.error(
        error.serverError ??
          "Could not send your report. Please try again in a moment.",
      );
    },
  });

  const reset = () => {
    setStep("category");
    setCategory(null);
    setDescription("");
    setScreenshotDataUrl(null);
    setProgress(100);
  };

  const handleOpen = (value: boolean) => {
    setOpen(value);
    if (!value) reset();
  };

  const handleSubmit = () => {
    if (!category || !description.trim()) return;
    execute({
      category,
      description: description.trim(),
      pageUrl: typeof window !== "undefined" ? window.location.href : null,
      sessionId:
        typeof window !== "undefined"
          ? (posthog.get_session_id() ?? null)
          : null,
      sessionReplayUrl:
        typeof window !== "undefined"
          ? (posthog.get_session_replay_url() ?? null)
          : null,
      screenshotBase64: screenshotDataUrl,
    });
  };

  const captureScreenshot = async () => {
    setIsCapturing(true);
    setOpen(false);
    await new Promise<void>((resolve) => setTimeout(resolve, 300));
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        scale: 1,
        logging: false,
      });
      setScreenshotDataUrl(canvas.toDataURL("image/png"));
    } catch {
      toast.error("Couldn't capture screenshot. Please try again.");
    } finally {
      setIsCapturing(false);
      setOpen(true);
    }
  };

  React.useEffect(() => {
    if (step !== "submitted") return;
    const start = Date.now();
    const duration = 3000;
    let raf: number;
    const tick = () => {
      const elapsed = Date.now() - start;
      const next = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(next);
      if (elapsed >= duration) {
        setOpen(false);
      } else {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  const activeCat = CATEGORIES.find((c) => c.value === category) ?? null;
  const stepIndex = step === "category" ? 0 : 1;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => setOpen(true)}
        aria-label="Report an issue"
      >
        <MessageSquareIcon className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
          {step !== "submitted" && (
            <DialogHeader className="gap-3 border-b px-6 pt-6 pb-5">
              <Breadcrumb>
                <BreadcrumbList>
                  {STEP_LABELS.map((label, i) => {
                    const isActive = i === stepIndex;
                    const isCompleted = i < stepIndex;
                    return (
                      <React.Fragment key={label}>
                        {i > 0 && <BreadcrumbSeparator />}
                        <BreadcrumbItem
                          className={cn(
                            "rounded px-1.5 py-0.5",
                            isActive && "bg-muted",
                          )}
                        >
                          <BreadcrumbPage
                            className={cn(
                              "flex items-center gap-1",
                              !isActive &&
                                !isCompleted &&
                                "text-muted-foreground",
                            )}
                          >
                            {isCompleted && (
                              <CircleCheck className="size-4 fill-success text-primary-foreground" />
                            )}
                            {label}
                          </BreadcrumbPage>
                        </BreadcrumbItem>
                      </React.Fragment>
                    );
                  })}
                </BreadcrumbList>
              </Breadcrumb>
              <div className="flex flex-col gap-1">
                <DialogTitle>
                  {step === "category"
                    ? "Report an issue"
                    : "Tell us what happened"}
                </DialogTitle>
                <DialogDescription>
                  {step === "category"
                    ? "Pick the option that best matches what you ran into."
                    : "Describe the issue in as much detail as you can."}
                </DialogDescription>
              </div>
            </DialogHeader>
          )}

          <div className={cn("overflow-y-auto", step !== "submitted" && "p-6")}>
            {step === "category" && (
              <CategoryStep value={category} onChange={setCategory} />
            )}
            {step === "details" && activeCat && (
              <DetailsStep
                category={activeCat}
                description={description}
                onDescriptionChange={setDescription}
                screenshotDataUrl={screenshotDataUrl}
                onCaptureScreenshot={captureScreenshot}
                isCapturing={isCapturing}
                onRemoveScreenshot={() => setScreenshotDataUrl(null)}
              />
            )}
            {step === "submitted" && <SuccessStep progress={progress} />}
          </div>

          {step !== "submitted" && (
            <div className="flex items-center justify-end gap-2 border-t bg-muted/40 px-6 py-4">
              {step === "category" ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={!category}
                    onClick={() => setStep("details")}
                  >
                    Continue
                    <ArrowRightIcon className="size-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => setStep("category")}
                  >
                    <ArrowLeftIcon className="size-4" />
                    Back
                  </Button>
                  <Button
                    size="sm"
                    disabled={!description.trim() || isPending}
                    onClick={handleSubmit}
                  >
                    {isPending ? <Spinner /> : <SendIcon className="size-4" />}
                    {isPending ? "Sending…" : "Send report"}
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
