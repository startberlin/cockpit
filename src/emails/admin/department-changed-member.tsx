import { Heading, Text } from "react-email";
import { EmailShell } from "@/emails/components/email-shell";
import { DEPARTMENT_NAMES } from "@/lib/departments";

type DepartmentId = keyof typeof DEPARTMENT_NAMES;

interface DepartmentChangedMemberEmailProps {
  firstName: string;
  oldDepartment: string | null;
  newDepartment: string;
}

const getDepartmentLabel = (id: string) =>
  DEPARTMENT_NAMES[id as DepartmentId] ?? id;

export const DepartmentChangedMemberEmail = ({
  firstName,
  oldDepartment,
  newDepartment,
}: DepartmentChangedMemberEmailProps) => {
  const newLabel = getDepartmentLabel(newDepartment);
  const oldLabel = oldDepartment ? getDepartmentLabel(oldDepartment) : null;

  const heading =
    oldLabel === null
      ? `Your department has been assigned: ${newLabel}`
      : `Your department has been changed to ${newLabel}`;

  const preview =
    oldLabel === null
      ? `You've been assigned to the ${newLabel} department`
      : `Your department has changed from ${oldLabel} to ${newLabel}`;

  return (
    <EmailShell
      preview={preview}
      eyebrow="Department update"
      footerAudience="member"
      campaign="department-changed-member"
    >
      <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
        {heading}
      </Heading>
      <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
        Hi {firstName},
      </Text>
      {oldLabel === null ? (
        <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
          You've been assigned to the{" "}
          <strong style={{ color: "#1C1917" }}>{newLabel}</strong> department at
          START Berlin e.V.
        </Text>
      ) : (
        <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
          Your department has been changed from{" "}
          <strong style={{ color: "#1C1917" }}>{oldLabel}</strong> to{" "}
          <strong style={{ color: "#1C1917" }}>{newLabel}</strong>.
        </Text>
      )}
      <Text className="mt-0 mb-0 text-[15px] text-[#78716C] leading-[1.65]">
        If you have any questions, please reach out to the Operations &amp;
        Digital department at{" "}
        <a
          href="mailto:operations@start-berlin.com"
          style={{ color: "#1C1917" }}
        >
          operations@start-berlin.com
        </a>
        .
      </Text>
    </EmailShell>
  );
};

DepartmentChangedMemberEmail.PreviewProps = {
  firstName: "Marie",
  oldDepartment: "events",
  newDepartment: "growth",
} as DepartmentChangedMemberEmailProps;

export default DepartmentChangedMemberEmail;
