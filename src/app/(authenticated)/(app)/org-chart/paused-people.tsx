import type { OrgChartUser } from "@/db/people";
import type { OrgChartData, OrgChartPerson } from "@/lib/org-chart";
import { PersonCard } from "./person-card";

export function PausedPeople({
  chart,
  users,
}: {
  chart: OrgChartData;
  users: OrgChartUser[];
}) {
  const sections: {
    name: string;
    people: (OrgChartPerson & { roleLabel?: string })[];
  }[] = [
    {
      name: "Board",
      people: chart.officers.filter((person) => person.isPaused),
    },
    ...chart.departments.map(({ departmentName, head, coLeads, members }) => ({
      name: departmentName,
      people: [...(head ? [head] : []), ...coLeads, ...members].filter(
        (person) => person.isPaused,
      ),
    })),
    {
      name: "No department",
      people: users
        .filter(
          (person) =>
            person.isPaused &&
            !person.department &&
            person.positions.length === 0,
        )
        .map((person) => ({ ...person, userId: person.id })),
    },
  ].filter(({ people }) => people.length > 0);

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-6 pb-6">
      {sections.length === 0 && (
        <p className="text-muted-foreground text-sm">No paused members.</p>
      )}
      {sections.map(({ name, people }) => (
        <section key={name} aria-label={name} className="space-y-2">
          <h2 className="text-sm font-semibold">{name}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {people.map((person) => (
              <PersonCard
                key={`${person.userId}-${person.roleLabel ?? "member"}`}
                person={person}
                subtitle={
                  person.roleLabel ??
                  (person.batchNumber == null
                    ? undefined
                    : `Batch #${person.batchNumber}`)
                }
                avatarSize={32}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
