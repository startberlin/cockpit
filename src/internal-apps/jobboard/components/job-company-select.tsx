"use client";

import {
  CheckIcon,
  ChevronsUpDownIcon,
  ExternalLinkIcon,
  PlusIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { SaveJobInput } from "../actions/schemas";
import type { JobEditorCompany } from "./job-editor-data";
import { useCompanySearch } from "./use-company-search";

export type CompanyRefreshState = {
  run: () => void;
  select: (company: JobEditorCompany) => void;
  pending: boolean;
  error?: string;
};

export function JobCompanySelect({
  companies,
  disabled,
  refresh,
}: {
  companies: JobEditorCompany[];
  disabled: boolean;
  refresh: CompanyRefreshState;
}) {
  const { control } = useFormContext<SaveJobInput>();
  const [open, setOpen] = useState(false);
  const search = useCompanySearch(companies, open);
  return (
    <FormField
      control={control}
      name="companyId"
      render={({ field }) => {
        const company = companies.find((entry) => entry.id === field.value);
        return (
          <FormItem>
            <div className="flex items-center justify-between gap-3">
              <FormLabel>Company *</FormLabel>
              {company ? (
                <a
                  href={`/jobboard/companies/${company.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-4"
                >
                  Manage company
                  <ExternalLinkIcon className="size-3" />
                </a>
              ) : null}
            </div>
            <Popover open={open && !disabled} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    type="button"
                    role="combobox"
                    aria-expanded={open && !disabled}
                    variant="outline"
                    className="h-10 w-full justify-between font-normal"
                    disabled={disabled}
                    ref={field.ref}
                    onBlur={field.onBlur}
                  >
                    <span className="truncate">
                      {company?.name ?? "Search and select a company"}
                    </span>
                    <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent
                className="w-(--radix-popover-trigger-width) p-0"
                align="start"
              >
                <Command shouldFilter={false}>
                  <CommandInput
                    value={search.q}
                    onValueChange={search.setQ}
                    maxLength={300}
                    placeholder="Search companies"
                    aria-label="Search companies"
                  />
                  <CommandList>
                    <CommandEmpty>
                      {search.message ?? "No matching company found."}
                    </CommandEmpty>
                    <CommandGroup>
                      {search.rows.map((entry) => (
                        <CommandItem
                          key={entry.id}
                          value={entry.id}
                          keywords={[entry.name]}
                          disabled={disabled}
                          onSelect={() => {
                            if (disabled) return;
                            refresh.select(entry);
                            field.onChange(entry.id);
                            search.setQ("");
                            setOpen(false);
                          }}
                        >
                          <span className="flex-1 truncate">{entry.name}</span>
                          {entry.id === field.value ? (
                            <CheckIcon className="size-4" />
                          ) : null}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                  <div className="border-t p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      disabled={disabled || refresh.pending}
                      onClick={refresh.run}
                    >
                      <RefreshCwIcon
                        className={refresh.pending ? "animate-spin" : undefined}
                      />
                      {refresh.pending
                        ? "Refreshing companies"
                        : "Refresh companies"}
                    </Button>
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                    >
                      <a
                        href="/jobboard/companies/new"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <PlusIcon />
                        Create company in a new tab
                      </a>
                    </Button>
                    {refresh.error ? (
                      <p
                        role="alert"
                        className="px-2 py-1 text-xs text-destructive"
                      >
                        {refresh.error}
                      </p>
                    ) : null}
                  </div>
                </Command>
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
