import "server-only";

import { and, desc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { type AuditActor, writeAuditLog } from "@/lib/audit-log";
import db from ".";
import { getDepartmentLeads, getPositionAssignments } from "./authority";
import { getActiveMembershipTransitionRequest } from "./membership-transitions";
import { SYSTEM_USER_EMAIL, type UserDetails } from "./people";
import { auditLog, user } from "./schema";

const pauseEvent = "user.participation_paused";
const resumeEvent = "user.participation_resumed";

type MemberContact = Pick<
  UserDetails,
  "id" | "firstName" | "lastName" | "email" | "personalEmail" | "department"
>;

export async function getParticipationRecipients(member: MemberContact) {
  const leads = member.department
    ? getDepartmentLeads(
        await getPositionAssignments(),
        member.department,
        member.id,
      )
    : [];
  const candidates = [
    {
      id: member.id,
      name: `${member.firstName} ${member.lastName}`.trim(),
      firstName: member.firstName,
      email: member.personalEmail?.trim() || member.email?.trim() || null,
      role: "member" as const,
    },
    ...leads.map((lead) => ({
      id: lead.userId,
      name: `${lead.firstName} ${lead.lastName}`.trim(),
      firstName: lead.firstName,
      email: lead.email?.trim() || null,
      role: "department_lead" as const,
    })),
  ];
  const seen = new Set<string>();
  return candidates.filter(({ email }) => {
    if (!email) return true;
    const key = email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getParticipationControls(user: UserDetails) {
  if (user.status !== "member" || user.email === SYSTEM_USER_EMAIL) return null;

  const [recipients, pendingTransition] = await Promise.all([
    getParticipationRecipients(user),
    getActiveMembershipTransitionRequest(user.id),
  ]);
  return {
    userId: user.id,
    memberName: `${user.firstName} ${user.lastName}`.trim(),
    pausedAt: user.participationPausedAt?.toISOString() ?? null,
    notifyMember: recipients.some((r) => r.role === "member" && r.email),
    departmentLeadCount: recipients.filter(
      (r) => r.role === "department_lead" && r.email,
    ).length,
    hasPendingTransition: Boolean(pendingTransition),
  };
}

export type ParticipationControls = NonNullable<
  Awaited<ReturnType<typeof getParticipationControls>>
>;

export async function changeParticipationPause({
  userId,
  expectedPausedAt,
  actor,
}: {
  userId: string;
  expectedPausedAt: string | null;
  actor: AuditActor;
}) {
  const changedAt = new Date();
  const paused = expectedPausedAt === null;
  return db.transaction(async (tx) => {
    const [member] = await tx
      .update(user)
      .set({ participationPausedAt: paused ? changedAt : null })
      .where(
        and(
          eq(user.id, userId),
          eq(user.status, "member"),
          or(isNull(user.email), ne(user.email, SYSTEM_USER_EMAIL)),
          expectedPausedAt === null
            ? isNull(user.participationPausedAt)
            : eq(user.participationPausedAt, new Date(expectedPausedAt)),
        ),
      )
      .returning({ id: user.id, name: user.name });

    if (!member) return null;

    const auditId = await writeAuditLog(
      {
        category: "user",
        eventType: paused ? pauseEvent : resumeEvent,
        actor,
        subject: member,
        metadata: { changedAt: changedAt.toISOString() },
        description: paused ? "Participation paused" : "Participation resumed",
      },
      tx,
    );

    return { auditId, paused, member };
  });
}

export async function getCurrentParticipationChange(auditId: string) {
  const change = await db.query.auditLog.findFirst({
    where: and(
      eq(auditLog.id, auditId),
      inArray(auditLog.eventType, [pauseEvent, resumeEvent]),
    ),
  });
  const changedAt = change?.metadata.changedAt;
  if (!change?.subjectId || typeof changedAt !== "string") return null;

  const [member, latestChange] = await Promise.all([
    db.query.user.findFirst({
      where: eq(user.id, change.subjectId),
      columns: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        personalEmail: true,
        department: true,
        status: true,
        participationPausedAt: true,
      },
    }),
    db.query.auditLog.findFirst({
      where: and(
        eq(auditLog.subjectId, change.subjectId),
        inArray(auditLog.eventType, [pauseEvent, resumeEvent]),
      ),
      orderBy: [desc(auditLog.createdAt), desc(auditLog.id)],
      columns: { id: true },
    }),
  ]);

  const paused = change.eventType === pauseEvent;
  const pauseMatches = paused
    ? member?.participationPausedAt?.toISOString() === changedAt
    : member?.participationPausedAt === null;
  return member?.status === "member" &&
    pauseMatches &&
    latestChange?.id === auditId
    ? { member, paused, changedAt }
    : null;
}
