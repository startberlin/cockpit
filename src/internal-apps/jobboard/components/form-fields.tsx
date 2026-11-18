"use client";

import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ContextHelp } from "./context-help";

type FieldProps = {
  name: string;
  label: string;
  description?: string;
  help?: string;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  autoComplete?: string;
};

export function TextField({
  name,
  label,
  description,
  help,
  multiline,
  type = "text",
  rows,
  ...props
}: FieldProps & {
  multiline?: boolean;
  type?: "text" | "url" | "email" | "tel";
  rows?: number;
}) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="min-w-0 scroll-mb-28 gap-2">
          <div className="flex items-center gap-1">
            <FormLabel>
              {label}
              {props.required ? " *" : ""}
            </FormLabel>
            {help ? (
              <ContextHelp label={`About ${label.toLowerCase()}`}>
                {help}
              </ContextHelp>
            ) : null}
          </div>
          <FormControl>
            {multiline ? (
              <Textarea
                {...field}
                {...props}
                value={field.value ?? ""}
                className="bg-background leading-relaxed"
                rows={rows ?? (name.endsWith("description") ? 10 : 4)}
              />
            ) : (
              <Input
                {...field}
                {...props}
                value={field.value ?? ""}
                type={type}
                className="h-11 bg-background"
                autoComplete={props.autoComplete ?? "off"}
                spellCheck={type === "text" ? undefined : false}
              />
            )}
          </FormControl>
          {description ? (
            <FormDescription>{description}</FormDescription>
          ) : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function SelectField({
  name,
  label,
  description,
  help,
  options,
  disabled,
  required,
  onValueChange,
}: FieldProps & {
  options: readonly { value: string; label: string }[];
  onValueChange?: (value: string) => void;
}) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="min-w-0 scroll-mb-28 gap-2 [&_[data-slot=native-select-wrapper]]:w-full">
          <div className="flex items-center gap-1">
            <FormLabel>
              {label}
              {required ? " *" : ""}
            </FormLabel>
            {help ? (
              <ContextHelp label={`About ${label.toLowerCase()}`}>
                {help}
              </ContextHelp>
            ) : null}
          </div>
          <FormControl>
            <NativeSelect
              {...field}
              value={field.value ?? ""}
              disabled={disabled}
              required={required}
              className="h-11 bg-background"
              onChange={(event) => {
                field.onChange(event.target.value);
                onValueChange?.(event.target.value);
              }}
            >
              {options.map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FormControl>
          {description ? (
            <FormDescription>{description}</FormDescription>
          ) : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function NumberField({
  name,
  label,
  description,
  help,
  disabled,
  max,
  min,
  step = "any",
}: FieldProps & { min?: number; max?: number; step?: number | "any" }) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="min-w-0 scroll-mb-28 gap-2">
          <div className="flex items-center gap-1">
            <FormLabel>{label}</FormLabel>
            {help ? (
              <ContextHelp label={`About ${label.toLowerCase()}`}>
                {help}
              </ContextHelp>
            ) : null}
          </div>
          <FormControl>
            <Input
              {...field}
              type="number"
              className="h-11 bg-background tabular-nums"
              min={min}
              max={max}
              step={step}
              disabled={disabled}
              value={field.value ?? ""}
              onChange={(event) =>
                field.onChange(
                  event.target.value === "" ? null : event.target.valueAsNumber,
                )
              }
            />
          </FormControl>
          {description ? (
            <FormDescription>{description}</FormDescription>
          ) : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function StringListInput({
  value,
  onChange,
  uppercase,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string[];
  onChange: (value: string[]) => void;
  uppercase?: boolean;
}) {
  const [text, setText] = useState(value.join(", "));
  // Keep editable separators while typing, but reflect form resets and external changes.
  useEffect(() => {
    const entries = [
      ...new Set(
        text
          .split(",")
          .map((item) => (uppercase ? item.trim().toUpperCase() : item.trim()))
          .filter(Boolean),
      ),
    ];
    if (JSON.stringify(entries) !== JSON.stringify(value))
      setText(value.join(", "));
  }, [text, value, uppercase]);
  return (
    <Input
      {...props}
      className="h-11 bg-background"
      value={text}
      onBlur={(event) => {
        setText(value.join(", "));
        props.onBlur?.(event);
      }}
      onChange={(event) => {
        setText(event.target.value);
        const entries = event.target.value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        onChange([
          ...new Set(
            uppercase ? entries.map((item) => item.toUpperCase()) : entries,
          ),
        ]);
      }}
    />
  );
}

export function ListField({
  name,
  label,
  description,
  help,
  uppercase,
  ...props
}: FieldProps & { uppercase?: boolean }) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="min-w-0 scroll-mb-28 gap-2">
          <div className="flex items-center gap-1">
            <FormLabel>{label}</FormLabel>
            {help ? (
              <ContextHelp label={`About ${label.toLowerCase()}`}>
                {help}
              </ContextHelp>
            ) : null}
          </div>
          <FormControl>
            <StringListInput
              {...field}
              {...props}
              value={field.value ?? []}
              uppercase={uppercase}
            />
          </FormControl>
          {description ? (
            <FormDescription>{description}</FormDescription>
          ) : null}
          <ListMessage />
        </FormItem>
      )}
    />
  );
}

function ListMessage() {
  const { error, formMessageId } = useFormField();
  const messages = error?.message
    ? [String(error.message)]
    : Array.isArray(error)
      ? error.flatMap((item) =>
          typeof item?.message === "string" ? [item.message] : [],
        )
      : [];
  return messages.length ? (
    <p id={formMessageId} className="text-sm text-destructive">
      {[...new Set(messages)].join(" ")}
    </p>
  ) : null;
}

export function FormError({ message }: { message?: string }) {
  return message ? (
    <p
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
    >
      {message}
    </p>
  ) : null;
}

export function FormSection({
  title,
  description,
  children,
  action,
  className,
  id,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "min-w-0 scroll-mt-6 space-y-4 border-b pb-6 last:border-b-0 last:pb-0",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {description ? (
            <ContextHelp label={`About ${title.toLowerCase()}`}>
              {description}
            </ContextHelp>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
