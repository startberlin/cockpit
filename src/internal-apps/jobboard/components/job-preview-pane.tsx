"use client";

import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { SaveJobInput } from "../actions/schemas";
import type { PublicJob } from "../lib/contracts";
import { ContextHelp } from "./context-help";
import type { JobEditorCompany } from "./job-editor-data";
import { JobPreview } from "./job-preview";
import { formatDate } from "./status-badge";

export function JobPreviewPane({
  companies,
  published,
  isPublished,
}: {
  companies: JobEditorCompany[];
  published: PublicJob | null;
  isPublished: boolean;
}) {
  const { control } = useFormContext<SaveJobInput>();
  const content = useWatch({ control, name: "content" });
  const companyId = useWatch({ control, name: "companyId" });
  const [version, setVersion] = useState("draft");
  const showPublished = version === "published" && published !== null;
  const company = showPublished
    ? published.company
    : companies.find((entry) => entry.id === companyId);
  return (
    <section
      className="flex h-full min-h-0 min-w-0 flex-col bg-muted/35"
      aria-label="Listing preview"
    >
      <div className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-background px-4 py-2">
        <div className="flex items-center gap-1">
          <h2 className="text-sm font-semibold">Preview</h2>
          <ContextHelp label="About this preview">
            {showPublished
              ? `Published ${formatDate(published.publishedAt)}. ${isPublished ? "Visible on the jobboard." : "This listing is no longer live."}`
              : "Your current edits. Private notes are excluded."}
          </ContextHelp>
          {showPublished && !isPublished ? (
            <Badge variant="outline">Not live</Badge>
          ) : null}
        </div>
        {published ? (
          <ToggleGroup
            type="single"
            size="sm"
            value={version}
            onValueChange={(value) => {
              if (value) setVersion(value);
            }}
            aria-label="Preview version"
          >
            <ToggleGroupItem value="draft">Draft</ToggleGroupItem>
            <ToggleGroupItem value="published">Published</ToggleGroupItem>
          </ToggleGroup>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 p-4 sm:p-6 @min-[58rem]/workspace:overflow-y-auto @min-[58rem]/workspace:overscroll-contain">
        <div className="mx-auto min-h-full w-full max-w-3xl bg-background p-5 sm:p-6">
          <JobPreview
            content={showPublished ? published.content : content}
            company={company?.name ?? ""}
            companyDescription={company?.description}
            companyWebsite={company?.website}
          />
        </div>
      </div>
    </section>
  );
}
