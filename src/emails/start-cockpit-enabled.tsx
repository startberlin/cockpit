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

interface StartCockpitEnabledEmailProps {
  firstName: string;
}

export const StartCockpitEnabledEmail = ({
  firstName,
}: StartCockpitEnabledEmailProps) => {
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
          <Preview>Your START Cockpit access is ready</Preview>
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
              Your START Cockpit access is ready
            </Heading>
            <Text className="text-[14px] text-black leading-[24px]">
              Hello {firstName},
            </Text>
            <Text className="text-[14px] text-black leading-[24px]">
              Your START Berlin account has been enabled for START Cockpit. You
              can now sign in with this email address and your current password.
            </Text>
            <Container className="my-[20px] p-[16px] bg-[#F0F9FF] border border-[#0EA5E9] border-solid rounded-[4px]">
              <Text className="text-[14px] text-black leading-[20px] mt-[8px] mb-0">
                <strong>Sign-in Link:</strong>{" "}
                <Link href={env.NEXT_PUBLIC_COCKPIT_URL}>
                  {env.NEXT_PUBLIC_COCKPIT_URL}
                </Link>
              </Text>
            </Container>
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

StartCockpitEnabledEmail.PreviewProps = {
  firstName: "Sönke",
} as StartCockpitEnabledEmailProps;

export default StartCockpitEnabledEmail;
