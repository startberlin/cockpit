"use client";

import { ExternalLink, Loader2, Monitor, Smartphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  HTML_SIZE_WARNING_BYTES,
  isExactHtmlByteCount,
} from "../lib/email-size";
import { EmailSizeIndicator, EmailSizeWarning } from "./email-size-indicator";

/** The email keeps its real 600px or 375px layout. A narrow pane scales the
 * whole frame to fit; it never changes the email's line wrapping. */

const DEVICE_WIDTHS = { desktop: 600, mobile: 375 } as const;
type Device = keyof typeof DEVICE_WIDTHS;

export function PreviewPane({
  html,
  htmlBytes,
  isRendering,
  standaloneHref,
}: {
  html: string;
  htmlBytes: number | null;
  isRendering: boolean;
  standaloneHref?: string;
}) {
  const [device, setDevice] = useState<Device>("desktop");
  const frameWidth = DEVICE_WIDTHS[device];
  const frameRef = useRef<HTMLIFrameElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(640);
  const scale = Math.min(1, Math.max(0.25, (viewportWidth - 32) / frameWidth));
  const showSizeWarning =
    !isRendering &&
    isExactHtmlByteCount(htmlBytes) &&
    htmlBytes >= HTML_SIZE_WARNING_BYTES;
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0)
        setViewportWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /**
   * The first non-empty render, used as the frame's `srcDoc`.
   *
   * Latched in a ref rather than state because it must be available during the
   * render that first mounts the frame. Recomputing it is idempotent, so a
   * discarded render simply latches the same value.
   */
  const initialHtmlRef = useRef<string | null>(null);
  if (initialHtmlRef.current === null && html) initialHtmlRef.current = html;
  const initialHtml = initialHtmlRef.current ?? "";
  const appliedHtml = useRef(initialHtml);

  /**
   * Applies later renders by writing into the existing document.
   *
   * `srcDoc` handles the first paint, but changing it on every update reloads
   * the frame — which throws the reader back to the top of the email and flashes
   * white on every keystroke. Since the author is usually editing a section
   * halfway down, that makes the live preview actively unpleasant. Writing the
   * document in place and restoring `scrollTop` keeps the view where they left
   * it. React never touches `srcDoc` again, so it cannot fight this.
   */
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !html || html === appliedHtml.current) return;

    const doc = frame.contentDocument;
    if (!doc) return;
    appliedHtml.current = html;

    const previousScroll =
      doc.documentElement.scrollTop || doc.body?.scrollTop || 0;

    doc.open();
    doc.write(html);
    doc.close();

    if (previousScroll > 0) {
      // After `document.close()` the new document still has to lay out before
      // it has a scrollable height to restore into.
      requestAnimationFrame(() => {
        const fresh = frame.contentDocument;
        if (!fresh) return;
        fresh.documentElement.scrollTop = previousScroll;
        if (fresh.body) fresh.body.scrollTop = previousScroll;
      });
    }
    // `device` is not a dependency: switching width changes the wrapper, not
    // the frame, so the document it holds does not need rewriting.
  }, [html]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-muted">
      <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b bg-background px-3 py-2">
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xs font-semibold">Email preview</span>
          {isRendering ? (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          ) : null}
          <span className="ml-1 text-xs text-muted-foreground tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <EmailSizeIndicator htmlBytes={htmlBytes} isRendering={isRendering} />
        </div>

        <div className="ml-auto flex items-center gap-1">
          {standaloneHref ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" asChild>
                  <a
                    href={standaloneHref}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open preview in a new tab"
                  >
                    <ExternalLink />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open in a new tab</TooltipContent>
            </Tooltip>
          ) : null}
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={device}
            onValueChange={(value) => {
              if (value === "desktop" || value === "mobile") setDevice(value);
            }}
          >
            <ToggleGroupItem value="desktop" aria-label="Desktop width">
              <Monitor />
            </ToggleGroupItem>
            <ToggleGroupItem value="mobile" aria-label="Phone width">
              <Smartphone />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {showSizeWarning ? (
        <div className="shrink-0 border-b bg-background px-3 py-2">
          <EmailSizeWarning htmlBytes={htmlBytes} isRendering={isRendering} />
        </div>
      ) : null}
      <div
        ref={viewportRef}
        className="relative min-h-0 flex-1 overflow-hidden p-4"
      >
        <div
          className="mx-auto h-full overflow-hidden border bg-white shadow-sm"
          style={{ width: frameWidth * scale }}
        >
          {html ? (
            <iframe
              ref={frameRef}
              title="Newsletter preview"
              sandbox="allow-same-origin"
              srcDoc={initialHtml}
              style={{
                width: frameWidth,
                height: `${100 / scale}%`,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
              className="block border-0 bg-white"
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
              {isRendering
                ? "Rendering"
                : "Your newsletter will appear here as you write."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
