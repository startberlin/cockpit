import { Button, Link, Section, Text } from "react-email";
import { withUtm } from "@/emails/components/utm";

interface EmailCtaProps {
  href: string;
  label: string;
  campaign: string;
  isReminder?: boolean;
}

export function EmailCta({ href, label, campaign, isReminder }: EmailCtaProps) {
  const buttonHref = withUtm(href, { campaign, content: "button", isReminder });
  const linkHref = withUtm(href, { campaign, content: "link", isReminder });

  return (
    <Section className="my-[24px]">
      <Button
        href={buttonHref}
        className="bg-[#1C1917] text-white px-[18px] py-[12px] text-[14px] font-bold no-underline"
        style={{ borderRadius: 0 }}
      >
        {label}
      </Button>
      <Text className="mt-[16px] mb-0 text-[12px] text-[#78716C] leading-[18px]">
        If the button does not work, open this link:
        <br />
        <Link href={linkHref} className="text-[#1C1917]">
          {href}
        </Link>
      </Text>
    </Section>
  );
}
