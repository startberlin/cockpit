"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Extension, mergeAttributes, Node } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { type DOMOutputSpec, DOMSerializer } from "@tiptap/pm/model";
import {
  type NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  FileText,
  GripVertical,
  ImagePlus,
  Link2,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { blockSummary } from "../lib/block-summary";
import {
  type Block,
  blockLabel,
  blockSchema,
  type ImageRef,
} from "../lib/blocks";
import { documentText, expandBlock, safeUrl } from "../lib/editor-document";
import { createDocumentIdentityPlugin } from "../lib/editor-identity";
import { uploadNewsletterImage } from "../lib/upload-image";
import { BlockForm } from "./block-forms";
import { useDocumentEditable } from "./document-editing-context";
import { useUploadTracker } from "./upload-context";

export const DocumentIdentity = Extension.create({
  name: "documentIdentity",
  addOptions(): { isUploading: (id: unknown) => boolean } {
    return { isUploading: (_id: unknown) => false };
  },
  addGlobalAttributes() {
    return [
      {
        types: [
          "paragraph",
          "heading",
          "bulletList",
          "orderedList",
          "blockquote",
          "codeBlock",
          "horizontalRule",
          "image",
        ],
        attributes: {
          sourceId: { default: null, rendered: false },
          sourceKind: { default: null, rendered: false },
        },
      },
    ];
  },
  addProseMirrorPlugins() {
    return [createDocumentIdentityPlugin(this.options.isUploading)];
  },
});

function NodeTools({
  props,
  onEdit,
  onExpand,
}: {
  props: NodeViewProps;
  onEdit: () => void;
  onExpand?: () => void;
}) {
  const { editor, getPos, node, deleteNode } = props;
  const editable = useDocumentEditable(editor);
  if (!editable) return null;
  const move = (direction: -1 | 1) => {
    if (!editor.isEditable) return;
    const pos = getPos();
    if (pos === undefined) return;
    const $pos = editor.state.doc.resolve(pos);
    const index = $pos.index();
    const neighbour = editor.state.doc.maybeChild(index + direction);
    if (!neighbour) return;
    const target =
      direction < 0 ? pos - neighbour.nodeSize : pos + neighbour.nodeSize;
    const tr = editor.state.tr
      .delete(pos, pos + node.nodeSize)
      .insert(target, node);
    editor.view.dispatch(tr.scrollIntoView());
  };
  return (
    <div className="document-node-tools" contentEditable={false}>
      <span
        data-drag-handle
        className="cursor-grab p-1 text-muted-foreground"
        title="Drag to move"
      >
        <GripVertical className="size-3.5" />
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Move block up"
        onClick={() => move(-1)}
      >
        <ArrowUp />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Move block down"
        onClick={() => move(1)}
      >
        <ArrowDown />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Edit block"
        disabled={!!node.attrs.uploading}
        onClick={() => {
          if (editor.isEditable) onEdit();
        }}
      >
        <Pencil />
      </Button>
      {onExpand ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Turn block into editable text"
          title="Turn into editable text"
          onClick={() => {
            if (editor.isEditable) onExpand();
          }}
        >
          <FileText />
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Duplicate block"
        disabled={!!node.attrs.uploading}
        onClick={() => {
          if (!editor.isEditable) return;
          const pos = getPos();
          if (pos === undefined) return;
          const copy = node.toJSON();
          copy.attrs = {
            ...copy.attrs,
            sourceId: crypto.randomUUID(),
            ...(copy.attrs?.block
              ? { block: { ...copy.attrs.block, id: crypto.randomUUID() } }
              : {}),
          };
          editor
            .chain()
            .focus()
            .insertContentAt(pos + node.nodeSize, copy)
            .run();
        }}
      >
        <Copy />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Delete block"
        onClick={() => {
          if (editor.isEditable) deleteNode();
        }}
      >
        <Trash2 />
      </Button>
    </div>
  );
}

const imageSettingsSchema = z.object({
  src: z
    .string()
    .trim()
    .refine(
      (value) => !!safeUrl(value, true),
      "Enter a complete HTTP or HTTPS image URL.",
    ),
  alt: z.string().max(1000),
  caption: z.string().max(2000),
  href: z
    .string()
    .trim()
    .refine(
      (value) => !value || !!safeUrl(value),
      "Enter a complete HTTP, HTTPS, email or telephone link.",
    ),
});

function ImageNodeView(props: NodeViewProps) {
  const { node, editor, updateAttributes, getPos } = props;
  const editable = useDocumentEditable(editor);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const uploads = useUploadTracker();
  const src = safeUrl(node.attrs.src, true);
  const form = useForm<z.infer<typeof imageSettingsSchema>>({
    resolver: zodResolver(imageSettingsSchema),
    defaultValues: { src: "", alt: "", caption: "", href: "" },
  });
  const edit = () => {
    form.reset({
      src,
      alt: node.attrs.alt ?? "",
      caption: node.attrs.caption ?? "",
      href: node.attrs.href ?? "",
    });
    setOpen(true);
  };
  const upload = async (file?: File) => {
    if (!file || busy.current || !editor.isEditable) return;
    busy.current = true;
    setUploading(true);
    const finish = uploads?.begin(node.attrs.sourceId);
    updateAttributes({ uploading: true });
    try {
      const image = await uploadNewsletterImage(file);
      if (!editor.isDestroyed && getPos() !== undefined && editor.isEditable)
        updateAttributes({
          src: image.url,
          width: image.width,
          height: image.height,
          uploading: false,
        });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Image upload failed.",
      );
    } finally {
      finish?.();
      busy.current = false;
      setUploading(false);
      if (!editor.isDestroyed && getPos() !== undefined && editor.isEditable)
        updateAttributes({ uploading: false });
    }
  };
  return (
    <NodeViewWrapper
      className={cn(
        "document-image document-node",
        props.selected && "is-selected",
      )}
      contentEditable={false}
    >
      <NodeTools props={props} onEdit={edit} />
      {src ? (
        <button
          type="button"
          className="block w-full text-left"
          disabled={!editable || uploading || node.attrs.uploading}
          aria-label="Edit image"
          onClick={edit}
        >
          {/* biome-ignore lint/performance/noImgElement: editor assets are also served by the local upload route. */}
          <img
            src={src}
            alt={node.attrs.alt ?? ""}
            width={node.attrs.width ?? undefined}
            height={node.attrs.height ?? undefined}
            className="w-full object-contain"
            onLoad={(event) => {
              if (
                !editor.isEditable ||
                node.attrs.width ||
                !event.currentTarget.naturalWidth
              )
                return;
              const pos = getPos();
              if (pos === undefined) return;
              const current = editor.state.doc.nodeAt(pos);
              if (!current || current.attrs.src !== node.attrs.src) return;
              editor.view.dispatch(
                editor.state.tr
                  .setNodeMarkup(pos, undefined, {
                    ...current.attrs,
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  })
                  .setMeta("addToHistory", false),
              );
            }}
          />
        </button>
      ) : (
        <div
          className="document-image-empty"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void upload(event.dataTransfer.files[0]);
          }}
        >
          <div className="flex size-11 items-center justify-center rounded-full bg-background">
            {uploading || node.attrs.uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <ImagePlus className="size-5" />
            )}
          </div>
          <span className="text-sm font-medium">
            {uploading || node.attrs.uploading
              ? "Uploading image"
              : "Give your story a picture"}
          </span>
          <span className="text-xs text-muted-foreground">
            Drop an image here, or paste one into the editor.
          </span>
          <div className="mt-1 flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!editable || uploading || node.attrs.uploading}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus />
              Choose image
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!editable || uploading || node.attrs.uploading}
              onClick={edit}
            >
              <Link2 />
              Image URL
            </Button>
          </div>
        </div>
      )}
      {node.attrs.caption ? (
        <div className="mt-2 text-center text-xs text-muted-foreground">
          {node.attrs.caption}
        </div>
      ) : null}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        aria-label="Upload newsletter image"
        className="hidden"
        onChange={(event) => {
          void upload(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="grid-cols-1">
          <DialogHeader>
            <DialogTitle>Image details</DialogTitle>
            <DialogDescription>
              Add an image URL or replace the image with a file.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid min-w-0 gap-4"
            onSubmit={form.handleSubmit((values) => {
              if (editor.isEditable)
                updateAttributes({
                  ...values,
                  ...(values.src !== src ? { width: null, height: null } : {}),
                });
              setOpen(false);
            })}
          >
            <fieldset
              disabled={!editable || uploading || node.attrs.uploading}
              className="grid min-w-0 gap-4"
            >
              {(
                [
                  ["src", "Image URL", "https://example.com/image.jpg"],
                  [
                    "alt",
                    "Alt text",
                    "Describe the image for readers who cannot see it",
                  ],
                  ["caption", "Caption", "A short caption or image credit"],
                  ["href", "Link on image", "https:// (optional)"],
                ] as const
              ).map(([name, label, placeholder]) => (
                <div key={name} className="grid gap-1.5">
                  <Label htmlFor={`document-image-${name}`}>{label}</Label>
                  <Input
                    id={`document-image-${name}`}
                    placeholder={placeholder}
                    {...form.register(name)}
                    aria-invalid={!!form.formState.errors[name]}
                  />
                  {form.formState.errors[name] ? (
                    <p role="alert" className="text-xs text-destructive">
                      {form.formState.errors[name]?.message}
                    </p>
                  ) : null}
                </div>
              ))}
              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    fileRef.current?.click();
                  }}
                >
                  Replace file
                </Button>
                <Button type="submit">Apply image</Button>
              </DialogFooter>
            </fieldset>
          </form>
        </DialogContent>
      </Dialog>
    </NodeViewWrapper>
  );
}

export const NewsletterImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      caption: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-caption"),
        renderHTML: (attrs) =>
          attrs.caption ? { "data-caption": attrs.caption } : {},
      },
      href: {
        default: "",
        parseHTML: (element) =>
          element.getAttribute("data-href") ??
          element.closest("a")?.getAttribute("href"),
        renderHTML: (attrs) => (attrs.href ? { "data-href": attrs.href } : {}),
      },
      uploading: { default: false, rendered: false },
    };
  },
  parseHTML() {
    return [
      {
        tag: "figure[data-newsletter-image]",
        getAttrs: (element) => {
          const image = element.querySelector("img");
          if (!image) return false;
          return {
            src: image.getAttribute("src"),
            alt: image.getAttribute("alt") ?? "",
            title: image.getAttribute("title"),
            width: Number(image.getAttribute("width")) || null,
            height: Number(image.getAttribute("height")) || null,
            caption: element.querySelector("figcaption")?.textContent ?? "",
            href: element.querySelector("a")?.getAttribute("href") ?? "",
          };
        },
      },
      ...(this.parent?.() ?? []),
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    const image: DOMOutputSpec = [
      "img",
      { ...HTMLAttributes, src: safeUrl(node.attrs.src, true) },
    ];
    const content: DOMOutputSpec = node.attrs.href
      ? ["a", { href: safeUrl(node.attrs.href) }, image]
      : image;
    return [
      "figure",
      { "data-newsletter-image": "" },
      content,
      ...(node.attrs.caption
        ? [["figcaption", node.attrs.caption] as DOMOutputSpec]
        : []),
    ];
  },
  renderMarkdown(node) {
    const escapeMarkdown = (value: unknown) =>
      String(value ?? "").replace(/[\\[\]*_]/g, "\\$&");
    const image = `![${escapeMarkdown(node.attrs?.alt)}](${safeUrl(node.attrs?.src, true)})`;
    const linked = node.attrs?.href
      ? `[${image}](${safeUrl(node.attrs.href)})`
      : image;
    return `${linked}${node.attrs?.caption ? `\n\n${escapeMarkdown(node.attrs.caption)}` : ""}`;
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
}).configure({ allowBase64: false });

function TemplateNodeView(props: NodeViewProps) {
  const block = props.node.attrs.block as Block;
  const [open, setOpen] = useState(false);
  const editable = useDocumentEditable(props.editor);
  let image: ImageRef | undefined;
  if ("image" in block) image = block.image;
  else if ("portrait" in block) image = block.portrait;
  let title = blockSummary(block);
  if ("headline" in block) title = block.headline;
  else if ("title" in block) title = block.title;
  else if ("name" in block) title = block.name;
  let description = "";
  if ("subheadline" in block) description = block.subheadline;
  else if ("body" in block) description = documentText(block.body);
  else if ("items" in block)
    description = block.items
      .map((item) => {
        if ("role" in item) return `${item.role} · ${item.company}`;
        if ("name" in item) return item.name;
        return item.title;
      })
      .filter(Boolean)
      .join("\n");
  return (
    <NodeViewWrapper
      className={cn(
        "document-template document-node",
        props.selected && "is-selected",
      )}
      contentEditable={false}
    >
      <NodeTools
        props={props}
        onEdit={() => setOpen(true)}
        onExpand={
          block.kind !== "button"
            ? () => {
                const pos = props.getPos();
                if (pos === undefined) return;
                props.editor
                  .chain()
                  .focus()
                  .insertContentAt(
                    { from: pos, to: pos + props.node.nodeSize },
                    expandBlock(block),
                  )
                  .run();
              }
            : undefined
        }
      />
      {block.kind === "button" ? (
        <button
          type="button"
          disabled={!editable}
          className={cn(
            "my-3 block bg-brand px-6 py-3 text-sm font-semibold text-white",
            block.align === "center" && "mx-auto",
          )}
          onClick={() => setOpen(true)}
        >
          {block.label || "Add button text"}
          <span aria-hidden="true" className="ml-3">
            ↗
          </span>
        </button>
      ) : (
        <button
          type="button"
          disabled={!editable}
          className="block w-full text-left"
          onClick={() => setOpen(true)}
          aria-label={`Edit ${blockLabel(block.kind)}`}
        >
          {image ? (
            <>
              {/* biome-ignore lint/performance/noImgElement: local and remote newsletter assets. */}
              <img
                src={image.url}
                alt={image.alt}
                className="mb-4 max-h-64 w-full object-cover"
              />
            </>
          ) : null}
          <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {blockLabel(block.kind)}
            <span className="ml-2 text-[#088196]">Template</span>
          </span>
          <span className="block text-xl font-semibold leading-snug text-brand">
            {title || blockLabel(block.kind)}
          </span>
          {"quote" in block && block.quote ? (
            <span className="my-3 block border-l-2 border-brand-accent pl-4 text-lg italic">
              {block.quote}
            </span>
          ) : null}
          <span className="mt-2 block whitespace-pre-line text-sm leading-7 text-muted-foreground">
            {description ||
              "Click to add your content. Use the text icon to make this a freeform section."}
          </span>
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="grid-cols-1 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{blockLabel(block.kind)}</DialogTitle>
            <DialogDescription>
              Your changes appear directly in the newsletter.
            </DialogDescription>
          </DialogHeader>
          <fieldset
            disabled={!editable}
            className="flex min-w-0 flex-col gap-4"
          >
            <BlockForm
              block={block}
              editable={editable}
              onChange={(next) => {
                if (props.editor.isEditable)
                  props.updateAttributes({ block: next });
              }}
            />
          </fieldset>
          <DialogFooter>
            <Button onClick={() => setOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </NodeViewWrapper>
  );
}

export const NewsletterBlock = Node.create({
  name: "newsletterBlock",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { block: { default: null, rendered: false } };
  },
  parseHTML() {
    return [
      {
        tag: "div[data-newsletter-block]",
        getAttrs: (element) => {
          try {
            const parsed = blockSchema.safeParse(
              JSON.parse(element.getAttribute("data-newsletter-block") ?? ""),
            );
            return parsed.success ? { block: parsed.data } : false;
          } catch {
            return false;
          }
        },
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    const block = node.attrs.block as Block;
    const serializer = DOMSerializer.fromSchema(node.type.schema);
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-newsletter-block": JSON.stringify(block),
      }),
      ...expandBlock(block).map((content) =>
        serializer.serializeNode(node.type.schema.nodeFromJSON(content)),
      ),
    ];
  },
  renderMarkdown(node, helpers) {
    const parsed = blockSchema.safeParse(node.attrs?.block);
    return parsed.success
      ? helpers.renderChildren(expandBlock(parsed.data))
      : "";
  },
  addNodeView() {
    return ReactNodeViewRenderer(TemplateNodeView);
  },
});
