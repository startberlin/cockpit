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

interface AccountUpdatedEmailProps {
  message: string;
  firstName: string;
  change?: string;
}

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const AccountUpdatedEmail = ({
  message,
  firstName,
  change,
}: AccountUpdatedEmailProps) => {
  return (
    <Html>
      <Head>
        <Font
          fontFamily="Avenir Next"
          fallbackFontFamily="sans-serif"
          webFont={{
            url: `${baseUrl}/avenirnext-bold.otf`,
            format: "opentype",
          }}
          fontWeight={700}
          fontStyle="bold"
        />
        <Font
          fontFamily="Avenir Next"
          fallbackFontFamily="sans-serif"
          webFont={{
            url: `${baseUrl}/avenirnext-medium.otf`,
            format: "opentype",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Tailwind
        config={{
          presets: [pixelBasedPreset],
        }}
      >
        <Body className="mx-auto my-auto bg-white px-2 font-sans">
          <Preview>{message}</Preview>
          <Container className="mx-auto my-[40px] max-w-[465px] border border-[#E7E5E4] border-solid p-[20px]">
            <Section className="mt-[10px]">
              <Img
                src={`${baseUrl}/logo-black.png`}
                width="72"
                height="33"
                alt="START Berlin"
                className="my-0"
              />
            </Section>
            <Heading className="mx-0 my-[30px] p-0 font-bold text-[24px] text-black uppercase">
              {message}
            </Heading>
            <Text className="text-[14px] text-black leading-[24px]">
              Hello {firstName},
            </Text>
            <Text className="text-[14px] text-black leading-[24px]">
              {message}
            </Text>
            {change && (
              <Container className="my-[20px] p-[16px] bg-[#F5F5F5] border border-[#E0E0E0] border-solid rounded-[4px]">
                <Text className="text-[14px] text-black leading-[20px] mt-[8px] mb-0 whitespace-pre-line">
                  {change}
                </Text>
              </Container>
            )}
            <Text className="text-[14px] text-black leading-[24px]">
              If you did not request this change, please contact the Operations
              & Digital department under{" "}
              <Link href="mailto:operations@start-berlin.com">
                operations@start-berlin.com
              </Link>
              .
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

AccountUpdatedEmail.PreviewProps = {
  message: "Your address has been changed",
  firstName: "Sönke",
  address: "Musterstraße 123\n10115 Berlin\nGermany",
} as AccountUpdatedEmailProps;

export default AccountUpdatedEmail;
