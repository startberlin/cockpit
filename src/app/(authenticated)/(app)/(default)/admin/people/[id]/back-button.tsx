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
    if (window.history.length > 1) {
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
