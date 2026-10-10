"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import type { z } from "zod";
import { updateIssueAction } from "../actions/issues";
import type { updateIssueSchema } from "../actions/schemas";
import { parseError } from "../lib/error";
import { createRevisionedSaveQueue } from "../lib/save-queue";

type Draft = Omit<z.input<typeof updateIssueSchema>, "expectedUpdatedAt">;
type QueuedDraft = { draft: Draft; force: boolean };
export type SaveState = "idle" | "saving" | "saved" | "error" | "conflict";

class IssueSaveConflictError extends Error {}

export function useIssueAutosave(
  draft: Draft,
  editable: boolean,
  initialRevision: string,
  pendingUploads = 0,
) {
  const router = useRouter();
  const [state, setState] = useState<SaveState>("idle");
  const latest = useRef(draft);
  const uploads = useRef(pendingUploads);
  const saved = useRef(JSON.stringify(draft));
  const pendingWrites = useRef(0);
  const revision = useRef(initialRevision);
  const conflict = useRef<IssueSaveConflictError | null>(null);
  const conflictNotified = useRef(false);
  const [write] = useState(() =>
    createRevisionedSaveQueue<QueuedDraft>(
      initialRevision,
      async ({ draft: payload, force }, expectedRevision) => {
        if (conflict.current) throw conflict.current;
        const serialized = JSON.stringify(payload);
        if (!force && serialized === saved.current) return expectedRevision;
        const result = await updateIssueAction({
          ...payload,
          expectedUpdatedAt: expectedRevision,
        });
        if (!result?.data) throw new Error(parseError(result));
        if (result.data.conflict) {
          conflict.current = new IssueSaveConflictError(result.data.message);
          throw conflict.current;
        }
        saved.current = serialized;
        revision.current = result.data.savedAt;
        return result.data.savedAt;
      },
    ),
  );

  const persist = useCallback(
    async (payload: Draft, force = false): Promise<boolean> => {
      if (conflict.current) return false;
      pendingWrites.current += 1;
      setState("saving");
      try {
        await write({ draft: payload, force });
        if (JSON.stringify(latest.current) === saved.current) setState("saved");
        return true;
      } catch (error) {
        if (error instanceof IssueSaveConflictError) {
          setState("conflict");
          if (!conflictNotified.current) {
            conflictNotified.current = true;
            toast.error(error.message);
          }
          return false;
        }
        setState("error");
        toast.error(`Not saved: ${parseError(error)}`);
        return false;
      } finally {
        pendingWrites.current -= 1;
      }
    },
    [write],
  );

  const queue = useDebouncedCallback(persist, 1200);
  const getRevision = useCallback(
    () => (editable ? revision.current : initialRevision),
    [editable, initialRevision],
  );
  const flush = useCallback(async () => {
    if (!editable) return true;
    while (true) {
      queue.cancel();
      if (uploads.current) {
        toast.error("Wait for the image uploads to finish.");
        return false;
      }
      // Validate even an unchanged local draft before sending or requesting AI
      // suggestions, so another editor's version cannot be used unexpectedly.
      if (!(await persist(latest.current, true))) return false;
      if (!uploads.current && JSON.stringify(latest.current) === saved.current)
        return true;
      // A new edit made during the request must also reach the server before
      // the caller can send, duplicate or leave this issue.
    }
  }, [editable, persist, queue]);

  useEffect(() => {
    latest.current = draft;
    uploads.current = pendingUploads;
    if (!editable || conflict.current) return;
    if (JSON.stringify(draft) === saved.current) {
      queue.cancel();
      // Reverting while a write is already in flight still needs a following
      // write, otherwise that older edit could overwrite the restored content.
      if (pendingWrites.current > 0) void persist(draft);
      else setState((previous) => (previous === "idle" ? "idle" : "saved"));
      return;
    }
    setState("saving");
    queue(draft);
  }, [draft, editable, pendingUploads, queue, persist]);

  useEffect(
    () => () => {
      queue.flush();
    },
    [queue],
  );

  useEffect(() => {
    if (!editable) return;
    const dirty = () =>
      pendingUploads > 0 ||
      pendingWrites.current > 0 ||
      JSON.stringify(latest.current) !== saved.current;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void flush();
      }
    };
    const navigate = (event: MouseEvent) => {
      if (
        !dirty() ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.target ||
        anchor.hasAttribute("download") ||
        anchor.closest('[contenteditable="true"]')
      )
        return;
      const url = new URL(anchor.href);
      if (
        url.origin !== window.location.origin ||
        url.pathname === window.location.pathname
      )
        return;
      event.preventDefault();
      if (pendingUploads) {
        toast.error("Wait for the image uploads to finish.");
        return;
      }
      void flush().then((ok) => {
        if (ok) router.push(`${url.pathname}${url.search}${url.hash}`);
      });
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("keydown", keydown);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("click", navigate, true);
    };
  }, [editable, flush, pendingUploads, router]);

  return { state, flush, getRevision };
}
