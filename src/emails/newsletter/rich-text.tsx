import type { CSSProperties, ReactNode } from "react";
import { Hr, Img, Link, Text } from "react-email";
import type {
  RichTextDoc,
  RichTextNode,
} from "@/internal-apps/newsletter/lib/blocks";
import { safeUrl } from "@/internal-apps/newsletter/lib/editor-document";
import {
  inlineTextStyle,
  textAlignment,
  textColor,
} from "@/internal-apps/newsletter/lib/rich-text-style";
import { brand, CONTAINER_WIDTH, GUTTER } from "./newsletter-theme";

const INNER_WIDTH = CONTAINER_WIDTH - 2 * GUTTER;

/**
 * Renders the editor's ProseMirror/Tiptap document to email-safe markup.
 *
 * Deliberately a whitelist: node and mark types we do not know are rendered as
 * their plain text rather than dropped or thrown on. A newsletter that silently
 * loses a paragraph is worse than one that loses its italics, and an issue that
 * fails to render at all is worst of all.
 */

const paragraphStyle: CSSProperties = {
  margin: "0 0 16px",
  fontSize: "16px",
  lineHeight: "26px",
  color: brand.inkSoft,
};

const listStyle: CSSProperties = {
  margin: "0 0 16px",
  paddingLeft: "22px",
  fontSize: "16px",
  lineHeight: "26px",
  color: brand.inkSoft,
};

function renderInline(nodes: RichTextNode[] | undefined): ReactNode {
  if (!nodes?.length) return null;

  return nodes.map((node, i) => {
    const key = `${node.type}-${i}`;

    if (node.type === "hardBreak") {
      return <br key={key} />;
    }

    if (node.type !== "text" || node.text === undefined) {
      // Unknown inline node: fall back to whatever text it contains.
      return <span key={key}>{renderInline(node.content)}</span>;
    }

    let out: ReactNode = node.text;

    for (const mark of node.marks ?? []) {
      switch (mark.type) {
        case "bold":
          out = <strong style={{ fontWeight: 700 }}>{out}</strong>;
          break;
        case "italic":
          out = <em>{out}</em>;
          break;
        case "strike":
          out = <s>{out}</s>;
          break;
        case "underline":
          out = <u>{out}</u>;
          break;
        case "textStyle":
          out = <span style={inlineTextStyle(mark.attrs)}>{out}</span>;
          break;
        case "highlight":
          out = (
            <mark
              style={{
                backgroundColor: textColor(mark.attrs?.color) ?? "#FEF08A",
                color: "inherit",
              }}
            >
              {out}
            </mark>
          );
          break;
        case "code":
          out = (
            <code
              style={{
                backgroundColor: brand.surfaceAlt,
                padding: "1px 4px",
                fontSize: "14px",
              }}
            >
              {out}
            </code>
          );
          break;
        case "link": {
          const href = safeUrl(mark.attrs?.href);
          if (!href) break;
          out = (
            <Link
              href={href}
              style={{ color: brand.navySoft, textDecoration: "underline" }}
            >
              {out}
            </Link>
          );
          break;
        }
        default:
          break;
      }
    }

    return <span key={key}>{out}</span>;
  });
}

function renderBlockNode(node: RichTextNode, key: string): ReactNode {
  switch (node.type) {
    case "paragraph": {
      // Tiptap emits an empty paragraph for a blank line. Rendering it as an
      // empty <p> would collapse in some clients, so give it a real height.
      if (!node.content?.length) {
        return <Text key={key} style={{ ...paragraphStyle, height: "8px" }} />;
      }
      return (
        <Text
          key={key}
          style={{
            ...paragraphStyle,
            textAlign: textAlignment(node.attrs?.textAlign),
          }}
        >
          {renderInline(node.content)}
        </Text>
      );
    }

    case "heading": {
      const level = Number(node.attrs?.level ?? 3);
      return (
        <Text
          key={key}
          style={{
            margin: "24px 0 8px",
            fontSize: level === 1 ? "28px" : level === 2 ? "22px" : "18px",
            lineHeight: level === 1 ? "36px" : "28px",
            fontWeight: 700,
            color: brand.navy,
            textAlign: textAlignment(node.attrs?.textAlign),
          }}
        >
          {renderInline(node.content)}
        </Text>
      );
    }

    case "bulletList":
    case "orderedList": {
      const Tag = node.type === "bulletList" ? "ul" : "ol";
      return (
        <Tag
          key={key}
          style={listStyle}
          {...(node.type === "orderedList" && Number(node.attrs?.start) > 1
            ? { start: Number(node.attrs?.start) }
            : {})}
        >
          {(node.content ?? []).map((item, i) => (
            <li key={`li-${i}`} style={{ marginBottom: "6px" }}>
              {(item.content ?? []).map((child, j) =>
                child.type === "paragraph" ? (
                  <span key={`p-${j}`}>
                    {j > 0 ? <br /> : null}
                    {renderInline(child.content)}
                  </span>
                ) : (
                  renderBlockNode(child, `n-${j}`)
                ),
              )}
            </li>
          ))}
        </Tag>
      );
    }

    case "blockquote":
      return (
        <div
          key={key}
          style={{
            margin: "0 0 16px",
            paddingLeft: "16px",
            borderLeft: `3px solid ${brand.cyan}`,
          }}
        >
          {(node.content ?? []).map((child, i) =>
            renderBlockNode(child, `q-${i}`),
          )}
        </div>
      );

    case "horizontalRule":
      return (
        <Hr key={key} style={{ borderColor: brand.rule, margin: "24px 0" }} />
      );

    case "codeBlock":
      return (
        <pre
          key={key}
          style={{
            padding: "16px",
            backgroundColor: brand.surfaceAlt,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            fontSize: "14px",
            lineHeight: "22px",
          }}
        >
          <code>
            {(node.content ?? []).map((child) => child.text ?? "").join("")}
          </code>
        </pre>
      );

    case "image": {
      const src = safeUrl(node.attrs?.src, true);
      if (!src) return null;
      const width = Number(node.attrs?.width);
      const height = Number(node.attrs?.height);
      const scaledHeight =
        width > 0 &&
        height > 0 &&
        Number.isFinite(width) &&
        Number.isFinite(height)
          ? Math.max(1, Math.round((height / width) * INNER_WIDTH))
          : undefined;
      const image = (
        <Img
          src={src}
          alt={String(node.attrs?.alt ?? "")}
          width={String(INNER_WIDTH)}
          height={scaledHeight === undefined ? undefined : String(scaledHeight)}
          style={{
            width: "100%",
            maxWidth: `${INNER_WIDTH}px`,
            height: "auto",
            margin: "16px 0",
          }}
        />
      );
      const href = safeUrl(node.attrs?.href);
      return (
        <div key={key}>
          {href ? <Link href={href}>{image}</Link> : image}
          {node.attrs?.caption ? (
            <Text
              style={{
                ...paragraphStyle,
                fontSize: "13px",
                color: brand.muted,
              }}
            >
              {String(node.attrs.caption)}
            </Text>
          ) : null}
        </div>
      );
    }

    default:
      return node.content?.length ? (
        <Text key={key} style={paragraphStyle}>
          {renderInline(node.content)}
        </Text>
      ) : null;
  }
}

export function isRichTextEmpty(doc: RichTextDoc | undefined): boolean {
  if (!doc?.content?.length) return true;
  return !doc.content.some((node) =>
    node.type === "paragraph" ? !!node.content?.length : true,
  );
}

export function RichText({ doc }: { doc: RichTextDoc }) {
  if (isRichTextEmpty(doc)) return null;
  return <>{doc.content.map((node, i) => renderBlockNode(node, `b-${i}`))}</>;
}
