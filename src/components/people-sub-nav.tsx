"use client";

import { LayoutGroup, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Can } from "@/components/can";

export default function PeopleSubNav() {
  const pathname = usePathname();

  const tab = (href: string, label: string, active: boolean) => (
    <span className="relative flex flex-col items-center">
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className="uppercase text-brand-foreground/70 font-bold py-2 px-3 mb-[2px] whitespace-nowrap hover:text-brand-foreground"
      >
        {label}
      </Link>
      {active && (
        <motion.span
          layoutId="people-sub-nav-underline"
          className="absolute left-0 right-0 bottom-0 h-[2px] bg-brand-foreground"
          transition={{ type: "spring", stiffness: 400, damping: 40 }}
        />
      )}
    </span>
  );

  return (
    <nav aria-label="People section navigation">
      <LayoutGroup id="people-sub-nav">
        <ul className="flex relative gap-0.5 flex-nowrap overflow-x-auto overflow-y-hidden">
          <li className="flex relative shrink-0">
            {tab("/people", "Directory", pathname === "/people")}
          </li>
          <Can permission="batches.manage">
            <li className="flex relative shrink-0">
              {tab(
                "/people/batches",
                "Batches",
                pathname.startsWith("/people/batches"),
              )}
            </li>
          </Can>
        </ul>
      </LayoutGroup>
    </nav>
  );
}
