import { Column, Img, Link, Row, Text } from "react-email";
import { COCKPIT_URL } from "@/emails/components/cockpit-url";

const socialLinks = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/start_berlin",
    icon: "instagram",
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/start-berlin-e-v-",
    icon: "linkedin",
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@start_berlin",
    icon: "tiktok",
  },
] as const;

export function EmailSocialLinks() {
  return (
    <>
      <Text
        style={{
          margin: "0 0 12px",
          fontSize: "16px",
          fontWeight: 700,
          lineHeight: "24px",
          color: "#FFFFFF",
          textAlign: "center",
        }}
      >
        Stay connected
      </Text>
      <Row style={{ tableLayout: "fixed" }}>
        {socialLinks.map(({ label, href, icon }) => (
          <Column key={icon} align="center" width="33.33%">
            <Link
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block",
                padding: "12px 0",
                color: "#FFFFFF",
                fontSize: "12px",
                fontWeight: 700,
                lineHeight: "20px",
                textAlign: "center",
                textDecoration: "none",
              }}
            >
              <Img
                src={`${COCKPIT_URL}/email/social/${icon}.png`}
                width="24"
                height="24"
                alt=""
                style={{ margin: "0 auto" }}
              />
              <span style={{ display: "block", marginTop: "8px" }}>
                {label}
              </span>
            </Link>
          </Column>
        ))}
      </Row>
    </>
  );
}
