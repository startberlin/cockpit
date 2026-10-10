"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Field primitives shared by every block form.
 *
 * These are plain controlled inputs rather than React Hook Form fields: a block
 * form has no submit of its own — the composer owns the whole issue and
 * autosaves it — so a form library would only add ceremony.
 */

export function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function LabeledTextarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

/**
 * A list of sub-items (news links, startups, jobs) with add and remove.
 * `max` exists because these map to sections with a designed length — three
 * startups is an editorial format, not an accident.
 */
export function RepeatableList<T>({
  items,
  onChange,
  createItem,
  renderItem,
  addLabel,
  max = 8,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  createItem: () => T;
  renderItem: (item: T, update: (patch: Partial<T>) => void) => React.ReactNode;
  addLabel: string;
  max?: number;
}) {
  const keys = useRef<string[] | null>(null);
  const current = useRef({ items, onChange });
  if (!keys.current || current.current.items !== items) {
    // Undo or replacing a template resets its row identities. Detached image
    // requests must not land on a different row with the same old index.
    keys.current = items.map(() => crypto.randomUUID());
    current.current.items = items;
  }
  const itemKeys = keys.current;
  useEffect(() => {
    current.current.onChange = onChange;
  }, [onChange]);
  const change = (next: T[]) => {
    current.current.items = next;
    current.current.onChange(next);
  };
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => {
        const key = itemKeys[index];
        return (
          <div
            key={key}
            className="flex items-start gap-2 border bg-muted/20 p-3"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              {renderItem(item, (patch) => {
                const currentIndex = keys.current?.indexOf(key) ?? -1;
                if (currentIndex === -1) return;
                const next = [...current.current.items];
                next[currentIndex] = { ...next[currentIndex], ...patch };
                change(next);
              })}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Remove item"
              onClick={() => {
                itemKeys.splice(index, 1);
                change(current.current.items.filter((_, i) => i !== index));
              }}
            >
              <Trash2 />
            </Button>
          </div>
        );
      })}
      {items.length < max ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => {
            itemKeys.push(crypto.randomUUID());
            change([...current.current.items, createItem()]);
          }}
        >
          <Plus />
          {addLabel}
        </Button>
      ) : null}
    </div>
  );
}
