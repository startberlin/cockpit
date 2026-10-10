"use client";

import {
  ArrowLeft,
  Check,
  Cloud,
  FlaskConical,
  Loader2,
  Mail,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { renderPreviewAction } from "../actions/issues";
import type { IssueDetail } from "../db/queries";
import type { Block } from "../lib/blocks";
import { parseError } from "../lib/error";
import { DocumentEditor } from "./document-editor";
import { IssueActions, type SendingOption } from "./issue-actions";
import { IssuePresenceNotice } from "./issue-presence-notice";
import { IssueStatusBadge } from "./issue-status-badge";
import { PreviewPane } from "./preview-pane";
import {
  SuggestPreviewTextButton,
  SuggestSubjectButton,
} from "./suggest-button";
import { type SaveState, useIssueAutosave } from "./use-issue-autosave";
import { useIssuePresence } from "./use-issue-presence";

/**
 * Starting split, as flex-grow weights.
 *
 * Set on the group rather than as `defaultSize` on each panel: the two are
 * competing ways to say the same thing and the per-panel value wins.
 *
 * The split is not remembered between visits. `onLayoutChanged` does fire and
 * the value stores fine, but neither `defaultLayout` nor the group's
 * `setLayout()` handle would apply it on the way back in, and chasing that
 * through the library's internals was not worth it for a comfort feature —
 * better an honest default than code that looks like it remembers and does not.
 */
const DEFAULT_LAYOUT = { editor: 55, preview: 45 };

/** Rendering is a server round trip through React Email; this keeps it off the
 * critical path of typing without feeling stale. */
const PREVIEW_DELAY_MS = 700;
const SAVE_LABELS: Record<SaveState, string> = {
  idle: "All changes saved",
  saving: "Saving",
  saved: "Saved",
  error: "Not saved",
  conflict: "Not saved",
};

export function IssueComposer({
  issue,
  editable,
  aiEnabled,
  mode,
  defaultTestRecipient,
  initialPreviewHtml,
  initialPreviewHtmlBytes,
  segments,
  topics,
  defaultFrom,
  currentUserId,
}: {
  issue: IssueDetail;
  editable: boolean;
  aiEnabled: boolean;
  mode: "sandbox" | "live";
  defaultTestRecipient: string;
  /**
   * The issue rendered on the server for this page load. Without it the preview
   * pane sits empty for the first second while the client round-trips a render
   * it could simply have been handed.
   */
  initialPreviewHtml: string;
  initialPreviewHtmlBytes: number;
  segments: SendingOption[];
  topics: SendingOption[];
  defaultFrom: string;
  currentUserId: string;
}) {
  const [name, setName] = useState(issue.name);
  const [subject, setSubject] = useState(issue.subject);
  const [previewText, setPreviewText] = useState(issue.previewText);
  const [blocks, setBlocks] = useState<Block[]>(issue.blocks);
  const [preview, setPreview] = useState(() => ({
    html: initialPreviewHtml,
    htmlBytes: initialPreviewHtmlBytes as number | null,
    source: JSON.stringify({
      subject: issue.subject,
      previewText: issue.previewText,
      blocks: issue.blocks,
    }),
  }));
  const previewSource = useMemo(
    () => JSON.stringify({ subject, previewText, blocks }),
    [subject, previewText, blocks],
  );
  const [isRendering, setIsRendering] = useState(false);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const [pane, setPane] = useState("editor");
  const [pendingUploads, setPendingUploads] = useState(0);
  const draft = useMemo(
    () => ({ id: issue.id, name, subject, previewText, blocks }),
    [issue.id, name, subject, previewText, blocks],
  );
  const serializedDraft = useMemo(() => JSON.stringify(draft), [draft]);
  const presence = useIssuePresence({
    issueId: issue.id,
    enabled: editable,
    serializedDraft,
  });
  const {
    state: saveState,
    flush: saveBeforeAction,
    getRevision,
  } = useIssueAutosave(
    draft,
    editable,
    issue.updatedAt.toISOString(),
    pendingUploads,
  );
  const previewVersion = useRef(0);
  const previewBaseline = useRef(
    JSON.stringify({
      subject: issue.subject,
      previewText: issue.previewText,
      blocks: issue.blocks,
    }),
  );
  const queuePreview = useDebouncedCallback(
    async (
      payload: { subject: string; previewText: string; blocks: Block[] },
      version: number,
    ) => {
      try {
        const result = await renderPreviewAction(payload);
        if (version !== previewVersion.current) return;
        if (!result?.data) throw new Error(parseError(result));
        setPreview({
          html: result.data.html,
          htmlBytes: result.data.htmlBytes,
          source: JSON.stringify(payload),
        });
      } catch (error) {
        if (version === previewVersion.current) {
          setPreview((previous) => ({ ...previous, htmlBytes: null }));
          toast.error(`Preview failed: ${parseError(error)}`);
        }
      } finally {
        if (version === previewVersion.current) setIsRendering(false);
      }
    },
    PREVIEW_DELAY_MS,
  );

  useEffect(() => {
    const serialized = JSON.stringify({ subject, previewText, blocks });
    if (serialized === previewBaseline.current) return;
    previewBaseline.current = serialized;
    // An older response must not replace the preview of a newer edit.
    previewVersion.current += 1;
    setIsRendering(true);
    queuePreview({ subject, previewText, blocks }, previewVersion.current);
  }, [subject, previewText, blocks, queuePreview]);
  useEffect(() => () => queuePreview.cancel(), [queuePreview]);

  const editorContent = (
    <DocumentEditor
      initialBlocks={issue.blocks}
      onChange={setBlocks}
      onPendingUploadsChange={setPendingUploads}
      editable={editable}
    >
      {saveState === "conflict" ? (
        <div
          role="alert"
          className="mb-6 border border-destructive/30 bg-destructive/5 p-3 text-sm"
        >
          <p className="font-medium">This issue changed in another editor.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your local edits are still here. Copy or download your draft, then
            reload the issue before saving.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => window.location.reload()}
          >
            Reload issue
          </Button>
        </div>
      ) : null}
      {issue.lastError ? (
        <div
          role="alert"
          className="mb-6 border border-destructive/30 bg-destructive/5 p-3 text-sm"
        >
          <p className="font-medium">The last send attempt failed</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {issue.lastError}
          </p>
        </div>
      ) : null}
      <section
        className="document-email-details"
        aria-labelledby="email-details-heading"
      >
        <div className="mb-5 flex items-start gap-3">
          <div
            className="flex size-9 shrink-0 items-center justify-center border bg-background text-muted-foreground"
            aria-hidden="true"
          >
            <Mail className="size-4" />
          </div>
          <div>
            <h2
              id="email-details-heading"
              className="text-sm font-semibold text-foreground"
            >
              Email details
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              What readers see before opening your email.
            </p>
          </div>
        </div>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label
                htmlFor="issue-subject"
                className="text-[13px] font-semibold text-foreground"
              >
                Subject line
              </Label>
              <div className="flex items-center gap-1">
                <CharCount value={subject} limit={60} />
                {aiEnabled && editable ? (
                  <SuggestSubjectButton
                    issueId={issue.id}
                    onPick={setSubject}
                    beforeSuggest={saveBeforeAction}
                  />
                ) : null}
              </div>
            </div>
            <Input
              id="issue-subject"
              maxLength={200}
              value={subject}
              disabled={!editable}
              placeholder="Enter the email subject"
              onChange={(event) => setSubject(event.target.value)}
              className="document-email-input"
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label
                htmlFor="issue-preview"
                className="text-[13px] font-semibold text-foreground"
              >
                Preview text{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <div className="flex items-center gap-1">
                <CharCount value={previewText} limit={90} />
                {aiEnabled && editable ? (
                  <SuggestPreviewTextButton
                    issueId={issue.id}
                    subject={subject}
                    onPick={setPreviewText}
                    beforeSuggest={saveBeforeAction}
                  />
                ) : null}
              </div>
            </div>
            <Input
              id="issue-preview"
              maxLength={200}
              value={previewText}
              disabled={!editable}
              aria-describedby="issue-preview-hint"
              placeholder="Add a short preview for the inbox"
              onChange={(event) => setPreviewText(event.target.value)}
              className="document-email-input"
            />
            <p
              id="issue-preview-hint"
              className="text-[11px] leading-4 text-muted-foreground"
            >
              Shown next to the subject in the inbox.
            </p>
          </div>
        </div>
      </section>
    </DocumentEditor>
  );
  const previewContent = (
    <PreviewPane
      html={preview.html}
      htmlBytes={preview.source === previewSource ? preview.htmlBytes : null}
      isRendering={isRendering}
      standaloneHref={`/newsletter/issues/${issue.id}/preview`}
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Toolbar */}
      <div className="flex min-h-16 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3">
        <Link
          href="/newsletter"
          aria-label="Back to all issues"
          className="flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </Link>

        {/* The title is the field you most want to fix in place, so it is an
            input that looks like a heading rather than a heading with an edit
            button hidden behind it. */}
        <input
          value={name}
          disabled={!editable}
          aria-label="Issue name"
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          className={cn(
            "min-w-0 flex-1 basis-32 border border-transparent bg-transparent px-1 py-1 text-sm font-semibold outline-none",
            "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
            editable ? "hover:border-input" : "cursor-default",
          )}
        />

        {mode === "sandbox" ? (
          <span
            title="Test environment. Emails are not delivered."
            className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-800"
          >
            <FlaskConical className="size-3" />
            Sandbox
          </span>
        ) : null}
        <IssueStatusBadge
          status={issue.status}
          sandbox={issue.resendBroadcastId?.startsWith("sandbox_")}
        />
        <SaveIndicator
          state={pendingUploads ? "saving" : saveState}
          editable={editable}
        />
        {saveState === "error" && editable ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void saveBeforeAction()}
          >
            Retry save
          </Button>
        ) : null}

        <div className="ml-auto">
          <IssueActions
            issueId={issue.id}
            getRevision={getRevision}
            beforeAction={async () => {
              if (pendingUploads) {
                toast.error("Wait for the image uploads to finish.");
                return false;
              }
              return saveBeforeAction();
            }}
            status={issue.status}
            mode={mode}
            defaultTestRecipient={defaultTestRecipient}
            subject={subject}
            previewText={previewText}
            settings={{
              fromAddress: issue.fromAddress,
              replyTo: issue.replyTo,
              segmentId: issue.segmentId,
              topicId: issue.topicId,
            }}
            segments={segments}
            topics={topics}
            defaultFrom={defaultFrom}
          />
        </div>
      </div>

      {editable &&
      (presence.status !== "ready" || presence.editors.length > 0) ? (
        <div className="shrink-0 border-b px-4 py-2">
          <IssuePresenceNotice {...presence} currentUserId={currentUserId} />
        </div>
      ) : null}

      {compact ? (
        <ToggleGroup
          type="single"
          value={pane}
          onValueChange={(value) => {
            if (value) setPane(value);
          }}
          className="shrink-0 border-b p-1.5"
          aria-label="Composer view"
        >
          <ToggleGroupItem value="editor">Editor</ToggleGroupItem>
          <ToggleGroupItem value="preview">Preview</ToggleGroupItem>
        </ToggleGroup>
      ) : null}
      <ResizablePanelGroup
        id="newsletter-composer"
        data-compact={compact}
        data-pane={pane}
        orientation="horizontal"
        className="newsletter-composer min-h-0 flex-1"
        defaultLayout={DEFAULT_LAYOUT}
      >
        <ResizablePanel
          id="editor"
          minSize={compact ? 0 : "380px"}
          className="min-w-0"
        >
          {editorContent}
        </ResizablePanel>
        <ResizableHandle withHandle className={cn(compact && "hidden")} />
        <ResizablePanel
          id="preview"
          minSize={compact ? 0 : "300px"}
          className="min-w-0"
        >
          {previewContent}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

/**
 * Soft length guidance. Deliberately not a hard limit — a subject that runs a
 * few characters long is a judgement call, not an error — but inboxes truncate
 * and the author should be able to see it coming.
 */
function CharCount({ value, limit }: { value: string; limit: number }) {
  if (!value) return null;
  return (
    <span
      className={cn(
        "text-xs tabular-nums",
        value.length > limit ? "text-amber-600" : "text-muted-foreground",
      )}
    >
      {value.length}/{limit}
    </span>
  );
}

function SaveIndicator({
  state,
  editable,
}: {
  state: SaveState;
  editable: boolean;
}) {
  if (!editable) {
    return <span className="text-xs text-muted-foreground">Read-only</span>;
  }
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-1.5 text-[11px] text-muted-foreground",
        (state === "error" || state === "conflict") && "text-destructive",
      )}
    >
      {state === "saving" ? (
        <Loader2 className="size-3 animate-spin" />
      ) : state === "error" || state === "conflict" ? (
        <Cloud className="size-3" />
      ) : (
        <Check className="size-3 text-[#088196]" />
      )}
      {SAVE_LABELS[state]}
    </span>
  );
}
