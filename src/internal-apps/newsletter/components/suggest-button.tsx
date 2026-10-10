"use client";

import { Sparkles } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { suggestPreviewTextAction, suggestSubjectsAction } from "../actions/ai";
import { parseError } from "../lib/error";

/**
 * Writing help, offered rather than applied: suggestions land in a popover and
 * only reach the issue when someone picks one.
 *
 * Hidden entirely when no key is configured, so the composer never advertises
 * something that cannot work.
 */
export function SuggestSubjectButton({
  issueId,
  onPick,
  beforeSuggest,
}: {
  issueId: string;
  onPick: (value: string) => void;
  beforeSuggest: () => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);

  const suggest = useAction(suggestSubjectsAction, {
    onError: ({ error }) => toast.error(parseError(error)),
  });

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setPreparing(true);
          void beforeSuggest().then((saved) => {
            setPreparing(false);
            if (saved) suggest.execute({ id: issueId });
            else setOpen(false);
          });
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Suggest subject lines"
          disabled={preparing || suggest.isPending}
        >
          <Sparkles />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="border-b px-3 py-2 text-sm font-medium">
          Subject line ideas
        </div>
        <div className="flex flex-col p-1">
          {preparing || suggest.isPending ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              Reading the issue…
            </p>
          ) : suggest.result.data?.suggestions?.length ? (
            suggest.result.data.suggestions.map((suggestion) => (
              <button
                key={suggestion.text}
                type="button"
                className="flex flex-col items-start gap-0.5 px-2 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onPick(suggestion.text);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{suggestion.text}</span>
                <span className="text-xs text-muted-foreground">
                  {suggestion.rationale}
                </span>
              </button>
            ))
          ) : (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              No suggestions.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function SuggestPreviewTextButton({
  issueId,
  subject,
  onPick,
  beforeSuggest,
}: {
  issueId: string;
  subject: string;
  onPick: (value: string) => void;
  beforeSuggest: () => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);

  const suggest = useAction(suggestPreviewTextAction, {
    onError: ({ error }) => toast.error(parseError(error)),
  });

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setPreparing(true);
          void beforeSuggest().then((saved) => {
            setPreparing(false);
            if (saved) suggest.execute({ id: issueId, subject });
            else setOpen(false);
          });
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Suggest preview text"
          disabled={preparing || suggest.isPending}
        >
          <Sparkles />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="border-b px-3 py-2 text-sm font-medium">
          Preview text ideas
        </div>
        <div className="flex flex-col p-1">
          {preparing || suggest.isPending ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              Reading the issue…
            </p>
          ) : suggest.result.data?.options?.length ? (
            suggest.result.data.options.map((option) => (
              <button
                key={option}
                type="button"
                className="px-2 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onPick(option);
                  setOpen(false);
                }}
              >
                {option}
              </button>
            ))
          ) : (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              No suggestions.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
