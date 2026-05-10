"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Can } from "@/components/can";
import { cn } from "@/lib/utils";

export default function PeopleSubNav() {
  const pathname = usePathname();

  const tab = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center border-b-2 px-1 pb-3 text-sm font-medium whitespace-nowrap transition-colors",
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );

  return (
    <nav aria-label="People section navigation" className="border-b">
      <ul className="-mb-px flex flex-nowrap gap-6 overflow-x-auto">
        <li className="shrink-0">
          {tab("/people", "Directory", pathname === "/people")}
        </li>
        <Can permission="batches.manage">
          <li className="shrink-0">
            {tab(
              "/people/batches",
              "Batches",
              pathname.startsWith("/people/batches"),
            )}
          </li>
        </Can>
      </ul>
    </nav>
  );
}
