"use client";

import type { Editor } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Check, ChevronDown, Italic, Plus } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Block, RichTextDoc } from "../lib/blocks";
import {
  blocksToDocument,
  documentText,
  documentToBlocks,
  imageNode,
  looksLikeMarkdown,
} from "../lib/editor-document";
import { NewsletterLink, parseEditorMarkdown } from "../lib/editor-markdown";
import { uploadNewsletterImage } from "../lib/upload-image";
import { createUploadTracker, type UploadTracker } from "../lib/upload-tracker";
import { DocumentEditingContext } from "./document-editing-context";
import { DocumentExport } from "./document-export";
import {
  DocumentIdentity,
  NewsletterBlock,
  NewsletterImage,
} from "./document-nodes";
import { DocumentToolbar } from "./document-toolbar";
import { LinkDialog } from "./link-dialog";
import { closeSlashMenu, openSlashMenu, SlashCommands } from "./slash-menu";
import { UploadContext } from "./upload-context";
import "./document-editor.css";

async function insertImages(
  editor: Editor,
  files: File[],
  uploads: UploadTracker,
  position?: number,
) {
  if (!editor.isEditable) return;
  const entries = files.slice(0, 10).map((file) => {
    const id = crypto.randomUUID();
    return { file, id, finish: uploads.begin(id) };
  });
  const content = [
    ...entries.map(({ id }) =>
      imageNode(undefined, { sourceId: id, uploading: true }),
    ),
    { type: "paragraph" },
  ];
  editor
    .chain()
    .focus()
    .insertContentAt(position ?? editor.state.selection.from, content)
    .run();
  await Promise.all(
    entries.map(async ({ file, id, finish }) => {
      try {
        const image = await uploadNewsletterImage(file);
        if (editor.isDestroyed || !editor.isEditable) return;
        editor.state.doc.descendants((node, pos) => {
          if (node.type.name === "image" && node.attrs.sourceId === id) {
            editor.view.dispatch(
              editor.state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                src: image.url,
                width: image.width,
                height: image.height,
                uploading: false,
              }),
            );
            return false;
          }
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Image upload failed.",
        );
        if (editor.isDestroyed || !editor.isEditable) return;
        editor.state.doc.descendants((node, pos) => {
          if (node.type.name === "image" && node.attrs.sourceId === id)
            editor.view.dispatch(
              editor.state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                uploading: false,
              }),
            );
        });
      } finally {
        finish();
      }
    }),
  );
}

export function DocumentEditor({
  initialBlocks,
  onChange,
  onPendingUploadsChange,
  editable,
  children,
}: {
  initialBlocks: Block[];
  onChange: (blocks: Block[]) => void;
  onPendingUploadsChange: (count: number) => void;
  editable: boolean;
  children: ReactNode;
}) {
  const [initialDocument] = useState(() => blocksToDocument(initialBlocks));
  const [stats, setStats] = useState(() => {
    const text = documentText(initialDocument);
    return {
      words: text ? text.split(/\s+/).length : 0,
      empty: !initialBlocks.length,
    };
  });
  const [pasteMode, setPasteMode] = useState<"formatted" | "plain">(
    "formatted",
  );
  const pasteModeRef = useRef(pasteMode);
  const plainPasteRef = useRef(false);
  const editorRef = useRef<Editor | null>(null);
  const changed = useRef(onChange);
  const uploadsChanged = useRef(onPendingUploadsChange);
  const [uploads] = useState(() =>
    createUploadTracker((count) => uploadsChanged.current(count)),
  );
  useEffect(() => {
    changed.current = onChange;
    uploadsChanged.current = onPendingUploadsChange;
  }, [onChange, onPendingUploadsChange]);
  const updatePasteMode = useCallback((mode: "formatted" | "plain") => {
    pasteModeRef.current = mode;
    setPasteMode(mode);
  }, []);
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editable,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
      }),
      NewsletterLink,
      TextStyleKit,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === "heading"
            ? "Give this section a heading"
            : "Write something, or type / for a block",
        showOnlyCurrent: true,
        includeChildren: false,
      }),
      NewsletterImage,
      NewsletterBlock,
      DocumentIdentity.configure({ isUploading: uploads.isUploading }),
      Markdown,
      SlashCommands,
    ],
    content: initialDocument,
    editorProps: {
      scrollThreshold: { top: 112, bottom: 24, left: 0, right: 0 },
      scrollMargin: { top: 112, bottom: 24, left: 0, right: 0 },
      attributes: {
        role: "textbox",
        "aria-label": "Newsletter content",
        "aria-multiline": "true",
        "aria-readonly": String(!editable),
        spellcheck: "true",
        class: "newsletter-document",
      },
      handleKeyDown: (_view, event) => {
        plainPasteRef.current =
          (event.metaKey || event.ctrlKey) &&
          event.shiftKey &&
          event.key.toLowerCase() === "v";
        return false;
      },
      handlePaste: (_view, event) => {
        const current = editorRef.current;
        if (!current?.isEditable || !event.clipboardData) return false;
        if (current.isActive("codeBlock")) return false;
        const files = Array.from(event.clipboardData.files).filter((file) =>
          file.type.startsWith("image/"),
        );
        if (files.length) {
          void insertImages(current, files, uploads);
          return true;
        }
        const text = event.clipboardData.getData("text/plain");
        const plain = pasteModeRef.current === "plain" || plainPasteRef.current;
        plainPasteRef.current = false;
        if (plain && text) {
          current.commands.insertContent(
            text.split(/\r?\n/).map((line) => ({
              type: "paragraph",
              content: line ? [{ type: "text", text: line }] : [],
            })),
          );
          return true;
        }
        if (
          !event.clipboardData.getData("text/html") &&
          looksLikeMarkdown(text)
        ) {
          try {
            current.commands.insertContent(
              parseEditorMarkdown(current.markdown, text),
            );
            return true;
          } catch {
            return false;
          }
        }
        const html = event.clipboardData.getData("text/html");
        if (html) {
          // A normal open ProseMirror paste slice drops the first paragraph's
          // alignment. Parsing a complete fragment keeps block styles intact.
          current.commands.insertContent(html);
          return true;
        }
        return false;
      },
      handleDrop: (view, event, _slice, moved) => {
        const current = editorRef.current;
        if (moved || !current?.isEditable) return false;
        const files = Array.from(event.dataTransfer?.files ?? []).filter(
          (file) => file.type.startsWith("image/"),
        );
        if (!files.length) return false;
        event.preventDefault();
        void insertImages(
          current,
          files,
          uploads,
          view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos,
        );
        return true;
      },
    },
    onCreate: ({ editor: instance }) => {
      editorRef.current = instance;
      setStats((current) => ({ ...current, empty: instance.isEmpty }));
    },
    onUpdate: ({ editor: instance }) => {
      const doc = instance.getJSON() as RichTextDoc;
      const text = documentText(doc);
      const words = text ? text.split(/\s+/).length : 0;
      const empty = instance.isEmpty;
      setStats((previous) =>
        previous.words === words && previous.empty === empty
          ? previous
          : { words, empty },
      );
      changed.current(documentToBlocks(doc));
    },
    onDestroy: () => {
      editorRef.current = null;
    },
  });
  useEffect(() => {
    editor?.setEditable(editable, false);
    if (editor && !editable) closeSlashMenu(editor);
    if (editor)
      editor.view.dom.setAttribute("aria-readonly", String(!editable));
  }, [editor, editable]);
  return (
    <UploadContext value={uploads}>
      <DocumentEditingContext value={editable}>
        <div className="document-workspace">
          <div className="document-scroll-area">
            <div className="document-settings">{children}</div>
            <section
              className="document-body"
              aria-labelledby="newsletter-body-heading"
            >
              <div className="document-body-controls">
                <div className="document-body-heading">
                  <div>
                    <h2
                      id="newsletter-body-heading"
                      className="text-sm font-semibold text-foreground"
                    >
                      Newsletter body
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Write your email below. Type / to add a block.
                    </p>
                  </div>
                  {editor ? <DocumentExport editor={editor} /> : null}
                </div>
                {editor ? (
                  <DocumentToolbar editor={editor} editable={editable} />
                ) : (
                  <div className="h-11 border-b bg-background" />
                )}
              </div>
              <div className="document-paper">
                <div className="relative">
                  <EditorContent editor={editor} />
                  {editor && editable && stats.empty ? (
                    <div className="document-empty-actions">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openSlashMenu(editor)}
                      >
                        <Plus />
                        Add a block{" "}
                        <kbd className="ml-2 text-muted-foreground">/</kbd>
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Or paste a draft and make it yours.
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          </div>
          <div className="flex min-h-10 shrink-0 flex-wrap items-center justify-between gap-1 border-t bg-background px-4 py-1.5 text-[11px] text-muted-foreground">
            <span className="tabular-nums">
              {stats.words} words <span className="mx-1.5">·</span>
              {stats.words
                ? `${Math.max(1, Math.ceil(stats.words / 220))} min read`
                : "Your story starts here"}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex min-h-7 items-center gap-1.5 rounded px-1 hover:bg-muted"
                  aria-label="Paste behaviour"
                  disabled={!editable}
                >
                  Paste:{" "}
                  {pasteMode === "formatted" ? "keep formatting" : "plain text"}
                  <ChevronDown className="size-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top">
                <DropdownMenuItem onSelect={() => updatePasteMode("formatted")}>
                  <Check
                    className={
                      pasteMode === "formatted" ? "opacity-100" : "opacity-0"
                    }
                  />
                  Keep formatting
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => updatePasteMode("plain")}>
                  <Check
                    className={
                      pasteMode === "plain" ? "opacity-100" : "opacity-0"
                    }
                  />
                  Paste as plain text
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {editor && editable ? (
            <BubbleMenu
              editor={editor}
              shouldShow={({ state }) =>
                !state.selection.empty &&
                !!state.doc
                  .textBetween(state.selection.from, state.selection.to)
                  .trim()
              }
              options={{ placement: "top", offset: 8 }}
            >
              <div className="flex items-center gap-0.5 rounded-lg border bg-background p-1 shadow-lg">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Bold selection"
                  onClick={() => editor.chain().focus().toggleBold().run()}
                >
                  <Bold />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Italic selection"
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                >
                  <Italic />
                </Button>
                <LinkDialog
                  editor={editor}
                  active={editor.isActive("link")}
                  disabled={false}
                />
              </div>
            </BubbleMenu>
          ) : null}
        </div>
      </DocumentEditingContext>
    </UploadContext>
  );
}
