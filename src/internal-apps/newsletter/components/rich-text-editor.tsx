"use client";

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, Link2Off, List, ListOrdered } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { type RichTextDoc, serializableRichText } from "../lib/blocks";
import { LinkDialog } from "./link-dialog";

/**
 * Inline rich text for the body of a block.
 *
 * Deliberately a small feature set: bold, italic, links and lists. Anything
 * more — colours, fonts, alignment — is a way for an issue to drift off-brand,
 * and structure that matters (headings, quotes, buttons) is a block of its own
 * rather than something you improvise inside a paragraph.
 */

interface RichTextEditorProps {
  value: RichTextDoc;
  onChange: (value: RichTextDoc) => void;
  placeholder?: string;
  editable?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  editable = true,
}: RichTextEditorProps) {
  const editor = useEditor({
    // Next renders this on the server first; rendering the editor there
    // produces a hydration mismatch.
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editable,
    extensions: [
      StarterKit.configure({
        // Headings, rules and code blocks are blocks in their own right, so
        // they are turned off inside a paragraph editor.
        heading: false,
        codeBlock: false,
        horizontalRule: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
        },
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": "Text content",
        "aria-multiline": "true",
        "aria-readonly": String(!editable),
        class:
          "min-h-[120px] w-full px-3 py-2 text-sm outline-none [&_p]:my-0 [&_p+p]:mt-3 [&_ul]:my-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-0 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:underline [&_a]:text-primary",
      },
    },
    onUpdate: ({ editor: instance }) => {
      onChange(serializableRichText(instance.getJSON() as RichTextDoc));
    },
  });

  // Keep the editor in sync when a block is duplicated or replaced externally.
  // Guard on equality
  // so normal typing does not reset the cursor on every keystroke.
  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    if (current !== JSON.stringify(value)) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    // A disabled fieldset does not disable contenteditable. Apply status
    // changes to the existing editor without emitting another content update.
    editor?.setEditable(editable, false);
    editor?.view.dom.setAttribute("aria-readonly", String(!editable));
  }, [editor, editable]);

  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive("bold") ?? false,
      italic: current?.isActive("italic") ?? false,
      bulletList: current?.isActive("bulletList") ?? false,
      orderedList: current?.isActive("orderedList") ?? false,
      link: current?.isActive("link") ?? false,
    }),
  });

  if (!editor) {
    return <div className="h-[158px] w-full border bg-muted/30" />;
  }

  return (
    <div className="w-full border bg-background focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
      <div className="flex flex-wrap items-center gap-0.5 border-b px-1 py-1">
        <ToolbarButton
          active={active?.bold ?? false}
          label="Bold"
          disabled={!editable}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold />
        </ToolbarButton>
        <ToolbarButton
          active={active?.italic ?? false}
          label="Italic"
          disabled={!editable}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </ToolbarButton>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ToolbarButton
          active={active?.bulletList ?? false}
          label="Bullet list"
          disabled={!editable}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List />
        </ToolbarButton>
        <ToolbarButton
          active={active?.orderedList ?? false}
          label="Numbered list"
          disabled={!editable}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
        </ToolbarButton>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <LinkDialog
          editor={editor}
          active={active?.link ?? false}
          disabled={!editable}
        />
        <ToolbarButton
          active={false}
          label="Remove link"
          disabled={!editable || !active?.link}
          onClick={() => editor.chain().focus().unsetLink().run()}
        >
          <Link2Off />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  active,
  label,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(active && "bg-accent text-accent-foreground")}
    >
      {children}
    </Button>
  );
}
