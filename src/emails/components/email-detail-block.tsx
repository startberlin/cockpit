import type { ReactNode } from "react";
import { Column, Row, Text } from "react-email";

interface DetailRow {
  label: string;
  value: ReactNode;
}

interface EmailDetailBlockProps {
  rows: DetailRow[];
}

export function EmailDetailBlock({ rows }: EmailDetailBlockProps) {
  return (
    <Row className="my-[24px]">
      <Column
        style={{
          border: "1px solid #E7E5E4",
          borderRadius: "4px",
          padding: "16px 20px",
        }}
      >
        {rows.map((row) => (
          <Text key={row.label} className="my-[6px] text-[14px] leading-[1.5]">
            <span style={{ color: "#78716C" }}>{row.label}:</span>{" "}
            <strong style={{ color: "#1C1917" }}>{row.value}</strong>
          </Text>
        ))}
      </Column>
    </Row>
  );
}
