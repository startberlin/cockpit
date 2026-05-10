import {
  Body,
  Container,
  Font,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  pixelBasedPreset,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import { env } from "@/env";

interface MembershipApplicationSubmittedEmailProps {
  firstName: string;
}

export const MembershipApplicationSubmittedEmail = ({
  firstName,
}: MembershipApplicationSubmittedEmailProps) => {
  return (
    <Html>
      <Head>
        <Font
          fontFamily="Avenir Next"
          fallbackFontFamily="sans-serif"
          webFont={{
            url: `${env.NEXT_PUBLIC_COCKPIT_URL}/avenirnext-bold.otf`,
            format: "opentype",
          }}
          fontWeight={700}
          fontStyle="bold"
        />
        <Font
          fontFamily="Avenir Next"
          fallbackFontFamily="sans-serif"
          webFont={{
            url: `${env.NEXT_PUBLIC_COCKPIT_URL}/avenirnext-medium.otf`,
            format: "opentype",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Body className="mx-auto my-auto bg-white px-2 font-sans">
          <Preview>We've received your membership application</Preview>
          <Container className="mx-auto my-[40px] max-w-[465px] border border-[#E7E5E4] border-solid p-[20px]">
            <Section className="mt-[10px]">
              <Img
                src={`${env.NEXT_PUBLIC_COCKPIT_URL}/logo-black.png`}
                width="72"
                height="33"
                alt="START Berlin"
                className="my-0"
              />
            </Section>
            <Heading className="mx-0 my-[30px] p-0 font-bold text-[24px] text-black uppercase">
              Application received
            </Heading>
            <Text className="text-[14px] text-black leading-[24px]">
              Hello {firstName},
            </Text>
            <Text className="text-[14px] text-black leading-[24px]">
              We've received your membership application for START Berlin e.V.
              Your application is now being processed.
            </Text>
            <Text className="text-[14px] text-black leading-[24px]">
              A copy of your application documents is attached to this email for
              your records.
            </Text>
            <Text className="text-[14px] text-black leading-[24px]">
              If you have any questions, contact the Operations & Digital
              department:
            </Text>
            <Text className="text-[14px] text-black leading-[24px]">
              <Link href="mailto:operations@start-berlin.com">
                operations@start-berlin.com
              </Link>
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

MembershipApplicationSubmittedEmail.PreviewProps = {
  firstName: "Sönke",
} as MembershipApplicationSubmittedEmailProps;

export default MembershipApplicationSubmittedEmail;
