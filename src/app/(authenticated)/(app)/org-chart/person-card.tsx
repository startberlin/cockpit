import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { OrgChartPerson } from "@/lib/org-chart";

export function PersonCard({
  person,
  subtitle,
  avatarSize = 40,
}: {
  person: OrgChartPerson;
  subtitle?: string;
  avatarSize?: number;
}) {
  const initials =
    `${person.firstName[0] ?? ""}${person.lastName[0] ?? ""}`.toUpperCase();

  return (
    <div
      style={{
        borderRadius: 4,
        border: "1px solid var(--border)",
        background: "var(--card)",
        boxShadow: "var(--shadow-sm)",
        padding: 14,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <Avatar style={{ width: avatarSize, height: avatarSize, flexShrink: 0 }}>
        <AvatarImage
          src={person.image ?? undefined}
          alt={`${person.firstName} ${person.lastName}`}
        />
        <AvatarFallback style={{ fontSize: avatarSize < 36 ? 11 : 13 }}>
          {initials}
        </AvatarFallback>
      </Avatar>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            lineHeight: 1.25,
            overflowWrap: "anywhere",
          }}
        >
          {person.firstName} {person.lastName}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: 12,
              color: "var(--muted-foreground)",
              marginTop: 3,
              lineHeight: 1.35,
              overflowWrap: "anywhere",
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
