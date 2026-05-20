"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type HidableGroupContextValue = {
  report: (id: string, visible: boolean) => void;
};

export const HidableGroupContext =
  createContext<HidableGroupContextValue | null>(null);

export function useHidableGroupContext() {
  return useContext(HidableGroupContext);
}

export function useHidableGroupState() {
  const [visibleIds, setVisibleIds] = useState<ReadonlySet<string>>(new Set());

  const report = useCallback((id: string, visible: boolean) => {
    setVisibleIds((prev) => {
      if (visible === prev.has(id)) return prev;
      const next = new Set(prev);
      if (visible) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const contextValue = useMemo(() => ({ report }), [report]);

  return { hasVisible: visibleIds.size > 0, contextValue };
}
