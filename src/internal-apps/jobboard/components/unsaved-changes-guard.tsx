"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BEFORE_ROUTER_POPSTATE,
  leavesCurrentDocument,
} from "../lib/navigation-intent";

type Destination = { href: string; historyKey?: string; legacyDelta?: number };

export function UnsavedChangesGuard({ dirty }: { dirty: boolean }) {
  const router = useRouter();
  const [destination, setDestination] = useState<Destination | null>(null);
  const approvedUnload = useRef(false);
  const approvedHistoryKey = useRef<string | null>(null);
  const approvedLegacyDelta = useRef<number | null>(null);
  const lastLink = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    if (!dirty) {
      setDestination(null);
      return;
    }
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (approvedUnload.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const linkClick = (event: MouseEvent) => {
      if (event.defaultPrevented || !(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (
        !link ||
        !leavesCurrentDocument(window.location.href, link.href, {
          button: event.button,
          modified:
            event.metaKey || event.ctrlKey || event.altKey || event.shiftKey,
          target: link.target,
          download: link.hasAttribute("download"),
        })
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      lastLink.current = link;
      setDestination({ href: link.href });
    };
    // A canceled Back event can leave WebKit's history cursor on the wrong
    // entry. Restore the original entry before opening the discard dialog.
    const navigation = window.navigation;
    type Traversal = { delta: number; target: Destination };
    let requested: Traversal | null = null;
    let restoring: Traversal | null = null;
    const rememberTraversal = (event: NavigateEvent) => {
      if (restoring || event.navigationType !== "traverse") return;
      requested = null;
      const from = navigation?.currentEntry;
      const { key, url, index, sameDocument } = event.destination;
      if (key && key === approvedHistoryKey.current) {
        approvedHistoryKey.current = null;
        return;
      }
      if (!from || !key || !url || !sameDocument || event.hashChange) return;
      const delta = index - from.index;
      if (delta !== 0)
        requested = { delta, target: { href: url, historyKey: key } };
    };
    const restoreEditor = (event: Event) => {
      const delta = (event as CustomEvent<number | null>).detail;
      if (!navigation && delta && !restoring) {
        if (delta === approvedLegacyDelta.current) {
          approvedLegacyDelta.current = null;
          return;
        }
        requested = {
          delta,
          target: { href: window.location.href, legacyDelta: delta },
        };
      }
      if (restoring) {
        event.preventDefault();
        lastLink.current = null;
        setDestination(restoring.target);
        restoring = null;
      } else if (requested) {
        // Keep Next's router on the edited document during the round trip.
        event.preventDefault();
        const move = requested;
        restoring = move;
        requested = null;
        window.setTimeout(() => {
          if (restoring === move) window.history.go(-move.delta);
        }, 0);
      }
    };
    navigation?.addEventListener("navigate", rememberTraversal);
    window.addEventListener(BEFORE_ROUTER_POPSTATE, restoreEditor);
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", linkClick, true);
    return () => {
      restoring = null;
      navigation?.removeEventListener("navigate", rememberTraversal);
      window.removeEventListener(BEFORE_ROUTER_POPSTATE, restoreEditor);
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", linkClick, true);
    };
  }, [dirty]);

  return (
    <AlertDialog
      open={dirty && destination !== null}
      onOpenChange={(open) => {
        if (!open) setDestination(null);
      }}
    >
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (lastLink.current?.isConnected) lastLink.current.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
          <AlertDialogDescription>
            Your latest edits have not been saved. Stay here to keep editing, or
            discard them and leave this page.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              if (!destination) return;
              setDestination(null);
              if (destination.legacyDelta) {
                approvedLegacyDelta.current = destination.legacyDelta;
                window.history.go(destination.legacyDelta);
                return;
              }
              if (destination.historyKey) {
                const navigation = window.navigation;
                const from = navigation?.currentEntry;
                const to = navigation
                  ?.entries()
                  .find((entry) => entry.key === destination.historyKey);
                if (from && to) {
                  approvedHistoryKey.current = to.key;
                  window.history.go(to.index - from.index);
                  return;
                }
              }
              const target = new URL(destination.href);
              if (target.origin === window.location.origin) {
                router.push(target.href);
              } else {
                approvedUnload.current = true;
                window.location.assign(target.href);
              }
            }}
          >
            Discard changes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
