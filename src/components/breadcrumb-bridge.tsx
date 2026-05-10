"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Crumb } from "@/components/breadcrumb-view";

type BreadcrumbContextValue = {
  override: Crumb[] | null;
  setOverride: (crumbs: Crumb[] | null) => void;
};

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [override, setOverride] = useState<Crumb[] | null>(null);
  const value = useMemo(() => ({ override, setOverride }), [override]);
  return (
    <BreadcrumbContext.Provider value={value}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbOverride(): Crumb[] | null {
  return useContext(BreadcrumbContext)?.override ?? null;
}

/**
 * Server-rendered pages render this client component to publish a breadcrumb
 * chain into the topbar. Mounts → set; unmounts → clear, so navigating away
 * cleanly falls back to the URL-derived default.
 */
export function BreadcrumbCrumb({ crumbs }: { crumbs: Crumb[] }) {
  const ctx = useContext(BreadcrumbContext);
  const serialized = JSON.stringify(crumbs);

  useEffect(() => {
    if (!ctx) return;
    ctx.setOverride(crumbs);
    return () => ctx.setOverride(null);
    // crumbs is captured via serialized to avoid identity churn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, ctx]);

  return null;
}
