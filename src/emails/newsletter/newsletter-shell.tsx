import type { ReactNode } from "react";
import {
  Body,
  Column,
  Container,
  Font,
  Head,
  Html,
  Img,
  Link,
  Preview,
  pixelBasedPreset,
  Row,
  Tailwind,
  Text,
} from "react-email";
import { COCKPIT_URL } from "@/emails/components/cockpit-url";
import { brand, CONTAINER_WIDTH, FONT_STACK, GUTTER } from "./newsletter-theme";

/**
 * Resend interpolates this at send time, per recipient. It must survive
 * rendering verbatim — React escapes `<`, `>` and `&`, but not braces, so a
 * literal in JSX text or in an `href` comes out intact. There is a render test
 * asserting exactly that, because a silently escaped unsubscribe link would be
 * both a broken issue and a legal problem.
 *
 * Only valid in a Broadcast. The `/emails` endpoint used for test sends does not
 * interpolate, so `substituteMergeTags` swaps in sample values there.
 */
export const UNSUBSCRIBE_URL_TAG = "{{{RESEND_UNSUBSCRIBE_URL}}}";

interface NewsletterShellProps {
  title: string;
  /** Inbox preview line. Falls back to the subject when the author leaves it blank. */
  preview: string;
  /** Small label above the masthead, e.g. "Issue 01 · October 2026". */
  eyebrow?: string;
  children: ReactNode;
}

export function NewsletterShell({
  title,
  preview,
  eyebrow,
  children,
}: NewsletterShellProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <title>{title}</title>
        <Font
          fontFamily="Avenir Next"
          fallbackFontFamily="Helvetica"
          webFont={{
            url: `${COCKPIT_URL}/avenirnext-bold.otf`,
            format: "opentype",
          }}
          fontWeight={700}
          fontStyle="normal"
        />
        <Font
          fontFamily="Avenir Next"
          fallbackFontFamily="Helvetica"
          webFont={{
            url: `${COCKPIT_URL}/avenirnext-medium.otf`,
            format: "opentype",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Body
          lang="en"
          dir="ltr"
          style={{
            margin: 0,
            padding: "32px 12px",
            backgroundColor: brand.page,
            fontFamily: FONT_STACK,
          }}
        >
          <Preview>{preview}</Preview>
          <Container
            style={{
              margin: "0 auto",
              maxWidth: `${CONTAINER_WIDTH}px`,
              backgroundColor: brand.surface,
            }}
          >
            {/* Masthead */}
            <Row>
              <Column
                style={{
                  backgroundColor: brand.navy,
                  padding: `28px ${GUTTER}px 24px`,
                }}
              >
                <Img
                  src={`${COCKPIT_URL}/logo-white.png`}
                  width="84"
                  height="38"
                  alt="START Berlin"
                  style={{ margin: 0, display: "block" }}
                />
                {eyebrow ? (
                  <Text
                    style={{
                      margin: "14px 0 0",
                      fontSize: "11px",
                      lineHeight: "16px",
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: brand.cyan,
                    }}
                  >
                    {eyebrow}
                  </Text>
                ) : null}
              </Column>
            </Row>
            {/* Accent rule — the one piece of colour that carries the brand */}
            <Row>
              <Column style={{ height: "4px", backgroundColor: brand.cyan }} />
            </Row>

            <Row>
              <Column style={{ padding: `32px ${GUTTER}px 8px` }}>
                {children}
              </Column>
            </Row>

            {/* Footer */}
            <Row>
              <Column
                style={{
                  padding: `24px ${GUTTER}px 28px`,
                  backgroundColor: brand.surfaceAlt,
                  borderTop: `1px solid ${brand.rule}`,
                }}
              >
                <Text
                  style={{
                    margin: "0 0 12px",
                    fontSize: "12px",
                    lineHeight: "20px",
                    color: brand.muted,
                  }}
                >
                  You are receiving this because you subscribed to the START
                  Berlin newsletter.{" "}
                  <Link
                    href={UNSUBSCRIBE_URL_TAG}
                    style={{
                      color: brand.navySoft,
                      textDecoration: "underline",
                    }}
                  >
                    Manage your preferences or unsubscribe
                  </Link>
                  .
                </Text>
                <Text
                  style={{
                    margin: 0,
                    fontSize: "11px",
                    lineHeight: "18px",
                    color: brand.faint,
                  }}
                >
                  START Berlin e.V. · Luisenstraße 53 · c/o HU-Gründerhaus ·
                  10117 Berlin
                  <br />
                  Vereinsregister VR 32262 B · Amtsgericht Charlottenburg,
                  Berlin
                </Text>
              </Column>
            </Row>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
