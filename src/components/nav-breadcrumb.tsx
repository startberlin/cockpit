"use client";

import { usePathname } from "next/navigation";
import { useBreadcrumbOverride } from "@/components/breadcrumb-bridge";
import { BreadcrumbView, type Crumb } from "@/components/breadcrumb-view";
import { isPrefixedId } from "@/lib/id";

const SEGMENT_LABELS: Record<string, string> = {
  membership: "My membership",
  application: "Application",
  "payment-return": "Payment",
  people: "People",
  directory: "Directory",
  batches: "Batches",
  resolutions: "Resolutions",
  groups: "Groups",
  payments: "Payments",
  settings: "Settings",
};

/**
 * When a path starts with a given prefix, use these fixed crumbs instead of
 * the segment-based defaults. Checked in order; first match wins.
 */
const PATH_PREFIX_CRUMBS: [prefix: string, crumbs: Crumb[]][] = [
  [
    "/membership/application/",
    [{ label: "My membership", href: "/membership" }, { label: "Application" }],
  ],
];

function looksLikeId(segment: string): boolean {
  return isPrefixedId(segment) || /^[0-9a-f]{8,}/i.test(segment);
}

function buildDefaultCrumbs(pathname: string): Crumb[] {
  for (const [prefix, crumbs] of PATH_PREFIX_CRUMBS) {
    if (pathname.startsWith(prefix)) {
      return crumbs;
    }
  }

  const segments = pathname.split("/").filter(Boolean);
  return segments.map((seg, i) => {
    const isLast = i === segments.length - 1;
    const href = `/${segments.slice(0, i + 1).join("/")}`;
    const label = looksLikeId(seg)
      ? "Details"
      : (SEGMENT_LABELS[seg] ?? decodeURIComponent(seg));
    return isLast ? { label } : { label, href };
  });
}

export function NavBreadcrumb() {
  const pathname = usePathname();
  const override = useBreadcrumbOverride();
  const crumbs = override ?? buildDefaultCrumbs(pathname);
  return <BreadcrumbView crumbs={crumbs} />;
}
