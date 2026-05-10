"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Crumb } from "@/components/breadcrumb-view";

const BreadcrumbValueContext = createContext<Crumb[] | null>(null);
const BreadcrumbSetterContext = createContext<
  ((crumbs: Crumb[] | null) => void) | null
>(null);

export function BreadcrumbProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [override, setOverride] = useState<Crumb[] | null>(null);
  return (
    <BreadcrumbSetterContext.Provider value={setOverride}>
      <BreadcrumbValueContext.Provider value={override}>
        {children}
      </BreadcrumbValueContext.Provider>
    </BreadcrumbSetterContext.Provider>
  );
}

export function useBreadcrumbOverride(): Crumb[] | null {
  return useContext(BreadcrumbValueContext);
}

/**
 * Server-rendered pages render this client component to publish a breadcrumb
 * chain into the topbar. Mounts → set; unmounts → clear, so navigating away
 * cleanly falls back to the URL-derived default.
 */
export function BreadcrumbCrumb({ crumbs }: { crumbs: Crumb[] }) {
  const setOverride = useContext(BreadcrumbSetterContext);
  useEffect(() => {
    if (!setOverride) return;
    setOverride(crumbs);
    return () => setOverride(null);
  }, [crumbs, setOverride]);
  return null;
}
