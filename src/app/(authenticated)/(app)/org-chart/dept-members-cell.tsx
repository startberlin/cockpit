import type { OrgChartDept } from "@/lib/org-chart";
import { PersonCard } from "./person-card";
import { TreeConnector } from "./tree-connector";

// Rendered in grid row 2, directly below DeptHeadCell with no row gap,
// so tree connectors flow from the stub. Co-leads are shown first — styled
// like ordinary members but labelled "Co-Lead of …" — followed by members.
export function DeptMembersCell({ dept }: { dept: OrgChartDept }) {
  const { coLeads, members } = dept;

  const entries = [
    ...coLeads.map((coLead) => ({
      userId: coLead.userId,
      person: coLead,
      subtitle: coLead.roleLabel,
    })),
    ...members.map((member) => ({
      userId: member.userId,
      person: member,
      subtitle:
        member.batchNumber != null
          ? `Batch #${member.batchNumber}${member.status === "onboarding" ? " · Onboarding" : ""}`
          : undefined,
    })),
  ];

  if (entries.length === 0) {
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
      {entries.map((entry, i) => (
        <div
          key={entry.userId}
          style={{ display: "flex", alignItems: "stretch" }}
        >
          <TreeConnector isLast={i === entries.length - 1} />
          <div style={{ flex: 1, minWidth: 0, padding: "6px 0" }}>
            <PersonCard
              person={entry.person}
              subtitle={entry.subtitle}
              avatarSize={32}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
