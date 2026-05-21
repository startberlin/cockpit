import type { OrgChartDept } from "@/lib/org-chart";
import { PersonCard } from "./person-card";
import { PlaceholderCard } from "./placeholder-card";

// Rendered in grid row 1 so CSS grid normalises all head cells to the same
// height. The fixed 14px stub below extends the connector line to row 2.
export function DeptHeadCell({ dept }: { dept: OrgChartDept }) {
  const { head, departmentName, members } = dept;
  const hasMembers = members.length > 0;

  return (
    <div style={{ display: "grid", gridTemplateRows: "1fr 14px" }}>
      {head ? (
        <PersonCard person={head} subtitle={head.roleLabel} />
      ) : (
        <PlaceholderCard text={`No Head of ${departmentName} assigned`} />
      )}
      <div style={{ position: "relative" }}>
        {hasMembers && (
          <div
            style={{
              position: "absolute",
              left: 13,
              top: 0,
              bottom: 0,
              width: 1,
              background: "var(--border)",
            }}
          />
        )}
      </div>
    </div>
  );
}
