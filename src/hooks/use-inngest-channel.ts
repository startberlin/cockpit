"use client";

import type { Realtime } from "inngest/realtime";
import { subscribe } from "inngest/realtime";
import { useEffect, useRef } from "react";

interface UseInngestChannelOptions {
  channel: Realtime.ChannelInput;
  topics: readonly string[];
  getToken: () => Promise<{ key: string; apiBaseUrl?: string }>;
  onMessage: () => void;
  enabled?: boolean;
}

export function useInngestChannel({
  channel,
  topics,
  getToken,
  onMessage,
  enabled = true,
}: UseInngestChannelOptions): void {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  // Capture channel/topics via refs so their identity doesn't drive
  // re-subscription — they're stable per-mount (derived from fixed prop IDs).
  const channelRef = useRef(channel);
  const topicsRef = useRef(topics);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let sub: { close?: (reason?: string) => void } | undefined;

    (async () => {
      const token = await getToken();
      if (cancelled) return;

      sub = await subscribe({
        channel: channelRef.current,
        topics: [...topicsRef.current],
        key: token.key,
        apiBaseUrl: token.apiBaseUrl,
        onMessage: () => {
          if (!cancelled) onMessageRef.current();
        },
      });
    })();

    return () => {
      cancelled = true;
      sub?.close?.("unmount");
    };
  }, [enabled, getToken]);
}
