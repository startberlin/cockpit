"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BatchSelectProps {
  batches: { number: number }[];
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  disabled?: boolean;
}

export function BatchSelect({
  batches,
  value,
  onChange,
  disabled,
}: BatchSelectProps) {
  return (
    <Select
      value={value != null ? String(value) : ""}
      onValueChange={(v) => onChange(v === "" ? undefined : Number(v))}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder="No batch (optional)" />
      </SelectTrigger>
      <SelectContent>
        {batches.map((b) => (
          <SelectItem key={b.number} value={String(b.number)}>
            Batch {b.number}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
