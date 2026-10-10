"use client";

import type { Editor } from "@tiptap/core";
import { Code2, Copy, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RichTextDoc } from "../lib/blocks";
import { documentPlainText } from "../lib/editor-document";

type ExportFormat = "markdown" | "html" | "text";
const FORMAT_LABELS: Record<ExportFormat, string> = {
  markdown: "Markdown",
  html: "HTML",
  text: "Text",
};

function exportContent(editor: Editor, format: ExportFormat): string {
  switch (format) {
    case "markdown":
      return editor.getMarkdown();
    case "html":
      return editor.getHTML();
    case "text":
      return documentPlainText(editor.getJSON() as RichTextDoc);
  }
}

export function DocumentExport({ editor }: { editor: Editor }) {
  const copy = async (format: ExportFormat) => {
    try {
      const content = exportContent(editor, format);
      await navigator.clipboard.writeText(content);
      toast.success(`${FORMAT_LABELS[format]} copied.`);
    } catch {
      toast.error("Clipboard unavailable. Download your draft instead.");
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Copy or export newsletter"
          title="Copy or export"
        >
          <Copy />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void copy("markdown")}>
          <FileText />
          Copy Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void copy("html")}>
          <Code2 />
          Copy HTML with formatting
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void copy("text")}>
          <Copy />
          Copy plain text
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            const url = URL.createObjectURL(
              new Blob([editor.getMarkdown()], {
                type: "text/markdown;charset=utf-8",
              }),
            );
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "newsletter.md";
            anchor.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          <Download />
          Download Markdown
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
