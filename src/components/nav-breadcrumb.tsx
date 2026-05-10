"use client";

import { usePathname } from "next/navigation";
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
};

function looksLikeId(segment: string): boolean {
  return isPrefixedId(segment) || /^[0-9a-f]{8,}/i.test(segment);
}

function getOverrideCrumbs(pathname: string): Crumb[] | null {
  const memberMatch = pathname.match(/^\/people\/([^/]+)$/);
  if (memberMatch && looksLikeId(memberMatch[1])) {
    return [
      { label: "People", href: "/people/directory" },
      { label: "Directory", href: "/people/directory" },
      { label: "Member" },
    ];
  }
  const resolutionMatch = pathname.match(/^\/people\/resolutions\/([^/]+)$/);
  if (resolutionMatch) {
    return [
      { label: "People", href: "/people/directory" },
      { label: "Resolutions" },
    ];
  }
  return null;
}

function buildDefaultCrumbs(pathname: string): Crumb[] {
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
  const crumbs = getOverrideCrumbs(pathname) ?? buildDefaultCrumbs(pathname);
  return <BreadcrumbView crumbs={crumbs} />;
}
