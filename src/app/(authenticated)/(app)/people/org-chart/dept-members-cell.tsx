import type { OrgChartDept } from "@/lib/org-chart";
import { PersonCard } from "./person-card";
import { TreeConnector } from "./tree-connector";

// Rendered in grid row 2, directly below DeptHeadCell with no row gap,
// so tree connectors flow from the stub.
export function DeptMembersCell({ dept }: { dept: OrgChartDept }) {
  const { head, members } = dept;

  if (!head) return <div />;

  if (members.length === 0) {
    return (
      <div style={{ paddingTop: 12, paddingBottom: 8 }}>
        <div
          style={{
            padding: 14,
            borderRadius: 4,
            border: "1px dashed var(--border)",
            background: "var(--muted)",
            fontSize: 12,
            color: "var(--muted-foreground)",
            textAlign: "center",
          }}
        >
          No team members yet
        </div>
      </div>
    );
  }

  return (
    <div>
      {members.map((member, i) => (
        <div
          key={member.userId}
          style={{ display: "flex", alignItems: "stretch" }}
        >
          <TreeConnector isLast={i === members.length - 1} />
          <div style={{ flex: 1, minWidth: 0, padding: "6px 0" }}>
            <PersonCard
              person={member}
              subtitle={
                member.batchNumber != null
                  ? `Batch #${member.batchNumber}${member.status === "onboarding" ? " · Onboarding" : ""}`
                  : undefined
              }
              avatarSize={32}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
