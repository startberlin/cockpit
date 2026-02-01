"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CopyButton } from "@/components/copy-button";

interface DetailFieldProps {
  icon: LucideIcon;
  label: string;
  value?: ReactNode;
  copyValue?: string;
  copyLabel?: string;
}

export function DetailField({
  icon: Icon,
  label,
  value,
  copyValue,
  copyLabel,
}: DetailFieldProps) {
  return (
    <div className="flex gap-3">
      <Icon className="text-muted-foreground mt-1 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            {label}
          </p>
          {copyValue && copyValue.length > 0 && (
            <CopyButton value={copyValue} label={copyLabel || "Copy"} />
          )}
        </div>
        <div className="text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}
