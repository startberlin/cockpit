import {
  Body,
  Button,
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

interface MembershipApplicationReadyEmailProps {
  firstName: string;
  applicationUrl: string;
}

export const MembershipApplicationReadyEmail = ({
  firstName,
  applicationUrl,
}: MembershipApplicationReadyEmailProps) => {
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
          <Preview>Submit your START Berlin membership application</Preview>
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
              Complete your membership application
            </Heading>
            <Text className="text-[14px] text-black leading-[24px]">
              Hello {firstName},
            </Text>
            <Text className="text-[14px] text-black leading-[24px]">
              The board has approved your admission to START Berlin e.V. You can
              now submit your membership application to complete the process.
            </Text>
            <Text className="text-[14px] text-black leading-[24px]">
              Open START Cockpit to fill in your details and sign the
              application. Once you submit it, the board will finalize your
              admission.
            </Text>
            <Section className="my-[24px]">
              <Button
                href={applicationUrl}
                className="bg-black text-white px-[18px] py-[12px] text-[14px] font-bold no-underline"
              >
                Submit application
              </Button>
              <Text className="text-[12px] text-[#57534E] leading-[18px] mt-[16px] mb-0">
                If the button does not work, open this link:
                <br />
                <Link href={applicationUrl}>{applicationUrl}</Link>
              </Text>
            </Section>
            <Text className="text-[14px] text-black leading-[24px]">
              If you run into any issues, contact the Operations & Digital
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

MembershipApplicationReadyEmail.PreviewProps = {
  firstName: "Sönke",
  applicationUrl: "https://cockpit.start-berlin.com/membership",
} as MembershipApplicationReadyEmailProps;

export default MembershipApplicationReadyEmail;
