import { Heading, Text } from "react-email";
import { EmailShell } from "@/emails/components/email-shell";
import { DEPARTMENT_NAMES } from "@/lib/departments";

type DepartmentId = keyof typeof DEPARTMENT_NAMES;

interface DepartmentChangedDeptHeadEmailProps {
  firstName: string;
  memberName: string;
  memberEmail: string;
  department: string;
  direction: "joined" | "left";
}

const getDepartmentLabel = (id: string) =>
  DEPARTMENT_NAMES[id as DepartmentId] ?? id;

export const DepartmentChangedDeptHeadEmail = ({
  firstName,
  memberName,
  memberEmail,
  department,
  direction,
}: DepartmentChangedDeptHeadEmailProps) => {
  const departmentLabel = getDepartmentLabel(department);

  const heading =
    direction === "joined"
      ? `${memberName} has joined your ${departmentLabel} department`
      : `${memberName} has left your ${departmentLabel} department`;

  const preview =
    direction === "joined"
      ? `${memberName} joined ${departmentLabel}`
      : `${memberName} left ${departmentLabel}`;

  return (
    <EmailShell
      preview={preview}
      eyebrow="Department update"
      footerAudience="member"
      campaign="department-changed-dept-head"
    >
      <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
        {heading}
      </Heading>
      <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
        Hi {firstName},
      </Text>
      {direction === "joined" ? (
        <Text className="mt-0 mb-0 text-[15px] text-[#78716C] leading-[1.65]">
          <strong style={{ color: "#1C1917" }}>{memberName}</strong> (
          <a href={`mailto:${memberEmail}`} style={{ color: "#1C1917" }}>
            {memberEmail}
          </a>
          ) has been assigned to your{" "}
          <strong style={{ color: "#1C1917" }}>{departmentLabel}</strong>{" "}
          department.
        </Text>
      ) : (
        <Text className="mt-0 mb-0 text-[15px] text-[#78716C] leading-[1.65]">
          <strong style={{ color: "#1C1917" }}>{memberName}</strong> (
          <a href={`mailto:${memberEmail}`} style={{ color: "#1C1917" }}>
            {memberEmail}
          </a>
          ) has been removed from your{" "}
          <strong style={{ color: "#1C1917" }}>{departmentLabel}</strong>{" "}
          department.
        </Text>
      )}
    </EmailShell>
  );
};

DepartmentChangedDeptHeadEmail.PreviewProps = {
  firstName: "Lena",
  memberName: "Sönke Peters",
  memberEmail: "soenke.peters@start-berlin.com",
  department: "growth",
  direction: "joined",
} as DepartmentChangedDeptHeadEmailProps;

export default DepartmentChangedDeptHeadEmail;
