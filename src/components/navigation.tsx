"use client";

import { LayoutGroup, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "My membership" },
  { href: "/people", label: "People" },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation">
      <LayoutGroup id="nav-underline">
        <ul className="flex w-full relative gap-0.5">
          {NAV_ITEMS.map(({ href, label }) => {
            const current =
              pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <li key={href} className="flex relative">
                <span className="relative flex flex-col items-center">
                  <Link
                    href={href}
                    aria-current={current ? "page" : undefined}
                    className="uppercase text-brand-foreground font-bold py-2 px-3 mb-[2px]"
                  >
                    {label}
                  </Link>
                  {current && (
                    <motion.span
                      layoutId="nav-underline-bar"
                      className="absolute left-0 right-0 bottom-0 h-[2px] bg-brand-foreground"
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 40,
                      }}
                    />
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </LayoutGroup>
    </nav>
  );
}
