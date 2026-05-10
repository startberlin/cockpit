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

interface BoardResolutionTaskAssignedEmailProps {
  firstName: string;
  subjectName: string;
  resolutionUrl: string;
}

export const BoardResolutionTaskAssignedEmail = ({
  firstName,
  subjectName,
  resolutionUrl,
}: BoardResolutionTaskAssignedEmailProps) => {
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
            Action required: vote on {subjectName}&apos;s membership
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
              Membership vote required
            </Heading>
            <Text className="text-[14px] text-black leading-[24px]">
              Hello {firstName},
            </Text>
            <Text className="text-[14px] text-black leading-[24px]">
              {subjectName} has applied for membership in START Berlin e.V. As a
              board member, you are asked to review the application and cast
              your vote.
            </Text>
            <Text className="text-[14px] text-black leading-[24px]">
              Open the resolution in START Cockpit to view the details and
              record your vote.
            </Text>
            <Section className="my-[24px]">
              <Button
                href={resolutionUrl}
                className="bg-black text-white px-[18px] py-[12px] text-[14px] font-bold no-underline"
              >
                View resolution
              </Button>
              <Text className="text-[12px] text-[#57534E] leading-[18px] mt-[16px] mb-0">
                If the button does not work, open this link:
                <br />
                <Link href={resolutionUrl}>{resolutionUrl}</Link>
              </Text>
            </Section>
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

BoardResolutionTaskAssignedEmail.PreviewProps = {
  firstName: "Marie",
  subjectName: "Sönke Peters",
  resolutionUrl: "https://cockpit.start-berlin.com/people/resolutions/res_123",
} as BoardResolutionTaskAssignedEmailProps;

export default BoardResolutionTaskAssignedEmail;
