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

interface WorkflowApprovalEmailProps {
  firstName: string;
  workflowId: string;
  approvalUrl: string;
}

const baseUrl = process.env.VERCEL_ENV === "production"
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const WorkflowApprovalEmail = ({
  firstName,
  workflowId,
  approvalUrl,
}: WorkflowApprovalEmailProps) => {
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
          <Preview>Workflow approval required - Action needed</Preview>
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
              Workflow Approval Required
            </Heading>
            <Text className="text-[14px] text-black leading-[24px]">
              Hello {firstName},
            </Text>
            <Text className="text-[14px] text-black leading-[24px]">
              A new workflow has been started and requires your approval to
              proceed.
            </Text>
            <Container className="my-[20px] p-[16px] bg-[#F5F5F5] border border-[#E0E0E0] border-solid rounded-[4px]">
              <Text className="text-[14px] text-black leading-[20px] mt-[8px] mb-0">
                <strong>Workflow ID:</strong> {workflowId}
              </Text>
            </Container>
            <Text className="text-[14px] text-black leading-[24px]">
              Please click the button below to approve this workflow:
            </Text>
            <Section className="text-center my-[32px]">
              <Button
                className="bg-black text-white px-[20px] py-[12px] rounded-[4px] text-[14px] font-medium no-underline"
                href={approvalUrl}
              >
                Approve Workflow
              </Button>
            </Section>
            <Text className="text-[14px] text-black leading-[24px]">
              If you did not expect this workflow or have any questions, please
              contact the Operations & Digital department under{" "}
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

WorkflowApprovalEmail.PreviewProps = {
  firstName: "Sönke",
  workflowId: "wf_123456789",
  approvalUrl: "https://example.com/approve?token=abc123",
} as WorkflowApprovalEmailProps;

export default WorkflowApprovalEmail;
