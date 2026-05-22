import { and, eq, inArray, sql } from "drizzle-orm";
import db from "@/db";
import {
  getApprovalRecipients,
  getPositionAssignments,
  type PositionAssignments,
  type PositionHolder,
} from "@/db/authority";
import type { Department } from "@/db/schema/auth";
import { user } from "@/db/schema/auth";
import { legalMembership } from "@/db/schema/legal-membership";
import {
  type MemberActionType,
  memberActionReminder,
} from "@/db/schema/member-action-reminder";
import { membershipTransitionRequest } from "@/db/schema/membership-transition-request";
import { DEPARTMENT_NAMES } from "@/lib/departments";
import { newId } from "@/lib/id";
import { getStructuredMembershipState } from "@/lib/membership-status";

type TransitionType = "alumni_request" | "supporting_alumni_request";

export type OpenAction =
  | {
      actionType: "complete_application" | "reconfirm_membership";
      recipientUserId: string;
      subjectId: string; // legalMembershipId
      recipientFirstName: string;
      recipientEmail: string;
    }
  | {
      actionType: "setup_mandate" | "fix_mandate";
      recipientUserId: string;
      subjectId: string; // userId (self)
      recipientFirstName: string;
      recipientEmail: string;
    }
  | {
      actionType: "acknowledge_cancellation";
      recipientUserId: string;
      subjectId: string; // transitionRequestId
      recipientFirstName: string;
      recipientEmail: string;
      subjectName: string;
      subjectUserId: string;
      requestedAt: string;
      receivingReason: string;
    }
  | {
      actionType: "decide_transition";
      recipientUserId: string;
      subjectId: string; // transitionRequestId
      recipientFirstName: string;
      recipientEmail: string;
      subjectName: string;
      subjectUserId: string;
      transitionType: TransitionType;
      requestedAt: string;
      receivingReason: string;
    }
  | {
      actionType: "vote_admission";
      recipientUserId: string;
      subjectId: string; // legalMembershipId
      recipientFirstName: string;
      recipientEmail: string;
      subjectName: string;
    };

export function actionKey(a: {
  recipientUserId: string;
  actionType: MemberActionType;
  subjectId: string;
}): string {
  return `${a.recipientUserId}|${a.actionType}|${a.subjectId}`;
}

export async function computeOpenActions(): Promise<OpenAction[]> {
  const [memberActions, boardCancellationActions, boardAdmissionActions] =
    await Promise.all([
      computeMemberSelfActions(),
      computeBoardTransitionActions(),
      computeBoardAdmissionVoteActions(),
    ]);

  return [
    ...memberActions,
    ...boardCancellationActions,
    ...boardAdmissionActions,
  ];
}

async function computeMemberSelfActions(): Promise<OpenAction[]> {
  // Pending transitions block member-side reminders (mirrors the home-screen notice).
  const pending = await db.query.membershipTransitionRequest.findMany({
    where: (t, { eq: eqFn }) => eqFn(t.status, "pending"),
    columns: { userId: true },
  });
  const userIdsWithPendingTransition = new Set(pending.map((r) => r.userId));

  // Pull every user with a still-active legal membership.
  const rows = await db
    .select({
      userId: user.id,
      firstName: user.firstName,
      email: user.email,
      status: user.status,
      legalMembershipState: user.legalMembershipState,
      gocardlessMandateId: user.gocardlessMandateId,
      gocardlessCustomerId: user.gocardlessCustomerId,
      personalEmail: user.personalEmail,
      phone: user.phone,
      birthDate: user.birthDate,
      street: user.street,
      city: user.city,
      state: user.state,
      zip: user.zip,
      country: user.country,
      eventEmailPreference: user.eventEmailPreference,
      lmId: legalMembership.id,
      lmStatus: legalMembership.status,
    })
    .from(user)
    .innerJoin(legalMembership, eq(legalMembership.userId, user.id))
    .where(
      and(
        inArray(legalMembership.status, [
          "application_pending",
          "membership_reconfirmation_pending",
          "active",
        ]),
        inArray(user.status, ["onboarding", "member", "supporting_alumni"]),
      ),
    );

  const out: OpenAction[] = [];

  for (const r of rows) {
    if (userIdsWithPendingTransition.has(r.userId)) continue;
    if (!r.email) continue;

    if (r.lmStatus === "application_pending") {
      out.push({
        actionType: "complete_application",
        recipientUserId: r.userId,
        subjectId: r.lmId,
        recipientFirstName: r.firstName,
        recipientEmail: r.email,
      });
      continue;
    }

    if (r.lmStatus === "membership_reconfirmation_pending") {
      out.push({
        actionType: "reconfirm_membership",
        recipientUserId: r.userId,
        subjectId: r.lmId,
        recipientFirstName: r.firstName,
        recipientEmail: r.email,
      });
      continue;
    }

    // lmStatus === "active": check mandate state via the same primitive the
    // member home screen uses to decide which notice to show.
    const state = getStructuredMembershipState({
      personalEmail: r.personalEmail,
      phone: r.phone,
      birthDate: r.birthDate,
      street: r.street,
      city: r.city,
      state: r.state,
      zip: r.zip,
      country: r.country,
      status: r.status,
      legalMembershipState: r.legalMembershipState,
      gocardlessMandateId: r.gocardlessMandateId,
      gocardlessCustomerId: r.gocardlessCustomerId,
      eventEmailPreference: r.eventEmailPreference,
    });

    if (state.mandateCancelled) {
      out.push({
        actionType: "fix_mandate",
        recipientUserId: r.userId,
        subjectId: r.userId,
        recipientFirstName: r.firstName,
        recipientEmail: r.email,
      });
    } else if (state.payment === "not_started" && state.paymentSetupAllowed) {
      out.push({
        actionType: "setup_mandate",
        recipientUserId: r.userId,
        subjectId: r.userId,
        recipientFirstName: r.firstName,
        recipientEmail: r.email,
      });
    }
  }

  return out;
}

async function computeBoardTransitionActions(): Promise<OpenAction[]> {
  const requests = await db
    .select({
      id: membershipTransitionRequest.id,
      userId: membershipTransitionRequest.userId,
      type: membershipTransitionRequest.type,
      reason: membershipTransitionRequest.reason,
      requestedAt: membershipTransitionRequest.requestedAt,
      subjectFirstName: user.firstName,
      subjectLastName: user.lastName,
      subjectDepartment: user.department,
    })
    .from(membershipTransitionRequest)
    .innerJoin(user, eq(user.id, membershipTransitionRequest.userId))
    .where(eq(membershipTransitionRequest.status, "pending"));

  if (requests.length === 0) return [];

  const positions = await getPositionAssignments();
  const boardMemberIds = boardUserIds(positions);

  const out: OpenAction[] = [];

  for (const req of requests) {
    const subjectName =
      `${req.subjectFirstName} ${req.subjectLastName}`.trim() || req.userId;
    const requestedAt = req.requestedAt.toISOString().substring(0, 10);

    if (req.type === "cancellation" && req.reason === "resigned") {
      const recipients = getApprovalRecipients(
        positions,
        req.userId,
        req.subjectDepartment,
      );
      for (const recipient of recipients) {
        if (!recipient.email) continue;
        out.push({
          actionType: "acknowledge_cancellation",
          recipientUserId: recipient.userId,
          subjectId: req.id,
          recipientFirstName: recipient.firstName,
          recipientEmail: recipient.email,
          subjectName,
          subjectUserId: req.userId,
          requestedAt,
          receivingReason: receivingReasonFor(
            recipient,
            boardMemberIds,
            req.subjectDepartment,
          ),
        });
      }
      continue;
    }

    if (
      req.type === "alumni_request" ||
      req.type === "supporting_alumni_request"
    ) {
      const recipients = getApprovalRecipients(
        positions,
        req.userId,
        req.subjectDepartment,
      );
      for (const recipient of recipients) {
        if (!recipient.email) continue;
        out.push({
          actionType: "decide_transition",
          recipientUserId: recipient.userId,
          subjectId: req.id,
          recipientFirstName: recipient.firstName,
          recipientEmail: recipient.email,
          subjectName,
          subjectUserId: req.userId,
          transitionType: req.type,
          requestedAt,
          receivingReason: receivingReasonFor(
            recipient,
            boardMemberIds,
            req.subjectDepartment,
          ),
        });
      }
    }
  }

  return out;
}

async function computeBoardAdmissionVoteActions(): Promise<OpenAction[]> {
  const pendingAdmissions = await db.query.legalMembership.findMany({
    where: (l, { eq: eqFn }) => eqFn(l.status, "admission_pending"),
    columns: {
      id: true,
      userId: true,
      boardParticipants: true,
      boardVotes: true,
    },
  });

  if (pendingAdmissions.length === 0) return [];

  const allParticipantIds = new Set<string>();
  const allSubjectUserIds = new Set<string>();
  for (const lm of pendingAdmissions) {
    for (const p of lm.boardParticipants ?? []) {
      allParticipantIds.add(p.userId);
    }
    allSubjectUserIds.add(lm.userId);
  }

  const referencedUserIds = [...allParticipantIds, ...allSubjectUserIds];
  if (referencedUserIds.length === 0) return [];

  const userRows = await db.query.user.findMany({
    where: (u, { inArray: inArrayFn }) => inArrayFn(u.id, referencedUserIds),
    columns: { id: true, firstName: true, lastName: true, email: true },
  });
  const userById = new Map(userRows.map((u) => [u.id, u]));

  const out: OpenAction[] = [];

  for (const lm of pendingAdmissions) {
    const subjectUser = userById.get(lm.userId);
    const subjectName = subjectUser
      ? `${subjectUser.firstName} ${subjectUser.lastName}`.trim()
      : lm.userId;

    const votedUserIds = new Set(
      (lm.boardVotes ?? []).map((v) => v.voterUserId),
    );

    for (const participant of lm.boardParticipants ?? []) {
      if (votedUserIds.has(participant.userId)) continue;
      const u = userById.get(participant.userId);
      if (!u || !u.email) continue;
      out.push({
        actionType: "vote_admission",
        recipientUserId: participant.userId,
        subjectId: lm.id,
        recipientFirstName: u.firstName,
        recipientEmail: u.email,
        subjectName,
      });
    }
  }

  return out;
}

function boardUserIds(positions: PositionAssignments): Set<string> {
  return new Set(
    [
      positions.president,
      positions.vice_president,
      positions.head_of_finance,
    ].flatMap((p) => (p ? [p.userId] : [])),
  );
}

function receivingReasonFor(
  recipient: PositionHolder,
  boardMemberIds: Set<string>,
  subjectDepartment: Department | null | undefined,
): string {
  if (boardMemberIds.has(recipient.userId)) {
    return "You're receiving this because you're a board member of START Berlin.";
  }
  const deptLabel = subjectDepartment
    ? DEPARTMENT_NAMES[subjectDepartment]
    : "this department";
  return `You're receiving this because you're the department head of ${deptLabel}.`;
}

export type ReminderRow = {
  id: string;
  recipientUserId: string;
  actionType: MemberActionType;
  subjectId: string;
  firstObservedAt: Date;
  lastReminderAt: Date;
  reminderCount: number;
};

export async function loadAllReminders(): Promise<ReminderRow[]> {
  return db
    .select({
      id: memberActionReminder.id,
      recipientUserId: memberActionReminder.recipientUserId,
      actionType: memberActionReminder.actionType,
      subjectId: memberActionReminder.subjectId,
      firstObservedAt: memberActionReminder.firstObservedAt,
      lastReminderAt: memberActionReminder.lastReminderAt,
      reminderCount: memberActionReminder.reminderCount,
    })
    .from(memberActionReminder);
}

export async function insertReminderObservations(
  observations: Array<{
    recipientUserId: string;
    actionType: MemberActionType;
    subjectId: string;
  }>,
): Promise<number> {
  if (observations.length === 0) return 0;

  const rows = observations.map((o) => ({
    id: newId("memberActionReminder"),
    recipientUserId: o.recipientUserId,
    actionType: o.actionType,
    subjectId: o.subjectId,
  }));

  const inserted = await db
    .insert(memberActionReminder)
    .values(rows)
    .onConflictDoNothing({
      target: [
        memberActionReminder.recipientUserId,
        memberActionReminder.actionType,
        memberActionReminder.subjectId,
      ],
    })
    .returning({ id: memberActionReminder.id });

  return inserted.length;
}

export async function markReminderSent(id: string): Promise<void> {
  await db
    .update(memberActionReminder)
    .set({
      lastReminderAt: new Date(),
      reminderCount: sql`${memberActionReminder.reminderCount} + 1`,
    })
    .where(eq(memberActionReminder.id, id));
}

export async function deleteClosedReminders(
  openActionKeys: Set<string>,
): Promise<number> {
  const all = await loadAllReminders();
  const toDelete = all
    .filter((r) => !openActionKeys.has(actionKey(r)))
    .map((r) => r.id);

  if (toDelete.length === 0) return 0;

  const deleted = await db
    .delete(memberActionReminder)
    .where(inArray(memberActionReminder.id, toDelete))
    .returning({ id: memberActionReminder.id });

  return deleted.length;
}
