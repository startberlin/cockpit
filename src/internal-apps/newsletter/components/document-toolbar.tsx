"use client";

import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Paintbrush,
  Plus,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { LinkDialog } from "./link-dialog";
import { openSlashMenu } from "./slash-menu";

function Tool({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn("shrink-0", active && "bg-accent text-accent-foreground")}
    >
      {children}
    </Button>
  );
}

export function DocumentToolbar({
  editor,
  editable,
}: {
  editor: Editor;
  editable: boolean;
}) {
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      underline: current.isActive("underline"),
      strike: current.isActive("strike"),
      link: current.isActive("link"),
      level: current.isActive("heading")
        ? Number(current.getAttributes("heading").level)
        : 0,
      undo: current.can().undo(),
      redo: current.can().redo(),
    }),
  });
  return (
    <div
      className="document-toolbar"
      role="toolbar"
      aria-label="Text formatting"
    >
      <Tool
        label="Insert a block (/)"
        disabled={!editable}
        onClick={() => openSlashMenu(editor)}
      >
        <Plus />
      </Tool>
      <span className="mx-1 h-4 w-px shrink-0 bg-border" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!editable}
            className="shrink-0 gap-2 px-2"
            aria-label="Text style"
          >
            {active.level
              ? ["Title", "Heading", "Subheading"][active.level - 1]
              : "Text"}
            <ChevronDown className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            disabled={!editable}
            onSelect={() => editor.chain().focus().setParagraph().run()}
          >
            Text
          </DropdownMenuItem>
          {([1, 2, 3] as const).map((level) => (
            <DropdownMenuItem
              key={level}
              disabled={!editable}
              onSelect={() =>
                editor.chain().focus().setHeading({ level }).run()
              }
            >
              {["Title", "Heading", "Subheading"][level - 1]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="mx-1 h-4 w-px shrink-0 bg-border" />
      <Tool
        label="Bold (⌘B)"
        active={active.bold}
        disabled={!editable}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold />
      </Tool>
      <Tool
        label="Italic (⌘I)"
        active={active.italic}
        disabled={!editable}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic />
      </Tool>
      <Tool
        label="Underline (⌘U)"
        active={active.underline}
        disabled={!editable}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline />
      </Tool>
      <LinkDialog editor={editor} active={active.link} disabled={!editable} />
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            type="button"
            size="icon-sm"
            aria-label="Text colour and highlight"
            title="Colour and highlight"
            disabled={!editable}
          >
            <Paintbrush />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-60 rounded-lg p-3"
          align="start"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <p className="mb-2 text-xs font-medium">Text colour</p>
          <div className="grid grid-cols-6 gap-2">
            {[
              ["Ink", "#111322"],
              ["Navy", "#00002C"],
              ["Teal", "#087E90"],
              ["Pink", "#D51F5D"],
              ["Grey", "#6B7185"],
              ["Blue", "#2563EB"],
            ].map(([label, color]) => (
              <button
                key={color}
                type="button"
                disabled={!editable}
                aria-label={`${label} text`}
                title={label}
                className="size-7 rounded-full border-2 border-white ring-1 ring-border hover:ring-2"
                style={{ backgroundColor: color }}
                onClick={() => editor.chain().focus().setColor(color).run()}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1 border-t pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!editable}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .toggleHighlight({ color: "#FEF08A" })
                  .run()
              }
            >
              <Highlighter />
              Highlight
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!editable}
              onClick={() =>
                editor.chain().focus().unsetColor().unsetHighlight().run()
              }
            >
              Reset
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!editable}
            aria-label="Lists and alignment"
            title="Lists and alignment"
          >
            <List />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            disabled={!editable}
            onSelect={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List />
            Bullet list
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!editable}
            onSelect={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered />
            Numbered list
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!editable}
            onSelect={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Quote />
            Quote
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {(
            [
              ["left", "Align left", AlignLeft],
              ["center", "Centre", AlignCenter],
              ["right", "Align right", AlignRight],
              ["justify", "Justify", AlignJustify],
            ] as const
          ).map(([align, label, Icon]) => (
            <DropdownMenuItem
              key={align}
              disabled={!editable}
              onSelect={() => editor.chain().focus().setTextAlign(align).run()}
            >
              <Icon />
              {label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!editable}
            onSelect={() => editor.chain().focus().toggleStrike().run()}
          >
            <Strikethrough />
            Strikethrough
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!editable}
            onSelect={() =>
              editor
                .chain()
                .focus()
                .unsetAllMarks()
                .clearNodes()
                .unsetTextAlign()
                .run()
            }
          >
            <Paintbrush />
            Clear formatting
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="ml-auto h-4 w-px shrink-0 bg-border" />
      <Tool
        label="Undo (⌘Z)"
        disabled={!editable || !active.undo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 />
      </Tool>
      <Tool
        label="Redo (⇧⌘Z)"
        disabled={!editable || !active.redo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 />
      </Tool>
    </div>
  );
}
