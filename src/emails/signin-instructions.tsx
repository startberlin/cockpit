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

interface SignInInstructionsEmailProps {
  firstName: string;
  companyEmail: string;
  initialPassword: string;
}

export const SignInInstructionsEmail = ({
  firstName,
  companyEmail,
  initialPassword,
}: SignInInstructionsEmailProps) => {
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
          <Preview>
            Your START Berlin Google account sign-in instructions
          </Preview>
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
              Your START Berlin Sign-in Instructions
            </Heading>
            <Text className="text-[14px] text-black leading-[24px]">
              Hello {firstName},
            </Text>
            <Text className="text-[14px] text-black leading-[24px]">
              Welcome to START Berlin! Your Google Workspace account has been
              created. Please find your sign-in details below:
            </Text>
            <Container className="my-[20px] p-[16px] bg-[#F0F9FF] border border-[#0EA5E9] border-solid rounded-[4px]">
              <Text className="text-[14px] text-black leading-[20px] mt-[8px] mb-0">
                <strong>Email:</strong> {companyEmail}
                <br />
                <strong>Password:</strong> {initialPassword}
                <br />
                <strong>Sign-in Link:</strong>{" "}
                <Link href={env.NEXT_PUBLIC_COCKPIT_URL}>
                  {env.NEXT_PUBLIC_COCKPIT_URL}
                </Link>
              </Text>
            </Container>
            <Text className="text-[14px] text-black leading-[24px]">
              <b>What happens next?</b>
              <br />
              You will be prompted to change your password the first time you
              sign in. For security, please choose a personal password you have
              never used anywhere else. If you run into any issues, contact the
              Operations & Digital department:
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

SignInInstructionsEmail.PreviewProps = {
  firstName: "Sönke",
  companyEmail: "soenke.mueller@start-berlin.com",
  initialPassword: "MyInitialPwd!2345",
} as SignInInstructionsEmailProps;

export default SignInInstructionsEmail;
