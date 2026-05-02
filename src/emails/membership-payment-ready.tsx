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

interface MembershipPaymentReadyEmailProps {
  firstName: string;
}

export const MembershipPaymentReadyEmail = ({
  firstName,
}: MembershipPaymentReadyEmailProps) => {
  const membershipUrl = `${env.NEXT_PUBLIC_COCKPIT_URL}/membership`;

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
          <Preview>Your START Berlin membership is ready to finalize</Preview>
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
              Finalize your membership
            </Heading>
            <Text className="text-[14px] text-black leading-[24px]">
              Hello {firstName},
            </Text>
            <Text className="text-[14px] text-black leading-[24px]">
              Congratulations on finishing your onboarding. You can now set up
              your yearly START Berlin membership payment in START Cockpit.
            </Text>
            <Text className="text-[14px] text-black leading-[24px]">
              Your START Berlin membership costs 40 EUR per year. It covers the
              essentials that keep the association running and helps fund
              internal and external events and member benefits throughout the
              year.
            </Text>
            <Text className="text-[14px] text-black leading-[24px]">
              To finalize your membership, open START Cockpit and set up your
              yearly membership payment. Once the setup is complete, your
              membership will be activated automatically.
            </Text>
            <Section className="my-[24px]">
              <Button
                href={membershipUrl}
                className="bg-black text-white px-[18px] py-[12px] text-[14px] font-bold no-underline"
              >
                Finalize membership
              </Button>
              <Text className="text-[12px] text-[#57534E] leading-[18px] mt-[16px] mb-0">
                If the button does not work, open this link:
                <br />
                <Link href={membershipUrl}>{membershipUrl}</Link>
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

MembershipPaymentReadyEmail.PreviewProps = {
  firstName: "Sönke",
} as MembershipPaymentReadyEmailProps;

export default MembershipPaymentReadyEmail;
