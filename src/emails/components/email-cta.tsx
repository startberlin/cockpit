import { Button, Link, Section, Text } from "react-email";

interface EmailCtaProps {
  href: string;
  label: string;
}

export function EmailCta({ href, label }: EmailCtaProps) {
  return (
    <Section className="my-[24px]">
      <Button
        href={href}
        className="bg-[#1C1917] text-white px-[18px] py-[12px] text-[14px] font-bold no-underline"
        style={{ borderRadius: 0 }}
      >
        {label}
      </Button>
      <Text className="mt-[16px] mb-0 text-[12px] text-[#78716C] leading-[18px]">
        If the button does not work, open this link:
        <br />
        <Link href={href} className="text-[#1C1917]">
          {href}
        </Link>
      </Text>
    </Section>
  );
}
