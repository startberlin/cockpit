import { Section, Text } from "react-email";

type Variant = "active" | "info" | "warning";

const STYLES: Record<Variant, { bg: string; border: string; text: string }> = {
  active: { bg: "#ECFDF5", border: "#6EE7B7", text: "#047857" },
  info: { bg: "#F0F9FF", border: "#7DD3FC", text: "#0369A1" },
  warning: { bg: "#FFFBEB", border: "#FCD34D", text: "#92400E" },
};

interface EmailStatusBadgeProps {
  label: string;
  variant: Variant;
}

export function EmailStatusBadge({ label, variant }: EmailStatusBadgeProps) {
  const s = STYLES[variant];
  return (
    <Section className="my-[16px]">
      <Text className="m-0 p-0 text-[13px] font-bold leading-[1]">
        <span
          style={{
            backgroundColor: s.bg,
            border: `1px solid ${s.border}`,
            borderRadius: "20px",
            color: s.text,
            display: "inline-block",
            padding: "4px 12px",
          }}
        >
          {label}
        </span>
      </Text>
    </Section>
  );
}
