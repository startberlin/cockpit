"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface BackButtonProps {
  children: ReactNode;
  variant?: "ghost" | "outline";
}

export function BackButton({ children, variant = "ghost" }: BackButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    const cameFromApp =
      window.history.length > 1 &&
      document.referrer !== "" &&
      new URL(document.referrer).origin === window.location.origin;
    if (cameFromApp) {
      router.back();
    } else {
      router.push("/admin/people");
    }
  };

  return (
    <Button
      variant={variant}
      size="sm"
      className={variant === "ghost" ? "-ml-2" : undefined}
      onClick={handleClick}
    >
      <ArrowLeft />
      {children}
    </Button>
  );
}
