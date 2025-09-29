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

interface WorkflowConfirmationEmailProps {
  firstName: string;
  workflowId: string;
}

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const WorkflowConfirmationEmail = ({
  firstName,
  workflowId,
}: WorkflowConfirmationEmailProps) => {
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
          <Preview>Workflow approved successfully</Preview>
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
              Workflow Approved
            </Heading>
            <Text className="text-[14px] text-black leading-[24px]">
              Hello {firstName},
            </Text>
            <Text className="text-[14px] text-black leading-[24px]">
              Thank you for approving the workflow. Your approval has been
              successfully recorded and the workflow will now proceed.
            </Text>
            <Container className="my-[20px] p-[16px] bg-[#F0F9FF] border border-[#0EA5E9] border-solid rounded-[4px]">
              <Text className="text-[14px] text-black leading-[20px] mt-[8px] mb-0">
                <strong>✅ Workflow ID:</strong> {workflowId}
                <br />
                <strong>Status:</strong> Approved
                <br />
                <strong>Approved at:</strong> {new Date().toLocaleString()}
              </Text>
            </Container>
            <Text className="text-[14px] text-black leading-[24px]">
              The workflow is now in progress and you will be notified of any
              further updates.
            </Text>
            <Text className="text-[14px] text-black leading-[24px]">
              If you have any questions about this workflow, please contact the
              Operations & Digital department under{" "}
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

WorkflowConfirmationEmail.PreviewProps = {
  firstName: "Sönke",
  workflowId: "wf_123456789",
} as WorkflowConfirmationEmailProps;

export default WorkflowConfirmationEmail;
