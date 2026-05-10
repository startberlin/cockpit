"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type Crumb = { label: string; href?: string };

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

const ID_PREFIXES = ["usr_", "gr_", "bat_", "lm_", "ap_", "bv_", "ma_", "ld_"];

function looksLikeId(segment: string): boolean {
  return (
    ID_PREFIXES.some((p) => segment.startsWith(p)) ||
    /^[0-9a-f]{8,}/i.test(segment)
  );
}

// Hard-coded chains for paths whose hierarchy isn't expressed in the URL.
function getOverrideCrumbs(pathname: string): Crumb[] | null {
  // /people/<id> — member detail lives under Directory in the sidebar
  const memberMatch = pathname.match(/^\/people\/([^/]+)$/);
  if (memberMatch && looksLikeId(memberMatch[1])) {
    return [
      { label: "People", href: "/people/directory" },
      { label: "Directory", href: "/people/directory" },
      { label: "Member" },
    ];
  }
  // /people/resolutions/<id>
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

  if (crumbs.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, i) => (
          <Fragment key={`${crumb.label}-${i}`}>
            {i > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {crumb.href ? (
                <BreadcrumbLink asChild>
                  <Link href={crumb.href}>{crumb.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
