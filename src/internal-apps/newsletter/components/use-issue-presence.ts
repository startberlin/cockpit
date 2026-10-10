"use client";

import { useEffect, useRef, useState } from "react";
import {
  createIssuePresenceActivity,
  createPresenceSessionIdentity,
  type IssuePresenceSnapshot,
  PRESENCE_HEARTBEAT_MS,
  parseIssuePresenceResponse,
} from "../lib/issue-presence";

interface UseIssuePresenceOptions {
  issueId: string;
  enabled: boolean;
  serializedDraft: string;
}

const IDLE: IssuePresenceSnapshot = {
  editors: [],
  checkedAt: null,
  status: "idle",
};
const REQUEST_TIMEOUT_MS = 8_000;

export function useIssuePresence({
  issueId,
  enabled,
  serializedDraft,
}: UseIssuePresenceOptions): IssuePresenceSnapshot {
  const [snapshot, setSnapshot] = useState<IssuePresenceSnapshot>(() => ({
    ...IDLE,
    status: enabled ? "checking" : "idle",
  }));
  const latestDraft = useRef(serializedDraft);
  const [activity] = useState(() =>
    createIssuePresenceActivity(serializedDraft),
  );

  useEffect(() => {
    latestDraft.current = serializedDraft;
    activity.observe(serializedDraft, Date.now());
  }, [activity, serializedDraft]);

  useEffect(() => {
    if (!enabled) {
      setSnapshot(IDLE);
      return;
    }

    // A resumed view owns a new registration. A late departure from an older
    // activation must not delete it, including during StrictMode effect replay.
    const identity = createPresenceSessionIdentity();
    activity.reset(latestDraft.current);
    const endpoint = `/api/newsletter/issues/${encodeURIComponent(issueId)}/presence`;
    let disposed = false;
    let active = false;
    let generation = 0;
    let pending = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let request: AbortController | null = null;

    function clearTimer() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    }

    async function heartbeat() {
      if (disposed || !active || pending) return;
      const editorSessionId = identity.current();
      if (!editorSessionId) return;
      pending = true;
      const requestGeneration = generation;
      const controller = new AbortController();
      request = controller;
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            editorSessionId,
            isChanging: activity.isChanging(Date.now()),
          }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Presence check failed.");
        const result = parseIssuePresenceResponse(await response.json());
        if (!disposed && active && generation === requestGeneration)
          setSnapshot({ ...result, status: "ready" });
      } catch {
        if (!disposed && active && generation === requestGeneration)
          setSnapshot((previous) => ({ ...previous, status: "error" }));
      } finally {
        clearTimeout(timeout);
        pending = false;
        if (request === controller) request = null;
        if (!disposed && active) {
          // Resuming while a canceled request settles gets an immediate check.
          if (generation !== requestGeneration) void heartbeat();
          else
            timer = setTimeout(() => void heartbeat(), PRESENCE_HEARTBEAT_MS);
        }
      }
    }

    function resume() {
      if (disposed || active || document.visibilityState === "hidden") return;
      active = true;
      identity.activate();
      generation += 1;
      clearTimer();
      setSnapshot((previous) => ({ ...previous, status: "checking" }));
      void heartbeat();
    }

    function release() {
      if (!active) return;
      const editorSessionId = identity.release();
      active = false;
      generation += 1;
      clearTimer();
      request?.abort();
      if (!editorSessionId) return;
      // keepalive lets a departure reach the server during navigation. An
      // unavailable request expires through the server's presence TTL.
      void fetch(endpoint, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editorSessionId }),
        keepalive: true,
      }).catch(() => {});
    }

    function visibilityChanged() {
      if (document.visibilityState === "hidden") release();
      else resume();
    }

    document.addEventListener("visibilitychange", visibilityChanged);
    window.addEventListener("pagehide", release);
    window.addEventListener("pageshow", resume);
    resume();

    return () => {
      disposed = true;
      release();
      clearTimer();
      document.removeEventListener("visibilitychange", visibilityChanged);
      window.removeEventListener("pagehide", release);
      window.removeEventListener("pageshow", resume);
    };
  }, [activity, enabled, issueId]);

  return enabled ? snapshot : IDLE;
}
