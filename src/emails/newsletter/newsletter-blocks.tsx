import type { ComponentProps, CSSProperties } from "react";
import { Column, Hr, Img, Link, Row, Section, Text } from "react-email";
import type {
  Block,
  BlockOfKind,
  ImageRef,
} from "@/internal-apps/newsletter/lib/blocks";
import { safeUrl } from "@/internal-apps/newsletter/lib/editor-document";
import { brand, CONTAINER_WIDTH, GUTTER } from "./newsletter-theme";
import { isRichTextEmpty, RichText } from "./rich-text";

/**
 * One renderer per block kind. Everything is inline styles and table layout:
 * Outlook still renders with Word's HTML engine, which ignores most modern CSS.
 *
 * Every block is defensive about missing content — the editor saves
 * continuously, so half-filled blocks are the normal state of a draft and the
 * preview has to stay readable while someone is still typing.
 */

/** Content width inside the shell's gutters. Images are sized against this. */
const INNER_WIDTH = CONTAINER_WIDTH - GUTTER * 2;

function SafeLink(props: ComponentProps<typeof Link>) {
  const href = safeUrl(props.href);
  return href ? <Link {...props} href={href} /> : props.children;
}

function SafeImage(props: ComponentProps<typeof Img>) {
  const src = safeUrl(props.src, true);
  return src ? <Img {...props} src={src} /> : null;
}

const metaText: CSSProperties = {
  margin: "0 0 6px",
  fontSize: "11px",
  lineHeight: "16px",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: brand.cyan,
};

function SectionHeading({ children }: { children: string }) {
  if (!children) return null;
  return (
    <>
      <Text
        style={{
          margin: "0 0 6px",
          fontSize: "20px",
          lineHeight: "28px",
          fontWeight: 700,
          color: brand.navy,
        }}
      >
        {children}
      </Text>
      <div
        style={{
          width: "36px",
          height: "3px",
          backgroundColor: brand.cyan,
          marginBottom: "18px",
        }}
      />
    </>
  );
}

function Tag({ label }: { label: string }) {
  if (!label) return null;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        backgroundColor: brand.surfaceAlt,
        border: `1px solid ${brand.rule}`,
        fontSize: "11px",
        lineHeight: "16px",
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: brand.navySoft,
      }}
    >
      {label}
    </span>
  );
}

function ReadMore({ href, label }: { href: string; label: string }) {
  if (!safeUrl(href)) return null;
  return (
    <Text style={{ margin: "0 0 4px", fontSize: "14px", lineHeight: "22px" }}>
      <SafeLink
        href={href}
        style={{
          color: brand.navySoft,
          fontWeight: 700,
          textDecoration: "underline",
        }}
      >
        {label} →
      </SafeLink>
    </Text>
  );
}

/**
 * Emails cannot rely on CSS aspect ratios, so height is computed from the
 * stored intrinsic size when we have it and left to the client when we do not.
 */
function scaledHeight(image: ImageRef, width: number): number | undefined {
  if (!image.width || !image.height) return undefined;
  return Math.max(1, Math.round((image.height / image.width) * width));
}

function BlockImage({
  image,
  width = INNER_WIDTH,
}: {
  image: ImageRef;
  width?: number;
}) {
  const height = scaledHeight(image, width);
  return (
    <SafeImage
      src={image.url}
      alt={image.alt}
      width={String(width)}
      height={height === undefined ? undefined : String(height)}
      style={{
        display: "block",
        width: "100%",
        maxWidth: `${width}px`,
        height: "auto",
        border: 0,
      }}
    />
  );
}

// --- individual blocks ------------------------------------------------------

function HeroBlock({ block }: { block: BlockOfKind<"hero"> }) {
  return (
    <Section style={{ marginBottom: "28px" }}>
      {block.image ? (
        <div style={{ marginBottom: "20px" }}>
          <BlockImage image={block.image} />
        </div>
      ) : null}
      {block.eyebrow ? <Text style={metaText}>{block.eyebrow}</Text> : null}
      {block.headline ? (
        <Text
          style={{
            margin: "0 0 10px",
            fontSize: "28px",
            lineHeight: "36px",
            fontWeight: 700,
            color: brand.navy,
          }}
        >
          {block.headline}
        </Text>
      ) : null}
      {block.subheadline ? (
        <Text
          style={{
            margin: 0,
            fontSize: "17px",
            lineHeight: "27px",
            color: brand.muted,
          }}
        >
          {block.subheadline}
        </Text>
      ) : null}
    </Section>
  );
}

function HeadingBlock({ block }: { block: BlockOfKind<"heading"> }) {
  if (!block.text) return null;
  const isMajor = block.level === 2;
  return (
    <Section style={{ marginBottom: isMajor ? "18px" : "12px" }}>
      {isMajor ? (
        <SectionHeading>{block.text}</SectionHeading>
      ) : (
        <Text
          style={{
            margin: "8px 0 8px",
            fontSize: "17px",
            lineHeight: "26px",
            fontWeight: 700,
            color: brand.navy,
          }}
        >
          {block.text}
        </Text>
      )}
    </Section>
  );
}

function TextBlock({ block }: { block: BlockOfKind<"text"> }) {
  if (isRichTextEmpty(block.body)) return null;
  return (
    <Section style={{ marginBottom: "12px" }}>
      <RichText doc={block.body} />
    </Section>
  );
}

function ImageBlock({ block }: { block: BlockOfKind<"image"> }) {
  if (!block.image) return null;
  const img = <BlockImage image={block.image} />;
  return (
    <Section style={{ marginBottom: "24px" }}>
      {block.href ? <SafeLink href={block.href}>{img}</SafeLink> : img}
      {block.caption ? (
        <Text
          style={{
            margin: "8px 0 0",
            fontSize: "13px",
            lineHeight: "20px",
            color: brand.faint,
          }}
        >
          {block.caption}
        </Text>
      ) : null}
    </Section>
  );
}

function ButtonBlock({ block }: { block: BlockOfKind<"button"> }) {
  if (!block.label || !safeUrl(block.href)) return null;
  return (
    <Section
      style={{
        marginBottom: "28px",
        textAlign: block.align as "left" | "center",
      }}
    >
      {/* Anchor rather than react-email's <Button>: square, brand-coloured, and
          Outlook-safe with explicit padding. */}
      <SafeLink
        href={block.href}
        style={{
          display: "inline-block",
          padding: "14px 24px",
          backgroundColor: brand.navy,
          color: brand.white,
          fontSize: "15px",
          fontWeight: 700,
          textDecoration: "none",
          borderRadius: 0,
        }}
      >
        {block.label}
      </SafeLink>
    </Section>
  );
}

function DividerBlock() {
  return (
    <Hr
      style={{
        margin: "8px 0 28px",
        border: "none",
        borderTop: `1px solid ${brand.rule}`,
      }}
    />
  );
}

function LinkListBlock({ block }: { block: BlockOfKind<"linkList"> }) {
  const items = block.items.filter((i) => i.title || i.url);
  if (!items.length) return null;

  return (
    <Section style={{ marginBottom: "28px" }}>
      <SectionHeading>{block.title}</SectionHeading>
      {items.map((item, i) => (
        <div
          key={`link-${i}`}
          style={{
            paddingBottom: "14px",
            marginBottom: "14px",
            borderBottom:
              i === items.length - 1 ? "none" : `1px solid ${brand.rule}`,
          }}
        >
          {item.source ? <Text style={metaText}>{item.source}</Text> : null}
          <Text
            style={{
              margin: "0 0 4px",
              fontSize: "16px",
              lineHeight: "24px",
              fontWeight: 700,
              color: brand.navy,
            }}
          >
            {item.url ? (
              <SafeLink
                href={item.url}
                style={{ color: brand.navy, textDecoration: "none" }}
              >
                {item.title}
              </SafeLink>
            ) : (
              item.title
            )}
          </Text>
          {item.blurb ? (
            <Text
              style={{
                margin: 0,
                fontSize: "14px",
                lineHeight: "22px",
                color: brand.muted,
              }}
            >
              {item.blurb}
            </Text>
          ) : null}
        </div>
      ))}
    </Section>
  );
}

function StartupSpotlightBlock({
  block,
}: {
  block: BlockOfKind<"startupSpotlight">;
}) {
  const items = block.items.filter((i) => i.name || i.oneLiner);
  if (!items.length) return null;

  // Reserve the logo column for the whole section as soon as one entry has a
  // logo. Per-item columns would leave the list ragged, which reads as a
  // mistake rather than as a design.
  const withLogos = items.some((i) => i.logo);

  return (
    <Section style={{ marginBottom: "28px" }}>
      <SectionHeading>{block.title}</SectionHeading>
      {items.map((item, i) => (
        <Row
          key={`startup-${i}`}
          style={{
            marginBottom: i === items.length - 1 ? 0 : "16px",
          }}
        >
          {withLogos ? (
            <Column
              width={64}
              style={{ verticalAlign: "top", paddingRight: "16px" }}
            >
              {item.logo ? (
                <SafeImage
                  src={item.logo.url}
                  alt={item.logo.alt || item.name}
                  width="48"
                  height="48"
                  style={{
                    display: "block",
                    border: `1px solid ${brand.rule}`,
                    objectFit: "contain",
                    backgroundColor: brand.white,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    border: `1px solid ${brand.rule}`,
                    backgroundColor: brand.surfaceAlt,
                  }}
                />
              )}
            </Column>
          ) : null}
          <Column style={{ verticalAlign: "top" }}>
            <Text
              style={{
                margin: "0 0 4px",
                fontSize: "16px",
                lineHeight: "24px",
                fontWeight: 700,
                color: brand.navy,
              }}
            >
              {item.url ? (
                <SafeLink
                  href={item.url}
                  style={{ color: brand.navy, textDecoration: "none" }}
                >
                  {item.name}
                </SafeLink>
              ) : (
                item.name
              )}
              {item.tag ? (
                <>
                  {"  "}
                  <Tag label={item.tag} />
                </>
              ) : null}
            </Text>
            {item.oneLiner ? (
              <Text
                style={{
                  margin: 0,
                  fontSize: "14px",
                  lineHeight: "22px",
                  color: brand.muted,
                }}
              >
                {item.oneLiner}
              </Text>
            ) : null}
          </Column>
        </Row>
      ))}
    </Section>
  );
}

function EventRecapBlock({ block }: { block: BlockOfKind<"eventRecap"> }) {
  const hasContent =
    block.title || block.image || !isRichTextEmpty(block.body) || block.ctaHref;
  if (!hasContent) return null;

  return (
    <Section style={{ marginBottom: "28px" }}>
      {block.image ? (
        <div style={{ marginBottom: "16px" }}>
          <BlockImage image={block.image} />
        </div>
      ) : null}
      {block.dateLabel ? <Text style={metaText}>{block.dateLabel}</Text> : null}
      {block.title ? (
        <Text
          style={{
            margin: "0 0 10px",
            fontSize: "20px",
            lineHeight: "28px",
            fontWeight: 700,
            color: brand.navy,
          }}
        >
          {block.title}
        </Text>
      ) : null}
      <RichText doc={block.body} />
      <ReadMore href={block.ctaHref} label={block.ctaLabel || "Read more"} />
    </Section>
  );
}

function InterviewBlock({ block }: { block: BlockOfKind<"interview"> }) {
  const hasContent = block.name || block.quote || !isRichTextEmpty(block.body);
  if (!hasContent) return null;

  const roleLine = [block.role, block.company].filter(Boolean).join(" · ");

  return (
    <Section
      style={{
        marginBottom: "28px",
        padding: "24px",
        backgroundColor: brand.surfaceAlt,
        border: `1px solid ${brand.rule}`,
      }}
    >
      <Row style={{ marginBottom: "16px" }}>
        {block.portrait ? (
          <Column
            width={72}
            style={{ verticalAlign: "middle", paddingRight: "16px" }}
          >
            <SafeImage
              src={block.portrait.url}
              alt={block.portrait.alt || block.name}
              width="56"
              height="56"
              style={{
                display: "block",
                borderRadius: "28px",
                objectFit: "cover",
              }}
            />
          </Column>
        ) : null}
        <Column style={{ verticalAlign: "middle" }}>
          <Text style={metaText}>Interview</Text>
          <Text
            style={{
              margin: "0 0 2px",
              fontSize: "17px",
              lineHeight: "24px",
              fontWeight: 700,
              color: brand.navy,
            }}
          >
            {block.name}
          </Text>
          {roleLine ? (
            <Text
              style={{
                margin: 0,
                fontSize: "13px",
                lineHeight: "20px",
                color: brand.muted,
              }}
            >
              {roleLine}
            </Text>
          ) : null}
        </Column>
      </Row>

      {block.quote ? (
        <div
          style={{
            paddingLeft: "16px",
            borderLeft: `3px solid ${brand.cyan}`,
            marginBottom: "16px",
          }}
        >
          <Text
            style={{
              margin: 0,
              fontSize: "18px",
              lineHeight: "28px",
              fontWeight: 700,
              color: brand.navy,
            }}
          >
            “{block.quote}”
          </Text>
        </div>
      ) : null}

      <RichText doc={block.body} />
      <ReadMore href={block.href} label="Read the full interview" />
    </Section>
  );
}

function AlumniStoryBlock({ block }: { block: BlockOfKind<"alumniStory"> }) {
  const hasContent =
    block.name || block.headline || !isRichTextEmpty(block.body);
  if (!hasContent) return null;

  return (
    <Section style={{ marginBottom: "28px" }}>
      <Row style={{ marginBottom: "12px" }}>
        {block.portrait ? (
          <Column
            width={72}
            style={{ verticalAlign: "middle", paddingRight: "16px" }}
          >
            <SafeImage
              src={block.portrait.url}
              alt={block.portrait.alt || block.name}
              width="56"
              height="56"
              style={{
                display: "block",
                borderRadius: "28px",
                objectFit: "cover",
              }}
            />
          </Column>
        ) : null}
        <Column style={{ verticalAlign: "middle" }}>
          <Text style={metaText}>Alumni story</Text>
          <Text
            style={{
              margin: "0 0 2px",
              fontSize: "17px",
              lineHeight: "24px",
              fontWeight: 700,
              color: brand.navy,
            }}
          >
            {block.name}
            {block.batchLabel ? (
              <>
                {"  "}
                <Tag label={block.batchLabel} />
              </>
            ) : null}
          </Text>
        </Column>
      </Row>
      {block.headline ? (
        <Text
          style={{
            margin: "0 0 8px",
            fontSize: "18px",
            lineHeight: "27px",
            fontWeight: 700,
            color: brand.navy,
          }}
        >
          {block.headline}
        </Text>
      ) : null}
      <RichText doc={block.body} />
      <ReadMore href={block.href} label="Read the story" />
    </Section>
  );
}

function JobHighlightBlock({ block }: { block: BlockOfKind<"jobHighlight"> }) {
  const items = block.items.filter((i) => i.company || i.role);
  if (!items.length) return null;

  const withLogos = items.some((i) => i.logo);

  return (
    <Section style={{ marginBottom: "28px" }}>
      <SectionHeading>{block.title}</SectionHeading>
      {items.map((item, i) => (
        <Row
          key={`job-${i}`}
          style={{
            marginBottom: i === items.length - 1 ? 0 : "12px",
          }}
        >
          {withLogos ? (
            <Column
              width={56}
              style={{ verticalAlign: "top", paddingRight: "14px" }}
            >
              {item.logo ? (
                <SafeImage
                  src={item.logo.url}
                  alt={item.logo.alt || item.company}
                  width="40"
                  height="40"
                  style={{
                    display: "block",
                    border: `1px solid ${brand.rule}`,
                    objectFit: "contain",
                    backgroundColor: brand.white,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    border: `1px solid ${brand.rule}`,
                    backgroundColor: brand.surfaceAlt,
                  }}
                />
              )}
            </Column>
          ) : null}
          <Column style={{ verticalAlign: "top" }}>
            <Text
              style={{
                margin: "0 0 2px",
                fontSize: "15px",
                lineHeight: "23px",
                fontWeight: 700,
                color: brand.navy,
              }}
            >
              {item.url ? (
                <SafeLink
                  href={item.url}
                  style={{ color: brand.navy, textDecoration: "none" }}
                >
                  {item.role || "Open role"}
                </SafeLink>
              ) : (
                item.role || "Open role"
              )}
            </Text>
            <Text
              style={{
                margin: 0,
                fontSize: "13px",
                lineHeight: "20px",
                color: brand.muted,
              }}
            >
              {[item.company, item.location].filter(Boolean).join(" · ")}
            </Text>
          </Column>
        </Row>
      ))}
    </Section>
  );
}

// --- dispatcher -------------------------------------------------------------

export function NewsletterBlock({ block }: { block: Block }) {
  switch (block.kind) {
    case "hero":
      return <HeroBlock block={block} />;
    case "heading":
      return <HeadingBlock block={block} />;
    case "text":
      return <TextBlock block={block} />;
    case "image":
      return <ImageBlock block={block} />;
    case "button":
      return <ButtonBlock block={block} />;
    case "divider":
      return <DividerBlock />;
    case "linkList":
      return <LinkListBlock block={block} />;
    case "startupSpotlight":
      return <StartupSpotlightBlock block={block} />;
    case "eventRecap":
      return <EventRecapBlock block={block} />;
    case "interview":
      return <InterviewBlock block={block} />;
    case "alumniStory":
      return <AlumniStoryBlock block={block} />;
    case "jobHighlight":
      return <JobHighlightBlock block={block} />;
  }
}
