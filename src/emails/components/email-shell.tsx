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

interface EmailShellProps {
  preview: string;
  eyebrow?: string;
  footerAudience?: "member" | "board";
  receivingReason?: string;
  children: ReactNode;
}

export function EmailShell({
  preview,
  eyebrow,
  footerAudience = "member",
  receivingReason,
  children,
}: EmailShellProps) {
  const defaultReason =
    footerAudience === "board"
      ? "You're receiving this because you're a board member of START Berlin."
      : "You're receiving this because you're a member of START Berlin.";
  const resolvedReason = receivingReason ?? defaultReason;

  return (
    <Html>
      <Head>
        <Font
          fontFamily="Avenir Next"
          fallbackFontFamily="sans-serif"
          webFont={{
            url: `${COCKPIT_URL}/avenirnext-bold.otf`,
            format: "opentype",
          }}
          fontWeight={700}
          fontStyle="normal"
        />
        <Font
          fontFamily="Avenir Next"
          fallbackFontFamily="sans-serif"
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
          className="bg-[#F5F5F4] font-sans"
          style={{ margin: 0, padding: "40px 16px" }}
        >
          <Preview>{preview}</Preview>
          <Container className="mx-auto max-w-[600px] bg-white">
            {/* Dark header */}
            <Row>
              <Column
                style={{ backgroundColor: "#0A0F2C", padding: "28px 40px" }}
              >
                <Img
                  src={`${COCKPIT_URL}/logo-white.png`}
                  width="72"
                  height="33"
                  alt="START Berlin"
                  className="my-0"
                />
                {eyebrow ? (
                  <Text
                    className="mt-[8px] mb-0 text-[11px] font-bold uppercase leading-[16px]"
                    style={{
                      color: "rgba(255,255,255,0.7)",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {eyebrow}
                  </Text>
                ) : null}
              </Column>
            </Row>

            {/* Body content */}
            <Row>
              <Column style={{ padding: "32px 40px" }}>{children}</Column>
            </Row>

            {/* Footer */}
            <Row>
              <Column
                style={{
                  padding: "24px 40px",
                  borderTop: "1px solid #E7E5E4",
                }}
              >
                <Text className="mt-0 mb-[12px] text-[12px] text-[#78716C] leading-[20px]">
                  {resolvedReason}
                </Text>
                <Text className="mt-0 mb-0 text-[11px] text-[#78716C] leading-[18px]">
                  START Berlin e.V. · Luisenstraße 53 · c/o HU-Gründerhaus ·
                  10117 Berlin
                  <br />
                  Vereinsregister VR 32262 B · Amtsgericht Charlottenburg,
                  Berlin
                </Text>
                <Text className="mt-[8px] mb-0 text-[11px] text-[#78716C] leading-[18px]">
                  <Link href={COCKPIT_URL} className="text-[#1C1917] underline">
                    Open START Cockpit
                  </Link>
                </Text>
              </Column>
            </Row>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
