"use client";

import { type Editor, Extension, type Range } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, {
  exitSuggestion,
  type SuggestionProps,
} from "@tiptap/suggestion";
import {
  CalendarDays,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  LayoutTemplate,
  List,
  ListOrdered,
  Minus,
  MousePointer2,
  Quote,
  Type,
} from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { BLOCK_CATALOG, createBlock } from "../lib/blocks";
import { imageNode } from "../lib/editor-document";

type Command = {
  id: string;
  title: string;
  description: string;
  keywords: string;
  group: string;
  icon: typeof Type;
  run: (editor: Editor, range: Range) => void;
};

const basic = (editor: Editor, range: Range) =>
  editor.chain().focus().deleteRange(range);

const COMMANDS: Command[] = [
  {
    id: "text",
    title: "Text",
    description: "Just start writing",
    keywords: "paragraph absatz text",
    icon: Type,
    group: "Write",
    run: (editor, range) => {
      basic(editor, range).setParagraph().run();
    },
  },
  ...([1, 2, 3] as const).map((level) => ({
    id: `heading-${level}`,
    title: ["Title", "Heading", "Subheading"][level - 1],
    description: [
      "The opening of your story",
      "Start a new section",
      "Give a section more structure",
    ][level - 1],
    keywords: `h${level} heading title überschrift titel`,
    icon: [Heading1, Heading2, Heading3][level - 1],
    group: "Write",
    run: (editor: Editor, range: Range) => {
      basic(editor, range).setHeading({ level }).run();
    },
  })),
  {
    id: "bullet-list",
    title: "Bullet list",
    description: "A few points, easy to scan",
    keywords: "list bullet liste aufzählung",
    icon: List,
    group: "Write",
    run: (editor, range) => {
      basic(editor, range).toggleBulletList().run();
    },
  },
  {
    id: "numbered-list",
    title: "Numbered list",
    description: "One step after another",
    keywords: "list ordered numbered nummeriert",
    icon: ListOrdered,
    group: "Write",
    run: (editor, range) => {
      basic(editor, range).toggleOrderedList().run();
    },
  },
  {
    id: "quote",
    title: "Quote",
    description: "Let a voice stand out",
    keywords: "quote zitat blockquote",
    icon: Quote,
    group: "Write",
    run: (editor, range) => {
      basic(editor, range).setBlockquote().run();
    },
  },
  {
    id: "image",
    title: "Image",
    description: "Upload, drop or link a picture",
    keywords: "image photo picture bild foto",
    icon: ImagePlus,
    group: "Add",
    run: (editor, range) => {
      basic(editor, range)
        .insertContent([imageNode(), { type: "paragraph" }])
        .run();
    },
  },
  {
    id: "button",
    title: "Button",
    description: "One clear call to action",
    keywords: "button cta link knopf",
    icon: MousePointer2,
    group: "Add",
    run: (editor, range) => {
      basic(editor, range)
        .insertContent([
          {
            type: "newsletterBlock",
            attrs: { block: createBlock("button", crypto.randomUUID()) },
          },
          { type: "paragraph" },
        ])
        .run();
    },
  },
  {
    id: "divider",
    title: "Divider",
    description: "A little breathing room",
    keywords: "divider rule line trenner linie",
    icon: Minus,
    group: "Add",
    run: (editor, range) => {
      basic(editor, range).setHorizontalRule().run();
    },
  },
  {
    id: "code",
    title: "Code",
    description: "A formatted code snippet",
    keywords: "code snippet codeblock",
    icon: Code2,
    group: "Add",
    run: (editor, range) => {
      basic(editor, range).setCodeBlock().run();
    },
  },
  ...BLOCK_CATALOG.filter(
    (item) =>
      !["heading", "text", "image", "button", "divider"].includes(item.kind),
  ).map(
    (item): Command => ({
      id: item.kind,
      title: item.label,
      description: item.description,
      keywords: `${item.kind} ${item.label} template vorlage`,
      icon: item.kind === "eventRecap" ? CalendarDays : LayoutTemplate,
      group: "START templates",
      run: (editor, range) => {
        basic(editor, range)
          .insertContent([
            {
              type: "newsletterBlock",
              attrs: { block: createBlock(item.kind, crypto.randomUUID()) },
            },
            { type: "paragraph" },
          ])
          .run();
      },
    }),
  ),
];

interface MenuRef {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

const SlashMenu = forwardRef<MenuRef, SuggestionProps<Command, Command>>(
  function SlashMenu(props, ref) {
    const [selected, setSelected] = useState(0);
    const menuRef = useRef<HTMLDivElement>(null);
    const previousQuery = useRef(props.query);
    const index =
      previousQuery.current === props.query
        ? Math.min(selected, props.items.length - 1)
        : 0;
    useEffect(() => {
      previousQuery.current = props.query;
      setSelected(0);
    }, [props.query]);
    useEffect(() => {
      menuRef.current
        ?.querySelectorAll('[role="option"]')
        [index]?.scrollIntoView({ block: "nearest" });
    }, [index]);
    useImperativeHandle(ref, () => ({
      onKeyDown(event) {
        if (event.key === "Escape") {
          exitSuggestion(props.editor.view);
          return true;
        }
        if (!props.items.length) return event.key === "Enter";
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          setSelected(
            (index + (event.key === "ArrowUp" ? -1 : 1) + props.items.length) %
              props.items.length,
          );
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          props.command(props.items[index]);
          return true;
        }
        return false;
      },
    }));
    return (
      <div className="slash-menu" ref={menuRef}>
        <div className="flex items-center justify-between border-b px-3 py-2.5 text-xs">
          <span className="font-medium">Add to your newsletter</span>
          <kbd className="text-muted-foreground">esc</kbd>
        </div>
        <div
          role="listbox"
          aria-label="Insert a block"
          className="max-h-[min(340px,45vh)] overflow-y-auto overscroll-contain p-1.5"
        >
          {props.items.length ? (
            props.items.map((item, itemIndex) => (
              <div key={item.id}>
                {item.group !== props.items[itemIndex - 1]?.group ? (
                  <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {item.group}
                  </div>
                ) : null}
                <button
                  type="button"
                  role="option"
                  aria-selected={itemIndex === index}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors",
                    itemIndex === index
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted",
                  )}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    // Commit while the editor still owns its selection. A
                    // later click can arrive after the suggestion has closed.
                    props.command(item);
                  }}
                  onClick={(event) => {
                    if (event.detail === 0) props.command(item);
                  }}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded border bg-background">
                    <item.icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      {item.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                </button>
              </div>
            ))
          ) : (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No blocks found. Try "image" or "heading".
            </div>
          )}
        </div>
        <div className="border-t px-3 py-2 text-[10px] text-muted-foreground">
          ↑ ↓ to browse <span className="mx-2">·</span> enter to insert
        </div>
      </div>
    );
  },
);

export const SlashCommands = Extension.create({
  name: "slashCommands",
  addProseMirrorPlugins() {
    return [
      Suggestion<Command, Command>({
        editor: this.editor,
        char: "/",
        startOfLine: true,
        allow: ({ state }) =>
          this.editor.isEditable &&
          state.selection.$from.parent.type.name === "paragraph" &&
          state.selection.$from.depth === 1,
        items: ({ query }) =>
          COMMANDS.filter((item) =>
            `${item.title} ${item.keywords}`
              .toLocaleLowerCase()
              .includes(query.toLocaleLowerCase()),
          ),
        command: ({ editor, range, props }) => {
          if (editor.isEditable) props.run(editor, range);
        },
        render: () => {
          let renderer: ReactRenderer<MenuRef> | undefined;
          let unmount: (() => void) | undefined;
          return {
            onStart: (props) => {
              renderer = new ReactRenderer(SlashMenu, {
                editor: props.editor,
                props,
              });
              unmount = props.mount(renderer.element);
            },
            onUpdate: (props) => renderer?.updateProps(props),
            onKeyDown: ({ event }) => renderer?.ref?.onKeyDown(event) ?? false,
            onExit: () => {
              unmount?.();
              renderer?.destroy();
            },
          };
        },
      }),
    ];
  },
});

export function openSlashMenu(editor: Editor) {
  if (!editor.isEditable) return;
  const { $from } = editor.state.selection;
  if (
    $from.depth === 1 &&
    $from.parent.type.name === "paragraph" &&
    !$from.parent.textContent
  )
    editor.chain().focus().insertContent("/").run();
  else {
    const pos = $from.depth ? $from.after(1) : editor.state.doc.content.size;
    editor
      .chain()
      .focus()
      .insertContentAt(pos, {
        type: "paragraph",
        content: [{ type: "text", text: "/" }],
      })
      .run();
  }
}

export function closeSlashMenu(editor: Editor) {
  exitSuggestion(editor.view);
}
