"use client";

import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  describeExactHtmlBytes,
  formatExactHtmlBytes,
  HTML_SIZE_WARNING_BYTES,
  isExactHtmlByteCount,
} from "../lib/email-size";

interface EmailSizeProps {
  htmlBytes: number | null;
  isRendering: boolean;
}

export function EmailSizeIndicator({ htmlBytes, isRendering }: EmailSizeProps) {
  if (isRendering || !isExactHtmlByteCount(htmlBytes))
    return (
      <span
        className="text-xs text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        {isRendering ? "Measuring HTML" : "HTML size unavailable"}
      </span>
    );

  const description = describeExactHtmlBytes(htmlBytes);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="flex min-h-7 items-center gap-1 rounded px-1 text-xs text-muted-foreground tabular-nums hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          aria-label={description}
        >
          HTML · {formatExactHtmlBytes(htmlBytes)}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-72">
        {description}
      </TooltipContent>
    </Tooltip>
  );
}

export function EmailSizeWarning({ htmlBytes, isRendering }: EmailSizeProps) {
  if (
    isRendering ||
    !isExactHtmlByteCount(htmlBytes) ||
    htmlBytes < HTML_SIZE_WARNING_BYTES
  )
    return null;

  return (
    <Alert
      className="border-amber-500/30 bg-amber-500/5 px-3 py-2 text-amber-900 dark:text-amber-200"
      role="status"
      aria-live="polite"
    >
      <AlertTriangle />
      <AlertTitle className="line-clamp-none text-xs">
        Large email HTML
      </AlertTitle>
      <AlertDescription className="text-xs text-amber-900/80 dark:text-amber-200/80">
        Gmail may clip large messages. This is the HTML before Resend tracking
        and personalization; the delivered size can differ.
      </AlertDescription>
    </Alert>
  );
}
